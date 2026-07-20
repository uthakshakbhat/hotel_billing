import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { useMenu } from './hooks/useMenu';
import { useOrders } from './hooks/useOrders';
import { useBluetoothPrinter } from './hooks/useBluetoothPrinter';
import { LoginScreen } from './components/Auth/LoginScreen';
import { SetupScreen } from './components/Auth/SetupScreen';
import { CategoryFilter } from './components/Menu/CategoryFilter';
import { MenuGrid } from './components/Menu/MenuGrid';
import { TableBar } from './components/TableBar';
import { BillPanel } from './components/Bill/BillPanel';
import { LedgerModal } from './components/Ledger/LedgerModal';
import { ManageMenuSidebar } from './components/Sidebar/ManageMenuSidebar';

function App() {
  const { loading, user, settings, needsSetup, loginWithGoogle, saveSetup, logout } = useAuth();
  const { items, loading: menuLoading, error: menuError, reload: reloadMenu } = useMenu();
  const {
    orders,
    currentTable,
    setCurrentTable,
    addItem,
    changeQty,
    clearTable,
    getTotal,
    tableHasItems,
    TABLES,
  } = useOrders();
  const { connected: btConnected, deviceName: btDeviceName, connect: connectPrinter, sendBytes } = useBluetoothPrinter();
  const [activeCategory, setActiveCategory] = useState('All');
  const [ledgerOpen, setLedgerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>;
  }

  if (!user) {
    return <LoginScreen onLogin={loginWithGoogle} />;
  }

  if (needsSetup) {
    return <SetupScreen onSave={saveSetup} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <header>
        <div className="brand">
          <div className="brand-icon">🍽</div>
          <div>
            <h1>{settings?.hotel_name}</h1>
            <span>Billing System</span>
          </div>
        </div>
        <div className="header-right">
          <button className="ledger-btn" onClick={() => setLedgerOpen(true)} title="Daily Ledger">📒</button>
          <button className="hamburger-btn" onClick={() => setSidebarOpen(true)} title="Manage Menu">☰</button>
          <button className="hamburger-btn" onClick={logout} title="Sign out">⏻</button>
        </div>
      </header>

      <TableBar
        tableCount={TABLES}
        currentTable={currentTable}
        onSelect={setCurrentTable}
        hasItems={tableHasItems}
      />

      <div className="bill-area" style={{ minHeight: 0, overflowY: 'auto' }}>
        <div className="order-panel" style={{ minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div className="order-header">
            <h2>Menu</h2>
          </div>
          <CategoryFilter activeCategory={activeCategory} onSelect={setActiveCategory} />
          {menuLoading && <p style={{ padding: 20, color: 'var(--text-muted)' }}>Loading menu...</p>}
          {menuError && <p style={{ padding: 20, color: 'var(--red)' }}>Error: {menuError}</p>}
          {!menuLoading && !menuError && (
            <MenuGrid items={items} activeCategory={activeCategory} onAdd={addItem} />
          )}
        </div>

        <BillPanel
          currentTable={currentTable}
          tableOrder={orders[currentTable]}
          menuItems={items}
          total={getTotal(currentTable, items)}
          hotelName={settings?.hotel_name ?? ''}
          upiId={settings?.upi_id ?? ''}
          btConnected={btConnected}
          btDeviceName={btDeviceName}
          onConnectPrinter={connectPrinter}
          sendBytes={sendBytes}
          onChangeQty={changeQty}
          onClearTable={() => clearTable()}
        />
      </div>

      <LedgerModal
        open={ledgerOpen}
        onClose={() => setLedgerOpen(false)}
        hotelName={settings?.hotel_name ?? ''}
        btConnected={btConnected}
        sendBytes={sendBytes}
      />

      <ManageMenuSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        items={items}
        onReload={reloadMenu}
      />
    </div>
  );
}

export default App;