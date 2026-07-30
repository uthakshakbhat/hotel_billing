import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const OWNER_USER_ID = process.env.OWNER_USER_ID!;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID!;
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN!;
const WHATSAPP_RECIPIENTS = (process.env.WHATSAPP_RECIPIENTS ?? '').split(',').map((n) => n.trim()).filter(Boolean);

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

interface SummaryData {
  hotelName: string;
  fmtDate: string;
  statsBlock: string;
}

async function buildSummaryData(date: string, hotelName: string): Promise<SummaryData> {
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

  const lines: string[] = [];
  lines.push(`Bills Collected: Rs.${income.toFixed(0)} (${orderCount} orders)`);

  if ((payments ?? []).length > 0) {
    lines.push('');
    lines.push('Staff Payments:');
    payments!.forEach((p: any) => {
      const name = p.employees?.name ?? 'Unknown';
      lines.push(`- ${name}: Rs.${parseFloat(p.amount).toFixed(0)}${p.note ? ` (${p.note})` : ''}`);
    });
  }
  if ((expenses ?? []).length > 0) {
    lines.push('');
    lines.push('Cash Expenses:');
    expenses!.forEach((e) => {
      lines.push(`- ${e.description}: Rs.${parseFloat(String(e.amount)).toFixed(0)}`);
    });
  }

  lines.push('');
  lines.push(`Total Out: Rs.${totalOut.toFixed(0)}`);
  lines.push(`Net Balance: ${balance >= 0 ? '' : '-'}Rs.${Math.abs(balance).toFixed(0)}`);

  return { hotelName, fmtDate, statsBlock: lines.join('\n') };
}

async function sendTemplateTo(recipient: string, data: SummaryData) {
  const url = `https://graph.facebook.com/v25.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: recipient,
      type: 'template',
      template: {
        name: 'daily_summary',
        language: { code: 'en' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: data.hotelName },
              { type: 'text', text: data.fmtDate },
              { type: 'text', text: data.statsBlock },
            ],
          },
        ],
      },
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`WhatsApp send to ${recipient} failed: ${JSON.stringify(body)}`);
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
    const summary = await buildSummaryData(date, hotelName);

    if (WHATSAPP_RECIPIENTS.length === 0) {
      return res.status(400).json({ error: 'No recipients configured (WHATSAPP_RECIPIENTS is empty)' });
    }

    const results = await Promise.allSettled(WHATSAPP_RECIPIENTS.map((r) => sendTemplateTo(r, summary)));
    const failures = results
      .map((r, i) => (r.status === 'rejected' ? `${WHATSAPP_RECIPIENTS[i]}: ${(r as PromiseRejectedResult).reason}` : null))
      .filter(Boolean);

    if (failures.length > 0) {
      return res.status(207).json({ ok: false, sentTo: WHATSAPP_RECIPIENTS.length - failures.length, failures });
    }
    return res.status(200).json({ ok: true, sentTo: WHATSAPP_RECIPIENTS.length });
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ error: e.message || 'Failed to send summary' });
  }
}