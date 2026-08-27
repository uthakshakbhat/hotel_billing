import { useState } from 'react';
import { useLedger } from '../../hooks/useLedger';
import { SummaryTab } from './SummaryTab';
import { EmployeesTab } from './EmployeesTab';
import { ExpensesTab } from './ExpensesTab';
import { StaffListTab } from './StaffListTab';
import { ReportsTab } from './ReportsTab';

type LedgerTab = 'summary' | 'employees' | 'expenses' | 'manage' | 'reports';

interface LedgerModalProps {
  open: boolean;
  onClose: () => void;
  hotelName: string;
  btConnected: boolean;
  sendBytes: (bytes: Uint8Array) => Promise<void>;
}

export function LedgerModal({ open, onClose, hotelName, btConnected, sendBytes }: LedgerModalProps) {
  const [tab, setTab] = useState<LedgerTab>('summary');
  const ledger = useLedger();

  const dateFormatted = new Date(ledger.ledgerDate + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className={`ledger-overlay ${open ? 'open' : ''}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ledger-modal">
        <div className="ledger-header">
          <div>
            <h2>📒 Daily Cash Ledger</h2>
            <div className="ledger-date">{dateFormatted}</div>
          </div>
          <button className="ledger-close" onClick={onClose}>✕</button>
        </div>

        <div className="ledger-nav">
          <button className="ln-arrow" onClick={() => ledger.changeLedgerDate(-1)}>‹</button>
          <input
            type="date"
            value={ledger.ledgerDate}
            onChange={(e) => ledger.setLedgerDate(e.target.value)}
            style={{ flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 8, padding: '7px 8px', fontSize: 14, fontFamily: 'inherit' }}
          />
          <button className="ln-arrow" onClick={() => ledger.changeLedgerDate(1)}>›</button>
          <button className="ln-today" onClick={() => ledger.setLedgerDate(new Date().toISOString().split('T')[0])}>Today</button>
        </div>

        <div className="ledger-tabs">
          <button className={`ltab ${tab === 'summary' ? 'active' : ''}`} onClick={() => setTab('summary')}>Summary</button>
          <button className={`ltab ${tab === 'employees' ? 'active' : ''}`} onClick={() => setTab('employees')}>Employees</button>
          <button className={`ltab ${tab === 'expenses' ? 'active' : ''}`} onClick={() => setTab('expenses')}>Expenses</button>
          <button className={`ltab ${tab === 'manage' ? 'active' : ''}`} onClick={() => setTab('manage')}>Staff List</button>
          <button className={`ltab ${tab === 'reports' ? 'active' : ''}`} onClick={() => setTab('reports')}>Reports</button>
        </div>

        <div className="ledger-body">
          {tab === 'summary' && <SummaryTab ledger={ledger} />}
          {tab === 'employees' && <EmployeesTab ledger={ledger} />}
          {tab === 'expenses' && <ExpensesTab ledger={ledger} />}
          {tab === 'manage' && <StaffListTab ledger={ledger} />}
          {tab === 'reports' && (
            <ReportsTab hotelName={hotelName} btConnected={btConnected} sendBytes={sendBytes} />
          )}
        </div>
      </div>
    </div>
  );
}