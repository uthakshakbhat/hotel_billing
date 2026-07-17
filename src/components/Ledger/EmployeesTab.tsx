import { useState } from 'react';
import type { useLedger } from '../../hooks/useLedger';

export function EmployeesTab({ ledger }: { ledger: ReturnType<typeof useLedger> }) {
  const { employees, payments, addPayment } = ledger;
  const activeEmployees = employees.filter((e) => e.active);
  const [employeeId, setEmployeeId] = useState<number | ''>('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    const amt = parseFloat(amount);
    if (!employeeId || !amt || amt <= 0) {
      setError('Select an employee and enter a valid amount');
      return;
    }
    setSaving(true);
    const result = await addPayment(Number(employeeId), amt, note);
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setAmount('');
      setNote('');
      setEmployeeId('');
      setError('');
    }
  }

  return (
    <>
      <div className="l-form-row">
        <div className="form-group">
          <label>EMPLOYEE</label>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Select...</option>
            {activeEmployees.map((e) => (
              <option key={e.id} value={e.id}>{e.name} ({e.role})</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>AMOUNT (₹)</label>
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
        </div>
      </div>
      <div className="form-group">
        <label>NOTE (OPTIONAL)</label>
        <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. advance, salary" />
      </div>
      {error && <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>}
      <button className="btn-gold" onClick={handleAdd} disabled={saving}>
        {saving ? 'Saving...' : '+ Add Payment'}
      </button>

      <div className="l-section" style={{ marginTop: 20 }}>
        <div className="l-section-title">Payments This Day</div>
        {payments.length === 0 ? (
          <div className="l-empty">No payments recorded for this day.</div>
        ) : (
          payments.map((p) => (
            <div key={p.id} className="l-row">
              <div className="l-row-info">
                <div className="l-row-name">{employees.find((e) => e.id === p.employee_id)?.name ?? 'Unknown'}</div>
                {p.note && <div className="l-row-sub">{p.note}</div>}
              </div>
              <div className="l-row-amount out">−₹{parseFloat(String(p.amount)).toFixed(2)}</div>
            </div>
          ))
        )}
      </div>
    </>
  );
}