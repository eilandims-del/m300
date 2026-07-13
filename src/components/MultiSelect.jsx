import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// Multiselect leve com checkboxes: selecionar um/vários/todos e limpar.
export function MultiSelect({ label, options, selected, onChange, limit = 120 }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(event) {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const visibleOptions = useMemo(() => {
    const token = query.trim().toLowerCase();
    const filtered = token ? options.filter((option) => option.toLowerCase().includes(token)) : options;
    return filtered.slice(0, limit);
  }, [options, query, limit]);
  const hiddenCount = Math.max(0, (query ? options.filter((option) => option.toLowerCase().includes(query.trim().toLowerCase())).length : options.length) - visibleOptions.length);

  const toggle = useCallback((option) => {
    onChange(selectedSet.has(option) ? selected.filter((item) => item !== option) : [...selected, option]);
  }, [onChange, selected, selectedSet]);

  const summary = selected.length === 0 ? 'Todos' : selected.length === 1 ? selected[0] : `${selected.length} selecionados`;

  return (
    <div className="multiselect" ref={ref}>
      <span className="filter-label">{label}</span>
      <button type="button" className="multiselect-trigger" onClick={() => setOpen((value) => !value)}>
        <span className="truncate">{summary}</span>
        <span className="chevron">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="multiselect-menu">
          <div className="multiselect-actions">
            <button type="button" onClick={() => onChange([...options])}>Todas</button>
            <button type="button" onClick={() => onChange([])}>Limpar</button>
          </div>
          {options.length > 12 && (
            <input
              className="multiselect-search"
              value={query}
              placeholder="Buscar equipe..."
              onChange={(event) => setQuery(event.target.value)}
            />
          )}
          <div className="multiselect-options">
            {options.length === 0 && <span className="empty">Sem opções</span>}
            {visibleOptions.map((option) => (
              <label key={option} className="multiselect-option">
                <input type="checkbox" checked={selectedSet.has(option)} onChange={() => toggle(option)} />
                <span className="truncate">{option}</span>
              </label>
            ))}
            {hiddenCount > 0 && <span className="empty">Mostrando {visibleOptions.length} de {visibleOptions.length + hiddenCount}. Use a busca para refinar.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
