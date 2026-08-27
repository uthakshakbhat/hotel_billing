import type { MenuItem } from '../../types';

interface MenuGridProps {
  items: MenuItem[];
  activeCategory: string;
  onAdd: (item: MenuItem) => void;
}

export function MenuGrid({ items, activeCategory, onAdd }: MenuGridProps) {
  const filtered =
    activeCategory === 'All' ? items : items.filter((i) => i.category === activeCategory);

  return (
    <div className="menu-scroll" style={{ minHeight: 0 }}>
      {filtered.length === 0 ? (
        <div className="empty-bill">
          <div>🍽</div>
          No items in this category yet
        </div>
      ) : (
        <div className="menu-grid">
          {filtered.map((item) => (
            <div key={item.id} className="menu-tile" onClick={() => onAdd(item)}>
              <div className="t-cat">{item.category}</div>
              <div className="t-name">{item.name}</div>
              <div className="t-price">₹{item.price.toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}