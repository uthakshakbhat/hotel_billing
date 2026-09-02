import { OrderHistoryTab } from '../Sidebar/OrderHistoryTab';

interface BillsModalProps {
  open: boolean;
  onClose: () => void;
}

export function BillsModal({ open, onClose }: BillsModalProps) {
  return (
    <div className={`ledger-overlay ${open ? 'open' : ''}`} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ledger-modal">
        <div className="ledger-header">
          <div>
            <h2>🧾 Review Bills</h2>
          </div>
          <button className="ledger-close" onClick={onClose}>✕</button>
        </div>

        <div className="ledger-body">
          {open && <OrderHistoryTab />}
        </div>
      </div>
    </div>
  );
}