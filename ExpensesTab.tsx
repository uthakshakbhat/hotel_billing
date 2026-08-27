import { useState } from 'react';
import type { useLedger } from '../../hooks/useLedger';

export function ExpensesTab({ ledger }: { ledger: ReturnType<typeof useLedger> }) {
  const { expenses, addExpense } = ledger;
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    const amt = parseFloat(amount);
    if (!description.trim() || !amt || amt <= 0) {
      setError('Enter a description and a valid amount');
      return;
    }
    setSaving(true);
    const result = await addExpense(description.trim(), amt);
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setDescription('');
      setAmount('');
      setError('');
    }
  }

  return (
    <>
      <div className="l-form-row">
        <div className="form-group">
          <label>DESCRIPTION</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. vegetables, gas cylinder" />
        </div>
        <div className="form-group">
          <label>AMOUNT (₹)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </div>
      </div>
      {error && <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>}
      <button className="btn-gold" onClick={handleAdd} disabled={saving}>
        {saving ? 'Saving...' : '+ Add Expense'}
      </button>

      <div className="l-section" style={{ marginTop: 20 }}>
        <div className="l-section-title">Expenses This Day</div>
        {expenses.length === 0 ? (
          <div className="l-empty">No expenses recorded for this day.</div>
        ) : (
          expenses.map((e) => (
            <div key={e.id} className="l-row">
              <div className="l-row-info">
                <div className="l-row-name">{e.description}</div>
              </div>
              <div className="l-row-amount out">−₹{parseFloat(String(e.amount)).toFixed(2)}</div>
            </div>
          ))
        )}
      </div>
    </>
  );
}