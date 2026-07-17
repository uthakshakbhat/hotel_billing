import { useEffect, useState } from 'react';
import type { MenuItem, TableOrder } from '../types';

const TABLES = 10;
const STORAGE_KEY = 'ha_billing_active_orders';
const EXPIRY_HOURS = 6;

function loadPersistedOrders(): TableOrder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return Array.from({ length: TABLES }, () => ({}));
    const parsed = JSON.parse(raw);
    const ageHours = (Date.now() - parsed.savedAt) / 3600000;
    if (ageHours > EXPIRY_HOURS) {
      localStorage.removeItem(STORAGE_KEY);
      return Array.from({ length: TABLES }, () => ({}));
    }
    if (Array.isArray(parsed.orders) && parsed.orders.length === TABLES) {
      return parsed.orders;
    }
  } catch (e) {
    console.error('Could not restore in-progress orders:', e);
  }
  return Array.from({ length: TABLES }, () => ({}));
}

export function useOrders() {
  const [orders, setOrders] = useState<TableOrder[]>(loadPersistedOrders);
  const [currentTable, setCurrentTable] = useState(0);

  // Persist to localStorage every time orders change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), orders }));
    } catch (e) {
      console.error('Could not save in-progress orders locally:', e);
    }
  }, [orders]);

  function addItem(item: MenuItem) {
    setOrders((prev) => {
      const next = [...prev];
      const tableOrder = { ...next[currentTable] };
      tableOrder[item.id] = (tableOrder[item.id] || 0) + 1;
      next[currentTable] = tableOrder;
      return next;
    });
  }

  function changeQty(itemId: number, delta: number) {
    setOrders((prev) => {
      const next = [...prev];
      const tableOrder = { ...next[currentTable] };
      const newQty = (tableOrder[itemId] || 0) + delta;
      if (newQty <= 0) {
        delete tableOrder[itemId];
      } else {
        tableOrder[itemId] = newQty;
      }
      next[currentTable] = tableOrder;
      return next;
    });
  }

  function clearTable(tableIndex: number = currentTable) {
    setOrders((prev) => {
      const next = [...prev];
      next[tableIndex] = {};
      return next;
    });
  }

  function getTotal(tableIndex: number, menuItems: MenuItem[]): number {
    const tableOrder = orders[tableIndex] || {};
    return Object.entries(tableOrder).reduce((sum, [itemId, qty]) => {
      const item = menuItems.find((m) => m.id === Number(itemId));
      return sum + (item ? item.price * qty : 0);
    }, 0);
  }

  function tableHasItems(tableIndex: number): boolean {
    return Object.values(orders[tableIndex] || {}).some((q) => q > 0);
  }

  return {
    orders,
    currentTable,
    setCurrentTable,
    addItem,
    changeQty,
    clearTable,
    getTotal,
    tableHasItems,
    TABLES,
  };
}