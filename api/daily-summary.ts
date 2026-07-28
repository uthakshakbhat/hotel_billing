import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Service role key bypasses RLS — this is safe ONLY because this code runs
// server-side (never sent to the browser) and we explicitly scope every
// query below to OWNER_USER_ID ourselves.
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const OWNER_USER_ID = process.env.OWNER_USER_ID!;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const WHATSAPP_RECIPIENT = process.env.WHATSAPP_RECIPIENT!; // your number, digits only, with country code, e.g. 919876543210

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

async function buildSummaryMessage(date: string, hotelName: string): Promise<string> {
  const [{ data: sale }, { data: payments }, { data: expenses }] = await Promise.all([
    supabase.from('daily_sales').select('*').eq('user_id', OWNER_USER_ID).eq('sale_date', date).maybeSingle(),
    supabase
      .from('employee_payments')
      .select('amount, note, employees(name)')
      .eq('user_id', OWNER_USER_ID)
      .eq('paid_date', date),
    supabase.from('cash_expenses').select('description, amount').eq('user_id', OWNER_USER_ID).eq('expense_date', date),
  ]);

  const income = sale ? parseFloat(String(sale.total_amount)) : 0;
  const orderCount = sale ? sale.order_count : 0;
  const totalPayments = (payments ?? []).reduce((s, p) => s + parseFloat(String(p.amount)), 0);
  const totalExpenses = (expenses ?? []).reduce((s, e) => s + parseFloat(String(e.amount)), 0);
  const totalOut = totalPayments + totalExpenses;
  const balance = income - totalOut;

  const fmtDate = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  let msg = `*${hotelName} — Daily Summary*\n${fmtDate}\n\n`;
  msg += `📥 *Bills Collected:* ₹${income.toFixed(0)} (${orderCount} orders)\n\n`;

  if ((payments ?? []).length > 0) {
    msg += `👤 *Staff Payments:*\n`;
    payments!.forEach((p: any) => {
      const name = p.employees?.name ?? 'Unknown';
      msg += `  • ${name} — ₹${parseFloat(p.amount).toFixed(0)}${p.note ? ` (${p.note})` : ''}\n`;
    });
    msg += '\n';
  }

  if ((expenses ?? []).length > 0) {
    msg += `🧾 *Cash Expenses:*\n`;
    expenses!.forEach((e) => {
      msg += `  • ${e.description} — ₹${parseFloat(String(e.amount)).toFixed(0)}\n`;
    });
    msg += '\n';
  }

  msg += `💰 *Total Out:* ₹${totalOut.toFixed(0)}\n`;
  msg += `📊 *Net Balance:* ${balance >= 0 ? '' : '-'}₹${Math.abs(balance).toFixed(0)}`;

  return msg;
}

async function sendWhatsApp(text: string) {
  const url = `https://graph.facebook.com/v25.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: WHATSAPP_RECIPIENT,
      type: 'text',
      text: { body: text },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`WhatsApp send failed: ${JSON.stringify(body)}`);
  return body;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const date = (req.body?.date as string) || todayISO();
    const { data: settings } = await supabase
      .from('restaurant_settings')
      .select('hotel_name')
      .eq('user_id', OWNER_USER_ID)
      .maybeSingle();

    const hotelName = settings?.hotel_name ?? 'Restaurant';
    const message = await buildSummaryMessage(date, hotelName);
    await sendWhatsApp(message);

    return res.status(200).json({ ok: true, message });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Failed to send summary' });
  }
}