import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { CATEGORIES } from '../../utils/constants';
import type { MenuItem } from '../../types';

type SidebarTab = 'add' | 'manage';

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
        </div>
        <div className="sidebar-content">
          {tab === 'add' && <AddItemForm onAdded={onReload} />}
          {tab === 'manage' && <ManageItemsList items={items} onChanged={onReload} />}
        </div>
      </aside>
    </>
  );
}