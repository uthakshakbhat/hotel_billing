interface TableBarProps {
  tableCount: number;
  currentTable: number;
  onSelect: (index: number) => void;
  hasItems: (index: number) => boolean;
}

export function TableBar({ tableCount, currentTable, onSelect, hasItems }: TableBarProps) {
  return (
    <div className="table-bar">
      {Array.from({ length: tableCount }, (_, i) => (
        <button
          key={i}
          className={`tbl-btn ${i === currentTable ? 'active' : ''} ${hasItems(i) ? 'has-items' : ''}`}
          onClick={() => onSelect(i)}
        >
          Table {i + 1}
          <span className="tbl-dot"></span>
        </button>
      ))}
    </div>
  );
}