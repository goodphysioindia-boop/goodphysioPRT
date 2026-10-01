import React, { useMemo, useState } from 'react';

// Searchable checklist (or radio list when `single`) used to pick participants.
// items: [{ id, label, sub }]   selected: [id, ...]
export default function PickerList({
  label,
  required,
  items,
  selected,
  onChange,
  single = false,
  placeholder = 'Search',
  emptyText = 'Nothing to show',
  hint,
}) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();

  const filtered = useMemo(
    () => (!query ? items : items.filter((i) => `${i.label} ${i.sub || ''}`.toLowerCase().includes(query))),
    [items, query]
  );
  const sel = useMemo(() => new Set(selected), [selected]);

  const toggle = (id) => {
    if (single) return onChange([id]);
    onChange(sel.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  };
  const selectAll = () => onChange([...new Set([...selected, ...filtered.map((i) => i.id)])]);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <label className={`field-label !mb-0 ${required ? 'field-required' : ''}`}>{label}</label>
        <div className="flex items-center gap-3 text-xs">
          <span className="font-semibold text-brand-600">{selected.length} selected</span>
          {!single && filtered.length > 0 && (
            <button type="button" onClick={selectAll} className="font-medium text-slate-500 hover:text-brand-600">
              Select all
            </button>
          )}
          {selected.length > 0 && (
            <button type="button" onClick={() => onChange([])} className="font-medium text-slate-500 hover:text-red-500">
              Clear
            </button>
          )}
        </div>
      </div>
      {hint && <p className="mb-1.5 text-xs text-slate-400">{hint}</p>}
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="input mb-2 py-2" />
      <div className="max-h-44 divide-y divide-slate-50 overflow-y-auto rounded-xl border border-slate-200 bg-white">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-slate-400">{items.length === 0 ? emptyText : 'No matches'}</p>
        ) : (
          filtered.map((i) => (
            <label key={i.id} className="flex cursor-pointer items-start gap-2.5 px-3 py-2 hover:bg-slate-50">
              <input
                type={single ? 'radio' : 'checkbox'}
                className="mt-0.5 h-4 w-4 flex-shrink-0 accent-brand-600"
                checked={sel.has(i.id)}
                onChange={() => toggle(i.id)}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-700">{i.label}</span>
                {i.sub && <span className="block truncate text-xs text-slate-400">{i.sub}</span>}
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}