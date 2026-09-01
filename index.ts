// Supabase Edge Function — deploy with:
//   supabase functions deploy bharatpe-webhook
// (verify_jwt is set to false in supabase/config.toml so this doesn't
// need --no-verify-jwt passed on every deploy)
//
// Required secrets (set with `supabase secrets set KEY=value`):
//   BHARATPE_SHARED_SECRET   — must match what's configured in the Android app
//   SUPABASE_URL              — usually auto-provided by the platform
//   SUPABASE_SERVICE_ROLE_KEY — service role key (bypasses RLS; needed to write)
//
// What this does with a BharatPe payment, in order:
//   1. Exactly one open printed bill matches (by note or by amount+time)
//      -> settle that bill. No new revenue — it was already counted when
//         the bill was printed.
//   2. No open printed bill matches at all -> this payment was collected
//      without printing (the "too busy to print" case) -> auto-create a
//      new confirmed order for it directly, and add it to today's total.
//   3. Two or more open printed bills match the same amount -> ambiguous,
//      could be any of them -> leave unmatched for manual review. Auto-
//      creating here would risk double-counting a bill that WAS printed.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SHARED_SECRET = Deno.env.get('BHARATPE_SHARED_SECRET')!;
// This app is single-restaurant/single-owner — every existing row in
// orders/daily_sales carries the same user_id. Rows written by this
// function (via the service-role key, which has no logged-in user of its
// own) need that same value set explicitly, or they end up invisible to
// the app's user-scoped views despite being written successfully.
const RESTAURANT_USER_ID = Deno.env.get('RESTAURANT_USER_ID') || null;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Orders older than this are very unlikely to still be an open bill —
// past this, an amount-only match is more likely a coincidence than a
// real match, so it's left for manual review instead of guessed at.
const MATCH_WINDOW_MINUTES = 20;

interface IncomingEvent {
  amount: string;
  utr: string;
  raw_message: string;
  sender: string;
  received_at_epoch_ms: number;
  client_event_id: string;
}

// Mirrors the client-side adjustDailySale in src/utils/saveOrder.ts — kept
// in sync deliberately, since this is the one other place revenue can be
// added to the ledger. Every step now checks and logs its own errors —
// previously this failed completely silently, which is why 31 real
// payments auto-created orders correctly but never showed up in the
// ledger with zero trace anywhere of why.
async function adjustDailySale(saleDate: string, amountDelta: number, orderCountDelta: number): Promise<boolean> {
  const { data: existing, error: selectErr } = await supabase
    .from('daily_sales')
    .select('*')
    .eq('sale_date', saleDate)
    .maybeSingle();

  if (selectErr) {
    console.error(`adjustDailySale: select failed for ${saleDate}:`, selectErr);
    return false;
  }

  if (existing) {
    const { error: updateErr } = await supabase
      .from('daily_sales')
      .update({
        total_amount: Math.max(0, parseFloat(existing.total_amount) + amountDelta),
        order_count: Math.max(0, existing.order_count + orderCountDelta),
      })
      .eq('sale_date', saleDate);

    if (updateErr) {
      console.error(`adjustDailySale: update failed for ${saleDate}:`, updateErr);
      return false;
    }
  } else if (amountDelta > 0) {
    const { error: insertErr } = await supabase
      .from('daily_sales')
      .insert([{ sale_date: saleDate, total_amount: amountDelta, order_count: 1, user_id: RESTAURANT_USER_ID }]);

    if (insertErr) {
      console.error(`adjustDailySale: insert failed for ${saleDate}:`, insertErr);
      return false;
    }
  }

  return true;
}

// Only text that actually says a payment was RECEIVED is treated as a
// payment at all. This is deliberately a whitelist, not a blacklist of
// known-bad wordings (settlement notices, refunds, failed-payment alerts,
// etc.) — a blacklist can't anticipate every non-payment message BharatPe
// might ever send, and since an unmatched "payment" now directly creates a
// ledger entry, a false positive here would inject fake revenue.
function looksLikeReceivedPayment(rawMessage: string): boolean {
  const lower = rawMessage.toLowerCase();
  return lower.includes('received') && !lower.includes('settlement');
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const providedSecret = req.headers.get('X-Shared-Secret');
  if (!SHARED_SECRET || providedSecret !== SHARED_SECRET) {
    console.log('Rejected: shared secret missing or mismatched');
    return new Response('Unauthorized', { status: 401 });
  }

  let event: IncomingEvent;
  try {
    event = await req.json();
  } catch {
    console.log('Rejected: request body was not valid JSON');
    return new Response('Invalid JSON', { status: 400 });
  }

  console.log(`Received event: sender=${event.sender} amount=${event.amount} utr=${event.utr || '(none)'}`);

  if (!RESTAURANT_USER_ID) {
    console.error(
      'RESTAURANT_USER_ID secret is not set — any auto-created order or new daily_sales row from this request will be invisible in the app. Run: supabase secrets set RESTAURANT_USER_ID=<your user id>'
    );
  }

  const amount = parseFloat(event.amount);
  if (!amount || amount <= 0) {
    console.log(`Rejected: invalid amount "${event.amount}"`);
    return new Response(JSON.stringify({ ok: false, reason: 'invalid amount' }), { status: 400 });
  }

  // Test events from the app's "Send Test Event" button — still logged so
  // you have something to check in the table, but hard-excluded from ever
  // touching order-matching or ledger logic below.
  const isTestEvent = event.sender === 'TEST';

  if (!isTestEvent && !looksLikeReceivedPayment(event.raw_message || '')) {
    console.log('Rejected: message does not look like a received payment (e.g. a settlement notice) — not stored.');
    return new Response(JSON.stringify({ ok: true, ignored: true, reason: 'not a payment notification' }), {
      status: 200,
    });
  }

  // --- Idempotency: has this exact transaction been seen before? ---
  const orFilters = [`client_event_id.eq.${event.client_event_id}`];
  if (event.utr) orFilters.push(`utr.eq.${event.utr}`);

  const { data: alreadySeen } = await supabase
    .from('bharatpe_transactions')
    .select('id')
    .or(orFilters.join(','))
    .maybeSingle();

  if (alreadySeen) {
    console.log('Duplicate — already recorded, skipping.');
    return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200 });
  }

  // --- Try to match against an open, unconfirmed printed bill (skipped for test events) ---
  const receivedAt = new Date(event.received_at_epoch_ms || Date.now());
  const windowStart = new Date(receivedAt.getTime() - MATCH_WINDOW_MINUTES * 60_000).toISOString();

  let candidates: any[] | null = null;
  if (!isTestEvent) {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'active')
      .eq('payment_method', 'upi_pending')
      .gte('created_at', windowStart);
    candidates = data;
  }

  let matchedOrder: any = null;
  let matchMethod: string | null = null;
  let ambiguous = false;

  // Priority 1: note reference (AHB-<orderId>) found in the raw SMS/RCS text.
  // (BharatPe's own app notification doesn't carry this — only the SMS/RCS
  // channel does, when present — so this is a bonus signal, not the norm.)
  if (candidates && candidates.length > 0) {
    const noteMatch = event.raw_message?.match(/AHB-(\d+)/);
    if (noteMatch) {
      const refId = parseInt(noteMatch[1], 10);
      const found = candidates.find((o) => o.id === refId);
      if (found && Math.abs(parseFloat(String(found.total)) - amount) < 0.01) {
        matchedOrder = found;
        matchMethod = 'note_reference';
      }
    }
  }

  // Priority 2: exactly one open printed bill with this amount in the window.
  if (!matchedOrder && candidates) {
    const amountMatches = candidates.filter((o) => Math.abs(parseFloat(String(o.total)) - amount) < 0.01);
    if (amountMatches.length === 1) {
      matchedOrder = amountMatches[0];
      matchMethod = 'amount_time_window';
    } else if (amountMatches.length > 1) {
      // 2+ open printed bills share this amount — could be any of them.
      // Do NOT auto-create here: one of these almost certainly IS the real
      // match, so creating a new order on top would double-count revenue
      // that was already counted when that bill was printed.
      ambiguous = true;
    }
    // amountMatches.length === 0 falls through below: no printed bill
    // exists for this amount at all, so it's safe to auto-create one.
  }

  let autoCreatedOrder: any = null;

  if (!isTestEvent && !matchedOrder && !ambiguous) {
    // No open printed bill matches — this was collected without printing.
    // Create the bill directly so it still counts in today's total.
    const saleDate = receivedAt.toISOString().split('T')[0];
    const { data: newOrder, error: createErr } = await supabase
      .from('orders')
      .insert([
        {
          table_number: 0, // no table — this order didn't come from the app
          total: amount,
          status: 'active',
          payment_method: 'upi_confirmed', // already paid, by definition
          bharatpe_utr: event.utr || null,
          source: 'bharatpe',
          created_at: receivedAt.toISOString(),
          user_id: RESTAURANT_USER_ID,
        },
      ])
      .select()
      .single();

    if (createErr) {
      console.error('Auto-create order failed:', createErr);
    } else {
      autoCreatedOrder = newOrder;
      const ledgerOk = await adjustDailySale(saleDate, amount, 1);
      if (ledgerOk) {
        console.log(`Auto-created order ${newOrder.id} for ₹${amount} — added to ${saleDate} total.`);
      } else {
        console.error(
          `Auto-created order ${newOrder.id} for ₹${amount}, but the ${saleDate} ledger total was NOT updated — see the adjustDailySale error above.`
        );
      }
    }
  }

  console.log(
    isTestEvent
      ? 'Test event — inserting for verification, order matching skipped.'
      : matchedOrder
      ? `Match result: matched order ${matchedOrder.id} via ${matchMethod}`
      : autoCreatedOrder
      ? `Match result: no printed bill found — auto-created order ${autoCreatedOrder.id}`
      : ambiguous
      ? 'Match result: ambiguous (2+ open bills same amount) — needs manual review'
      : 'Match result: no match — needs manual review'
  );

  // --- Record the transaction (always, whatever the outcome) ---
  const finalMatchedId = matchedOrder?.id ?? autoCreatedOrder?.id ?? null;
  const finalMatchMethod = isTestEvent ? 'test' : matchedOrder ? matchMethod : autoCreatedOrder ? 'auto_created' : null;

  const { error: insertErr } = await supabase.from('bharatpe_transactions').insert([
    {
      utr: event.utr || null,
      client_event_id: event.client_event_id,
      amount,
      raw_message: event.raw_message,
      sender: event.sender,
      received_at: receivedAt.toISOString(),
      matched_order_id: finalMatchedId,
      match_method: finalMatchMethod,
    },
  ]);

  if (insertErr) {
    // Unique constraint race (two requests for the same txn at once) is
    // fine to treat as a duplicate rather than an error.
    if (insertErr.code === '23505') {
      console.log('Duplicate (race on insert) — treating as already recorded.');
      return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200 });
    }
    console.error('Insert into bharatpe_transactions failed:', insertErr);
    return new Response(JSON.stringify({ ok: false, error: insertErr.message }), { status: 500 });
  }

  console.log(isTestEvent ? 'Test event recorded successfully.' : 'Transaction recorded successfully.');

  // --- If matched to an existing printed bill, settle it (never add new revenue here) ---
  if (matchedOrder) {
    const { error: updateErr } = await supabase
      .from('orders')
      .update({ payment_method: 'upi_confirmed', bharatpe_utr: event.utr || null })
      .eq('id', matchedOrder.id);

    if (updateErr) {
      console.error('Order update failed:', updateErr);
    } else {
      console.log(`Order ${matchedOrder.id} marked upi_confirmed.`);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      matched: !!matchedOrder,
      autoCreated: !!autoCreatedOrder,
      matchMethod: finalMatchMethod,
      orderId: finalMatchedId,
    }),
    { status: 200 }
  );
});
