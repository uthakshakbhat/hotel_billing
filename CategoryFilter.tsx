import { CATEGORIES } from '../../utils/constants';

interface CategoryFilterProps {
  activeCategory: string;
  onSelect: (category: string) => void;
}

export function CategoryFilter({ activeCategory, onSelect }: CategoryFilterProps) {
  return (
    <div className="cat-filter-wrap">
      <div className="cat-filter">
        <button
          className={`cf-btn ${activeCategory === 'All' ? 'active' : ''}`}
          onClick={() => onSelect('All')}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`cf-btn ${activeCategory === cat ? 'active' : ''}`}
            onClick={() => onSelect(cat)}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
}