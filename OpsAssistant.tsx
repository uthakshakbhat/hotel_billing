import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { CATEGORIES } from '../../utils/constants';

interface Message {
  role: 'user' | 'assistant';
  text: string;
}

interface OpsAssistantProps {
  open: boolean;
  onClose: () => void;
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

export function OpsAssistant({ open, onClose }: OpsAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: 'Hi! Try things like "add ₹500 vegetable expense" or "how much did we make this week?"' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  function pushMessage(msg: Message) {
    setMessages((prev) => [...prev, msg]);
  }

  async function executeFunctionCall(name: string, args: any): Promise<string> {
    switch (name) {
      case 'add_cash_expense': {
        const { error } = await supabase
          .from('cash_expenses')
          .insert([{ description: args.description, amount: args.amount, expense_date: todayISO() }]);
        if (error) return `Couldn't save that expense: ${error.message}`;
        return `Done — recorded ₹${args.amount} for "${args.description}" today.`;
      }

      case 'add_employee_payment': {
        const { data: employees } = await supabase
          .from('employees')
          .select('id, name')
          .ilike('name', `%${args.employee_name}%`);
        if (!employees || employees.length === 0) {
          return `I couldn't find a staff member named "${args.employee_name}". Add them first in Staff List.`;
        }
        if (employees.length > 1) {
          return `Found multiple staff matching "${args.employee_name}": ${employees.map((e) => e.name).join(', ')}. Please be more specific.`;
        }
        const { error } = await supabase
          .from('employee_payments')
          .insert([{ employee_id: employees[0].id, amount: args.amount, note: args.note ?? '', paid_date: todayISO() }]);
        if (error) return `Couldn't save that payment: ${error.message}`;
        return `Done — recorded ₹${args.amount} payment to ${employees[0].name} today.`;
      }

      case 'add_menu_item': {
        if (!CATEGORIES.includes(args.category)) {
          return `"${args.category}" isn't a valid category. Use one of: ${CATEGORIES.join(', ')}`;
        }
        const { error } = await supabase
          .from('menu_items')
          .insert([{ name: args.name, price: args.price, category: args.category }]);
        if (error) return `Couldn't add that item: ${error.message}`;
        return `Done — added "${args.name}" (₹${args.price}) to ${args.category}.`;
      }

      case 'get_summary': {
        const [{ data: sales }, { data: empPay }, { data: cashExp }] = await Promise.all([
          supabase.from('daily_sales').select('total_amount').gte('sale_date', args.from).lte('sale_date', args.to),
          supabase.from('employee_payments').select('amount').gte('paid_date', args.from).lte('paid_date', args.to),
          supabase.from('cash_expenses').select('amount').gte('expense_date', args.from).lte('expense_date', args.to),
        ]);
        const income = (sales ?? []).reduce((s, r) => s + parseFloat(String(r.total_amount)), 0);
        const out =
          (empPay ?? []).reduce((s, r) => s + parseFloat(String(r.amount)), 0) +
          (cashExp ?? []).reduce((s, r) => s + parseFloat(String(r.amount)), 0);
        const balance = income - out;
        const rangeLabel = args.from === args.to ? `on ${args.from}` : `from ${args.from} to ${args.to}`;
        return `${rangeLabel}: ₹${income.toFixed(0)} collected, ₹${out.toFixed(0)} spent, net balance ₹${balance.toFixed(0)}.`;
      }

      default:
        return `I don't know how to do "${name}" yet.`;
    }
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    pushMessage({ role: 'user', text });
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();

      if (data.type === 'function_call') {
        const resultText = await executeFunctionCall(data.name, data.args);
        pushMessage({ role: 'assistant', text: resultText });
      } else if (data.type === 'text') {
        pushMessage({ role: 'assistant', text: data.text });
      } else {
        pushMessage({ role: 'assistant', text: data.error || 'Something went wrong.' });
      }
    } catch (e) {
      console.error(e);
      pushMessage({ role: 'assistant', text: 'Could not reach the assistant — check your connection.' });
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="ledger-overlay open" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ledger-modal" style={{ maxWidth: 420, display: 'flex', flexDirection: 'column' }}>
        <div className="ledger-header">
          <h2>🤖 Ops Assistant</h2>
          <button className="ledger-close" onClick={onClose}>✕</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.map((m, i) => (
            <div
              key={i}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                background: m.role === 'user' ? 'var(--gold-dim)' : 'var(--surface2)',
                color: 'var(--text)',
                padding: '8px 12px',
                borderRadius: 10,
                maxWidth: '85%',
                fontSize: 14,
              }}
            >
              {m.text}
            </div>
          ))}
          {loading && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Thinking...</div>}
        </div>

        <div style={{ display: 'flex', gap: 8, padding: 14, borderTop: '1px solid var(--border)' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type a command or question..."
            style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '10px 12px', fontSize: 14 }}
          />
          <button className="btn-gold" style={{ width: 'auto', margin: 0, padding: '0 18px' }} onClick={handleSend} disabled={loading}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}