import { useState, useRef, useEffect } from 'react';

/**
 * SearchableSelect — a dropdown with a search/filter input.
 * Props:
 *  - options: [{ value, label, subtitle? }]
 *  - value: current selected value
 *  - onChange: (value) => void
 *  - placeholder: placeholder text
 *  - className: extra class
 */
export default function SearchableSelect({
  options = [],
  value,
  onChange,
  placeholder = '-- Select --',
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const selected = options.find(o => o.value === value);
  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    (o.subtitle && o.subtitle.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div ref={containerRef} className={`searchable-select ${className}`} style={{ position: 'relative' }}>
      {/* Trigger button */}
      <button
        type="button"
        className="searchable-select-trigger"
        onClick={() => { setOpen(!open); setSearch(''); }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'var(--bg-tertiary, #1e293b)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: 'var(--radius-md, 8px)',
          color: selected ? 'var(--text-primary, #f1f5f9)' : 'var(--text-muted, #94a3b8)',
          fontSize: '13px',
          cursor: 'pointer',
          textAlign: 'left',
          transition: 'border-color 0.2s',
          outline: 'none',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {selected ? selected.label : placeholder}
        </span>
        <span style={{ marginLeft: 6, opacity: 0.5, fontSize: '10px', flexShrink: 0 }}>
          {open ? '▲' : '▼'}
        </span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className="searchable-select-dropdown"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            zIndex: 9999,
            marginTop: 4,
            background: 'var(--bg-secondary, #1e293b)',
            border: '1px solid var(--border-color, #334155)',
            borderRadius: 'var(--radius-md, 8px)',
            boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
            overflow: 'hidden',
            maxHeight: 280,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Search input */}
          <div style={{ padding: '8px', borderBottom: '1px solid var(--border-color, #334155)' }}>
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="🔍  Type to search..."
              style={{
                width: '100%',
                padding: '7px 10px',
                background: 'var(--bg-primary, #0f172a)',
                border: '1px solid var(--border-color, #334155)',
                borderRadius: 'var(--radius-sm, 6px)',
                color: 'var(--text-primary, #f1f5f9)',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Options list */}
          <div style={{ overflowY: 'auto', maxHeight: 220 }}>
            {/* Clear / none option */}
            <div
              onClick={() => { onChange(''); setOpen(false); }}
              style={{
                padding: '7px 12px',
                cursor: 'pointer',
                fontSize: '12px',
                color: 'var(--text-muted, #94a3b8)',
                fontStyle: 'italic',
                background: !value ? 'rgba(99,102,241,0.1)' : 'transparent',
                borderBottom: '1px solid var(--border-color, #334155)',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.15)'}
              onMouseLeave={e => e.currentTarget.style.background = !value ? 'rgba(99,102,241,0.1)' : 'transparent'}
            >
              {placeholder}
            </div>

            {filtered.length === 0 ? (
              <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text-muted, #94a3b8)', fontSize: '12px' }}>
                No results for "{search}"
              </div>
            ) : (
              filtered.map(opt => (
                <div
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  style={{
                    padding: '7px 12px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    background: opt.value === value ? 'rgba(99,102,241,0.15)' : 'transparent',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.2)'}
                  onMouseLeave={e => e.currentTarget.style.background = opt.value === value ? 'rgba(99,102,241,0.15)' : 'transparent'}
                >
                  <span style={{ color: 'var(--text-primary, #f1f5f9)', fontWeight: opt.value === value ? 600 : 400 }}>
                    {opt.label}
                  </span>
                  {opt.subtitle && (
                    <span style={{ color: 'var(--text-muted, #94a3b8)', fontSize: '10px' }}>
                      {opt.subtitle}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
