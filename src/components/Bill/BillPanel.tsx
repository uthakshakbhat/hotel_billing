import { useState } from 'react';
import type { MenuItem, TableOrder } from '../../types';
import { buildBillEscPosBytes } from '../../utils/escpos';
import { saveOrderToDB } from '../../utils/saveOrder';

interface BillPanelProps {
  currentTable: number;
  tableOrder: TableOrder;
  menuItems: MenuItem[];
  total: number;
  hotelName: string;
  upiId: string;
  btConnected: boolean;
  btDeviceName: string | null;
  onConnectPrinter: () => void;
  sendBytes: (bytes: Uint8Array) => Promise<void>;
  onChangeQty: (itemId: number, delta: number) => void;
  onClearTable: () => void;
}

export function BillPanel({
  currentTable,
  tableOrder,
  menuItems,
  total,
  hotelName,
  upiId,
  btConnected,
  btDeviceName,
  onConnectPrinter,
  sendBytes,
  onChangeQty,
  onClearTable,
}: BillPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [printing, setPrinting] = useState(false);

  function toggleCollapse() {
    if (window.innerWidth > 640) return; // desktop: no-op, matches old app
    setCollapsed((c) => !c);
  }

  const lineItems = Object.entries(tableOrder)
    .filter(([, qty]) => qty > 0)
    .map(([itemId, qty]) => {
      const item = menuItems.find((m) => m.id === Number(itemId));
      return item ? { item, qty } : null;
    })
    .filter((x): x is { item: MenuItem; qty: number } => x !== null);

  async function handlePrint() {
    if (!btConnected) {
      alert('Connect the Bluetooth printer first');
      return;
    }
    setPrinting(true);
    try {
      const bytes = await buildBillEscPosBytes({
        tableOrder,
        menuItems,
        tableNumber: currentTable + 1,
        hotelName,
        upiId,
      });
      try {
        await saveOrderToDB(currentTable + 1, tableOrder, menuItems);
      } catch (e) {
        console.error('Order save failed:', e);
      }
      await sendBytes(bytes);
    } catch (e) {
      console.error(e);
      alert('Print failed — try reconnecting the printer');
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div
      className={`bill-panel ${collapsed ? 'bp-collapsed' : ''}`}
      style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <div className="bill-top" onClick={toggleCollapse} style={{ flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <h3>Bill Summary</h3>
            <div className="tbl-label">Table {currentTable + 1}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span className="bp-mini-total" style={{ display: 'inline-block' }}>₹{total.toFixed(2)}</span>
            <span className="bp-chevron" style={{ display: 'inline-block', transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
          </div>
        </div>
      </div>

      {!collapsed && (
        <>
          <div className="bill-items" style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
            {lineItems.length === 0 ? (
              <div className="empty-bill">
                <div>🧾</div>
                No items added yet
              </div>
            ) : (
              lineItems.map(({ item, qty }) => (
                <div key={item.id} className="item-actions" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                  <div className="item-info">
                    <div className="item-name">{item.name}</div>
                    <div className="item-price">₹{(item.price * qty).toFixed(2)}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <button className="qty-btn" onClick={() => onChangeQty(item.id, -1)}>−</button>
                    <span style={{ minWidth: 20, textAlign: 'center' }}>{qty}</span>
                    <button className="qty-btn" onClick={() => onChangeQty(item.id, 1)}>+</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="bill-footer" style={{ flexShrink: 0 }}>
            <div className="subtotals">
              <div className="st-row total">
                <span>Total</span>
                <span>₹{total.toFixed(2)}</span>
              </div>
            </div>
            <button className="print-btn" disabled={total <= 0 || !btConnected || printing} onClick={handlePrint}>
              {printing ? 'Printing...' : '🔵 Print to Thermal Printer'}
            </button>
            {lineItems.length > 0 && (
              <button className="print-btn" onClick={onClearTable} style={{ marginTop: 6 }}>
                Clear Table
              </button>
            )}
          </div>

          <div id="bt-status" style={{ flexShrink: 0, padding: '0 14px 12px', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            {btConnected ? (
              `🔵 Connected to ${btDeviceName}`
            ) : (
              <>
                Bluetooth printer not connected —{' '}
                <span style={{ color: 'var(--gold)', cursor: 'pointer', textDecoration: 'underline' }} onClick={onConnectPrinter}>
                  tap to connect
                </span>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}