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

// Two printed bills for the same table within this window are flagged as a
// possible accidental reprint/duplicate, so staff can spot which one is real
// before marking anything cash or missed.
const DUPLICATE_WINDOW_MS = 15 * 60 * 1000;

export function ReviewBillsTab() {
  const [allOrders, setAllOrders] = useState<HistoryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(item_name, quantity)')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      console.error('Failed to load orders for review:', error);
    }
    setAllOrders((data as HistoryOrder[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 20000);
    return () => clearInterval(interval);
  }, [load]);

  // Needs review = printed and still undecided — not yet marked cash,
  // not auto-confirmed via UPI, not marked as a mistake.
  const reviewOrders = allOrders.filter((o) => o.status === 'active' && o.payment_method === 'upi_pending');

  function nearbyBills(order: HistoryOrder) {
    const t = new Date(order.created_at).getTime();
    return allOrders.filter(
      (other) =>
        other.id !== order.id &&
        other.table_number === order.table_number &&
        Math.abs(new Date(other.created_at).getTime() - t) <= DUPLICATE_WINDOW_MS
    );
  }

  async function handleMiss(orderId: number) {
    if (!confirm('Mark this bill as a mistake? It will be removed from today\'s total.')) return;
    setUpdatingId(orderId);
    try {
      await missBill(orderId);
      setAllOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: 'missed' } : o)));
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
      setAllOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, payment_method: 'cash' } : o)));
    } catch (e: any) {
      alert('Failed to update: ' + e.message);
    } finally {
      setUpdatingId(null);
    }
  }

  if (loading) {
    return <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>Loading...</p>;
  }

  if (reviewOrders.length === 0) {
    return (
      <div className="hist-empty">
        <div>✅</div>
        Nothing to review — every printed bill is settled or marked.
      </div>
    );
  }

  return (
    <>
      {reviewOrders.map((o) => {
        const itemsSummary =
          o.order_items.map((it) => `${it.item_name} x${it.quantity}`).join(', ') ||
          (o.source === 'bharatpe' ? 'No printed bill — payment recorded directly' : '');
        const time = new Date(o.created_at).toLocaleString('en-IN', {
          day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
        });
        const busy = updatingId === o.id;
        const dupes = nearbyBills(o);

        return (
          <div
            key={o.id}
            className="hist-card"
            style={dupes.length > 0 ? { border: '1px solid var(--red)' } : undefined}
          >
            {dupes.length > 0 && (
              <div style={{ color: 'var(--red)', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                ⚠ Possible duplicate — {dupes.length} other bill{dupes.length > 1 ? 's' : ''} for Table {o.table_number} within 15 min:
                {' '}
                {dupes
                  .map((d) => {
                    const dTime = new Date(d.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
                    const dStatus = d.status === 'missed' ? 'missed' : PAYMENT_LABEL[d.payment_method];
                    return `₹${parseFloat(String(d.total)).toFixed(2)} at ${dTime} (${dStatus})`;
                  })
                  .join(', ')}
              </div>
            )}
            <div className="hist-top">
              <div className="hist-tbl">{o.source === 'bharatpe' ? '📲 BharatPe (no bill)' : `Table ${o.table_number}`}</div>
              <div className="hist-time">{time}</div>
            </div>
            <div className="hist-total">
              ₹{parseFloat(String(o.total)).toFixed(2)}
              <span className={`hist-status ${o.payment_method}`} style={{ marginLeft: 8 }}>
                {PAYMENT_LABEL[o.payment_method]}
              </span>
            </div>
            <div className="hist-items">{itemsSummary}</div>
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
          </div>
        );
      })}
    </>
  );
}