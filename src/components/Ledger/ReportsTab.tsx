import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { buildReportEscPosBytes } from '../../utils/escpos';
import { printReportInBrowser } from '../../utils/printReport';

type Range = 'week' | 'month' | 'custom';

function getRangeDates(range: Range) {
  const end = new Date();
  const start = new Date();
  if (range === 'week') start.setDate(end.getDate() - 6);
  if (range === 'month') start.setDate(end.getDate() - 29);
  const toISO = (d: Date) => d.toISOString().split('T')[0];
  return { from: toISO(start), to: toISO(end) };
}

interface ReportsTabProps {
  hotelName: string;
  btConnected: boolean;
  sendBytes: (bytes: Uint8Array) => Promise<void>;
}

export function ReportsTab({ hotelName, btConnected, sendBytes }: ReportsTabProps) {
  const [range, setRange] = useState<Range>('week');
  const [customFrom, setCustomFrom] = useState(getRangeDates('week').from);
  const [customTo, setCustomTo] = useState(getRangeDates('week').to);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    from: string; to: string;
    totalIncome: number; totalOrders: number; totalOut: number; balance: number;
    dateRows: { date: string; in: number; out: number }[];
  } | null>(null);

  async function loadReport() {
    setLoading(true);
    const { from, to } = range === 'custom' ? { from: customFrom, to: customTo } : getRangeDates(range);

    const [{ data: sales }, { data: empPay }, { data: cashExp }] = await Promise.all([
      supabase.from('daily_sales').select('*').gte('sale_date', from).lte('sale_date', to),
      supabase.from('employee_payments').select('amount, paid_date').gte('paid_date', from).lte('paid_date', to),
      supabase.from('cash_expenses').select('amount, expense_date').gte('expense_date', from).lte('expense_date', to),
    ]);

    const totalIncome = (sales ?? []).reduce((s, r) => s + parseFloat(String(r.total_amount)), 0);
    const totalOrders = (sales ?? []).reduce((s, r) => s + r.order_count, 0);
    const totalEmpPay = (empPay ?? []).reduce((s, r) => s + parseFloat(String(r.amount)), 0);
    const totalExp = (cashExp ?? []).reduce((s, r) => s + parseFloat(String(r.amount)), 0);
    const totalOut = totalEmpPay + totalExp;
    const balance = totalIncome - totalOut;

    const byDate: Record<string, { in: number; out: number }> = {};
    (sales ?? []).forEach((r) => {
      byDate[r.sale_date] = byDate[r.sale_date] || { in: 0, out: 0 };
      byDate[r.sale_date].in += parseFloat(String(r.total_amount));
    });
    (empPay ?? []).forEach((r) => {
      byDate[r.paid_date] = byDate[r.paid_date] || { in: 0, out: 0 };
      byDate[r.paid_date].out += parseFloat(String(r.amount));
    });
    (cashExp ?? []).forEach((r) => {
      byDate[r.expense_date] = byDate[r.expense_date] || { in: 0, out: 0 };
      byDate[r.expense_date].out += parseFloat(String(r.amount));
    });

    const dateRows = Object.entries(byDate)
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([date, v]) => ({ date, ...v }));

    setData({ from, to, totalIncome, totalOrders, totalOut, balance, dateRows });
    setLoading(false);
  }

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  async function printThermal() {
    if (!data) return;
    if (!btConnected) {
      alert('Connect the Bluetooth printer first');
      return;
    }
    try {
      const bytes = buildReportEscPosBytes({
        from: data.from, to: data.to, income: data.totalIncome, out: data.totalOut,
        balance: data.balance, ordersCount: data.totalOrders, hotelName,
      });
      await sendBytes(bytes);
    } catch (e) {
      console.error(e);
      alert('Print failed — check printer connection');
    }
  }

  return (
    <>
      <div className="l-form-row" style={{ marginBottom: 14 }}>
        <button className={`cf-btn ${range === 'week' ? 'active' : ''}`} onClick={() => setRange('week')}>This Week</button>
        <button className={`cf-btn ${range === 'month' ? 'active' : ''}`} onClick={() => setRange('month')}>This Month</button>
        <button className={`cf-btn ${range === 'custom' ? 'active' : ''}`} onClick={() => setRange('custom')}>Custom</button>
      </div>

      {range === 'custom' && (
        <>
          <div className="l-form-row" style={{ marginBottom: 14 }}>
            <div className="form-group">
              <label>FROM</label>
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </div>
            <div className="form-group">
              <label>TO</label>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          </div>
          <button className="btn-outline" style={{ marginBottom: 14 }} onClick={loadReport}>Apply Range</button>
        </>
      )}

      {loading || !data ? (
        <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading report...</p>
      ) : (
        <>
          <div className="summary-grid">
            <div className="sum-card income"><div className="sum-label">Bills Collected</div><div className="sum-val">₹{data.totalIncome.toFixed(0)}</div></div>
            <div className="sum-card neutral"><div className="sum-label">Total Orders</div><div className="sum-val">{data.totalOrders}</div></div>
            <div className="sum-card expense"><div className="sum-label">Total Out</div><div className="sum-val">₹{data.totalOut.toFixed(0)}</div></div>
            <div className={`sum-card ${data.balance >= 0 ? 'balance' : 'expense'}`}><div className="sum-label">Net Balance</div><div className="sum-val">{data.balance >= 0 ? '' : '−'}₹{Math.abs(data.balance).toFixed(0)}</div></div>
          </div>

          <div className="l-section">
            <div className="l-section-title">Day-wise Breakdown</div>
            {data.dateRows.length === 0 ? (
              <div className="l-empty">No records in this range.</div>
            ) : (
              data.dateRows.map((row) => (
                <div key={row.date} className="l-row">
                  <div className="l-row-info">
                    <div className="l-row-name">{new Date(row.date + 'T00:00:00').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                  </div>
                  <div className="l-row-amount in" style={{ marginRight: 6 }}>+₹{row.in.toFixed(0)}</div>
                  <div className="l-row-amount out">−₹{row.out.toFixed(0)}</div>
                </div>
              ))
            )}
          </div>

          <button className="btn-gold" onClick={() => printReportInBrowser(data.from, data.to, data.totalIncome, data.totalOut, data.balance, data.totalOrders, hotelName)}>
            🖨 Print This Report
          </button>
          <button className="print-btn" style={{ marginTop: 8 }} onClick={printThermal}>
            🔵 Print via Thermal Printer
          </button>
        </>
      )}
    </>
  );
}