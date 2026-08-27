import { useState } from 'react';
import type { useLedger } from '../../hooks/useLedger';

export function StaffListTab({ ledger }: { ledger: ReturnType<typeof useLedger> }) {
  const { employees, addEmployee, toggleEmployeeActive } = ledger;
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    if (!name.trim() || !role.trim()) {
      setError('Enter both name and role');
      return;
    }
    setSaving(true);
    const result = await addEmployee(name.trim(), role.trim());
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setName('');
      setRole('');
      setError('');
    }
  }

  return (
    <>
      <div className="l-form-row">
        <div className="form-group">
          <label>NAME</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ramesh" />
        </div>
        <div className="form-group">
          <label>ROLE</label>
          <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Cook, Waiter" />
        </div>
      </div>
      {error && <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>}
      <button className="btn-gold" onClick={handleAdd} disabled={saving}>
        {saving ? 'Saving...' : '+ Add Staff Member'}
      </button>

      <div className="l-section" style={{ marginTop: 20 }}>
        <div className="l-section-title">All Staff</div>
        {employees.length === 0 ? (
          <div className="l-empty">No staff added yet.</div>
        ) : (
          employees.map((emp) => (
            <div key={emp.id} className="l-row">
              <div className="l-row-info">
                <div className="l-row-name">{emp.name}</div>
                <div className="l-row-sub">{emp.role}</div>
              </div>
              <button
                className="btn-outline"
                style={{ width: 'auto', margin: 0, padding: '6px 12px', fontSize: 13 }}
                onClick={() => toggleEmployeeActive(emp.id, !emp.active)}
              >
                {emp.active ? 'Active' : 'Inactive'}
              </button>
            </div>
          ))
        )}
      </div>
    </>
  );
}