import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { missBill, markCash } from '../../utils/saveOrder';

interface HistoryOrder {
  id: number;
  table_number: number;
  source: 'app' | 'bharatpe';
  total: number;
  status: 'active' | 'missed';
  payment_method: 'cash' | 'upi_pending' | 'upi_confirmed';
  created_at: string;
  order_items: { item_name: string; quantity: number }[];
}

const PAYMENT_LABEL: Record<HistoryOrder['payment_method'], string> = {
  cash: '💵 CASH',
  upi_pending: '⏳ UPI PENDING',
  upi_confirmed: '✓ UPI CONFIRMED',
};

export function OrderHistoryTab() {
  const [orders, setOrders] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(item_name, quantity)')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) {
      console.error('Failed to load order history:', error);
    }
    setOrders((data as HistoryOrder[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadHistory();
    // Orders can flip to 'upi_confirmed' in the background as BharatPe
    // transactions get matched, so refresh periodically instead of only
    // on manual actions.
    const interval = setInterval(loadHistory, 20000);
    return () => clearInterval(interval);
  }, [loadHistory]);

  async function handleMiss(orderId: number) {
    if (!confirm('Mark this bill as a mistake? It will be removed from today\'s total.')) return;
    setUpdatingId(orderId);
    try {
      await missBill(orderId);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: 'missed' } : o)));
    } catch (e: any) {
      alert('Failed to update: ' + e.message);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleCash(orderId: number) {
    setUpdatingId(orderId);
    try {
      await markCash(orderId);
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, payment_method: 'cash' } : o)));
    } catch (e: any) {
      alert('Failed to update: ' + e.message);
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Loading history...</p>;
  }

  if (orders.length === 0) {
    return (
      <div className="hist-empty">
        <div>🧾</div>
        No orders printed yet.
      </div>
    );
  }

  return (
    <>
      {orders.map((o) => {
        const itemsSummary =
          o.order_items.map((it) => `${it.item_name} x${it.quantity}`).join(', ') ||
          (o.source === 'bharatpe' ? 'No printed bill — payment recorded directly' : '');
        const time = new Date(o.created_at).toLocaleString('en-IN', {
          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
        });
        const busy = updatingId === o.id;
        return (
          <div key={o.id} className="hist-card">
            <div className="hist-top">
              <div className="hist-tbl">{o.source === 'bharatpe' ? '📲 BharatPe (no bill)' : `Table ${o.table_number}`}</div>
              <div className="hist-time">{time}</div>
            </div>
            <div className="hist-total">
              ₹{parseFloat(String(o.total)).toFixed(2)}
              <span className={`hist-status ${o.status === 'missed' ? 'missed' : o.payment_method}`} style={{ marginLeft: 8 }}>
                {o.status === 'missed' ? 'MISSED' : PAYMENT_LABEL[o.payment_method]}
              </span>
            </div>
            <div className="hist-items">{itemsSummary}</div>
            {o.status === 'active' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                {o.payment_method === 'upi_pending' && (
                  <button className="mark-paid-btn" onClick={() => handleCash(o.id)} disabled={busy} style={{ flex: 1 }}>
                    {busy ? '...' : '💵 Cash'}
                  </button>
                )}
                <button
                  className="mark-paid-btn"
                  onClick={() => handleMiss(o.id)}
                  disabled={busy}
                  style={{ flex: 1, background: 'var(--red)' }}
                >
                  {busy ? '...' : '✕ Miss Bill'}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
