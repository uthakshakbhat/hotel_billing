import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { CATEGORIES } from '../../utils/constants';
import type { MenuItem } from '../../types';
import { OrderHistoryTab } from './OrderHistoryTab';

type SidebarTab = 'add' | 'manage' | 'history';

interface ManageMenuSidebarProps {
  open: boolean;
  onClose: () => void;
  items: MenuItem[];
  onReload: () => void;
}

export function ManageMenuSidebar({ open, onClose, items, onReload }: ManageMenuSidebarProps) {
  const [tab, setTab] = useState<SidebarTab>('add');

  return (
    <>
      <div className={`sidebar-overlay ${open ? 'open' : ''}`} onClick={onClose}></div>
      <aside className={open ? 'open' : ''}>
        <div className="sidebar-header">
          <h2>Manage Menu</h2>
          <button className="close-sidebar" onClick={onClose}>✕</button>
        </div>
        <div className="sidebar-tabs">
          <button className={`stab ${tab === 'add' ? 'active' : ''}`} onClick={() => setTab('add')}>Add Item</button>
          <button className={`stab ${tab === 'manage' ? 'active' : ''}`} onClick={() => setTab('manage')}>Manage</button>
          <button className={`stab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}>History</button>
        </div>
        <div className="sidebar-content">
          {tab === 'add' && <AddItemForm onAdded={onReload} />}
          {tab === 'manage' && <ManageItemsList items={items} onChanged={onReload} />}
          {tab === 'history' && <OrderHistoryTab />}
        </div>
      </aside>
    </>
  );
}

function AddItemForm({ onAdded }: { onAdded: () => void }) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleAdd() {
    const p = parseFloat(price);
    if (!name.trim() || !p || p <= 0) {
      setError('Enter a valid name and price');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('menu_items').insert([{ name: name.trim(), price: p, category }]);
    setSaving(false);
    if (error) {
      setError(error.message);
    } else {
      setName('');
      setPrice('');
      setError('');
      onAdded();
    }
  }

  return (
    <>
      <div className="form-group">
        <label>ITEM NAME</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Masala Dosa" />
      </div>
      <div className="form-group">
        <label>PRICE (₹)</label>
        <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
      </div>
      <div className="form-group">
        <label>CATEGORY</label>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>
      {error && <p style={{ color: 'var(--red)', fontSize: 13 }}>{error}</p>}
      <button className="btn-gold" onClick={handleAdd} disabled={saving}>
        {saving ? 'Adding...' : '+ Add to Menu'}
      </button>
    </>
  );
}

function ManageItemsList({ items, onChanged }: { items: MenuItem[]; onChanged: () => void }) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');

  function startEdit(item: MenuItem) {
    setEditingId(item.id);
    setEditName(item.name);
    setEditPrice(String(item.price));
  }

  async function saveEdit(id: number) {
    const p = parseFloat(editPrice);
    if (!editName.trim() || !p || p <= 0) return;
    await supabase.from('menu_items').update({ name: editName.trim(), price: p }).eq('id', id);
    setEditingId(null);
    onChanged();
  }

  async function deleteItem(id: number) {
    if (!confirm('Delete this menu item? This cannot be undone.')) return;
    await supabase.from('menu_items').delete().eq('id', id);
    onChanged();
  }

  const byCategory = CATEGORIES.map((cat) => ({
    category: cat,
    items: items.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0);

  if (items.length === 0) {
    return <div className="empty-bill"><div>🍽</div>No menu items yet — add some in the "Add Item" tab.</div>;
  }

  return (
    <>
      {byCategory.map((group) => (
        <div key={group.category}>
          <div className="section-label">{group.category}</div>
          {group.items.map((item) => (
            <div key={item.id} className="menu-item-card">
              {editingId === item.id ? (
                <>
                  <div className="item-info" style={{ display: 'flex', gap: 6 }}>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '5px 8px', fontSize: 14 }}
                    />
                    <input
                      type="number"
                      value={editPrice}
                      onChange={(e) => setEditPrice(e.target.value)}
                      style={{ width: 70, background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 6, padding: '5px 8px', fontSize: 14 }}
                    />
                  </div>
                  <div className="item-actions">
                    <button className="qty-btn" onClick={() => saveEdit(item.id)}>✓</button>
                    <button className="qty-btn" onClick={() => setEditingId(null)}>✕</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="item-info">
                    <div className="item-name">{item.name}</div>
                    <div className="item-price">₹{item.price.toFixed(2)}</div>
                  </div>
                  <div className="item-actions">
                    <button className="qty-btn" onClick={() => startEdit(item)}>✏️</button>
                    <button className="qty-btn" onClick={() => deleteItem(item.id)}>🗑</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      ))}
    </>
  );
}