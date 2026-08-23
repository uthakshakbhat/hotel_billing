// Supabase Edge Function — deploy with:
//   supabase functions deploy bharatpe-webhook
//
// Required secrets (set with `supabase secrets set KEY=value`):
//   BHARATPE_SHARED_SECRET   — must match what's configured in the Android app
//   SUPABASE_URL              — usually auto-provided by the platform
//   SUPABASE_SERVICE_ROLE_KEY — service role key (bypasses RLS; needed to write)
//
// This function is the ONLY thing that ever creates a daily_sales entry
// from a BharatPe transaction — it never adds new revenue on its own. It
// only settles an order that was already counted when the bill was
// printed. That's what prevents double-counting.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SHARED_SECRET = Deno.env.get('BHARATPE_SHARED_SECRET')!;

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

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const providedSecret = req.headers.get('X-Shared-Secret');
  if (!SHARED_SECRET || providedSecret !== SHARED_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  let event: IncomingEvent;
  try {
    event = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const amount = parseFloat(event.amount);
  if (!amount || amount <= 0) {
    return new Response(JSON.stringify({ ok: false, reason: 'invalid amount' }), { status: 400 });
  }

  // Test events from the app's "Send Test Event" button — acknowledge but
  // never let them touch real order data.
  if (event.sender === 'TEST') {
    return new Response(JSON.stringify({ ok: true, test: true }), { status: 200 });
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
    return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200 });
  }

  // --- Try to match against an open, unconfirmed order ---
  const receivedAt = new Date(event.received_at_epoch_ms || Date.now());
  const windowStart = new Date(receivedAt.getTime() - MATCH_WINDOW_MINUTES * 60_000).toISOString();

  const { data: candidates } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'active')
    .eq('payment_method', 'upi_pending')
    .gte('created_at', windowStart);

  let matchedOrder: any = null;
  let matchMethod: string | null = null;

  // Priority 1: note reference (AHB-<orderId>) found in the raw SMS text.
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

  // Priority 2: exactly one open order with this amount in the time window.
  if (!matchedOrder && candidates) {
    const amountMatches = candidates.filter((o) => Math.abs(parseFloat(String(o.total)) - amount) < 0.01);
    if (amountMatches.length === 1) {
      matchedOrder = amountMatches[0];
      matchMethod = 'amount_time_window';
    }
    // 0 or 2+ candidates: ambiguous or no match — leave for manual review
    // rather than guessing.
  }

  // --- Record the transaction (always, matched or not) ---
  const { error: insertErr } = await supabase.from('bharatpe_transactions').insert([
    {
      utr: event.utr || null,
      client_event_id: event.client_event_id,
      amount,
      raw_message: event.raw_message,
      sender: event.sender,
      received_at: receivedAt.toISOString(),
      matched_order_id: matchedOrder?.id ?? null,
      match_method: matchMethod,
    },
  ]);

  if (insertErr) {
    // Unique constraint race (two requests for the same txn at once) is
    // fine to treat as a duplicate rather than an error.
    if (insertErr.code === '23505') {
      return new Response(JSON.stringify({ ok: true, duplicate: true }), { status: 200 });
    }
    console.error('Insert failed:', insertErr);
    return new Response(JSON.stringify({ ok: false, error: insertErr.message }), { status: 500 });
  }

  // --- If matched, settle the order (never insert new revenue here) ---
  if (matchedOrder) {
    const { error: updateErr } = await supabase
      .from('orders')
      .update({ payment_method: 'upi_confirmed', bharatpe_utr: event.utr || null })
      .eq('id', matchedOrder.id);

    if (updateErr) {
      console.error('Order update failed:', updateErr);
    }
  }

  return new Response(
    JSON.stringify({ ok: true, matched: !!matchedOrder, matchMethod, orderId: matchedOrder?.id ?? null }),
    { status: 200 }
  );
});
