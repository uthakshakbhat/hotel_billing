import type { useLedger } from '../../hooks/useLedger';

export function SummaryTab({ ledger }: { ledger: ReturnType<typeof useLedger> }) {
  const { totalIncome, totalOut, balance, payments, expenses, employees, loading } = ledger;

  if (loading) return <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Loading...</p>;

  const transactions = [
    ...payments.map((p) => ({
      type: 'payment' as const,
      name: employees.find((e) => e.id === p.employee_id)?.name ?? 'Unknown',
      sub: p.note,
      amount: p.amount,
    })),
    ...expenses.map((e) => ({
      type: 'expense' as const,
      name: e.description,
      sub: '',
      amount: e.amount,
    })),
  ];

  return (
    <>
      <div className="summary-grid">
        <div className="sum-card income">
          <div className="sum-label">Bills Collected</div>
          <div className="sum-val">₹{totalIncome.toFixed(0)}</div>
        </div>
        <div className="sum-card expense">
          <div className="sum-label">Total Out</div>
          <div className="sum-val">₹{totalOut.toFixed(0)}</div>
        </div>
        <div className={`sum-card ${balance >= 0 ? 'balance' : 'expense'}`}>
          <div className="sum-label">Net Balance</div>
          <div className="sum-val">{balance >= 0 ? '' : '−'}₹{Math.abs(balance).toFixed(0)}</div>
        </div>
        <div className="sum-card neutral">
          <div className="sum-label">Transactions</div>
          <div className="sum-val">{transactions.length}</div>
        </div>
      </div>

      <div className="l-section">
        <div className="l-section-title">Today's Transactions</div>
        {transactions.length === 0 ? (
          <div className="l-empty">No transactions recorded for this day.</div>
        ) : (
          transactions.map((t, i) => (
            <div key={i} className="l-row">
              <div className="l-row-info">
                <div className="l-row-name">{t.name}</div>
                {t.sub && <div className="l-row-sub">{t.sub}</div>}
              </div>
              <div className="l-row-amount out">−₹{parseFloat(String(t.amount)).toFixed(2)}</div>
            </div>
          ))
        )}
      </div>
    </>
  );
}