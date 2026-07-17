import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface HistoryOrder {
  id: number;
  table_number: number;
  total: number;
  status: 'printed' | 'paid';
  created_at: string;
  order_items: { item_name: string; quantity: number }[];
}

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
  }, [loadHistory]);

  async function markPaid(orderId: number) {
    setUpdatingId(orderId);
    const { error } = await supabase.from('orders').update({ status: 'paid' }).eq('id', orderId);
    setUpdatingId(null);
    if (error) {
      alert('Failed to update: ' + error.message);
      return;
    }
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: 'paid' } : o)));
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
        const itemsSummary = o.order_items.map((it) => `${it.item_name} x${it.quantity}`).join(', ');
        const time = new Date(o.created_at).toLocaleString('en-IN', {
          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
        });
        return (
          <div key={o.id} className="hist-card">
            <div className="hist-top">
              <div className="hist-tbl">Table {o.table_number}</div>
              <div className="hist-time">{time}</div>
            </div>
            <div className="hist-total">
              ₹{parseFloat(String(o.total)).toFixed(2)}
              <span className={`hist-status ${o.status}`} style={{ marginLeft: 8 }}>
                {o.status.toUpperCase()}
              </span>
            </div>
            <div className="hist-items">{itemsSummary}</div>
            {o.status === 'printed' && (
              <button className="mark-paid-btn" onClick={() => markPaid(o.id)} disabled={updatingId === o.id}>
                {updatingId === o.id ? 'Saving...' : '✓ Mark as Paid'}
              </button>
            )}
          </div>
        );
      })}
    </>
  );
}