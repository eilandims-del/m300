import { useCallback } from 'react';
import { MultiSelect } from './MultiSelect.jsx';
import { toISODate, fromISODate } from '../utils/dateUtils.js';
import { createEmptyFilters } from '../services/filterService.js';

// Painel de filtros compartilhado por Dashboard e Evolutivo.
export function FiltersPanel({ filters, setFilters, options }) {
  const update = useCallback((patch) => {
    setFilters((current) => ({ ...current, ...patch }));
  }, [setFilters]);

  const hasFilters =
    filters.bases.length ||
    filters.equipes.length ||
    filters.tiposEquipe.length ||
    filters.periodos.length ||
    filters.dataInicio ||
    filters.dataFim;

  return (
    <section className="panel filters-panel">
      <div className="filters-row">
        <MultiSelect label="Base" options={options.bases || []} selected={filters.bases} onChange={(bases) => update({ bases })} />
        <MultiSelect label="Equipe" options={options.equipes || []} selected={filters.equipes} onChange={(equipes) => update({ equipes })} />
        <MultiSelect label="Tipo de equipe" options={options.tiposEquipe || []} selected={filters.tiposEquipe} onChange={(tiposEquipe) => update({ tiposEquipe })} />
        <MultiSelect label="Período" options={options.periodos || []} selected={filters.periodos} onChange={(periodos) => update({ periodos })} />
        <label className="date-filter">
          <span className="filter-label">Data início</span>
          <input type="date" value={toISODate(filters.dataInicio)} onChange={(event) => update({ dataInicio: fromISODate(event.target.value) })} />
        </label>
        <label className="date-filter">
          <span className="filter-label">Data fim</span>
          <input type="date" value={toISODate(filters.dataFim)} onChange={(event) => update({ dataFim: fromISODate(event.target.value, true) })} />
        </label>
        <button type="button" className="btn-ghost clear-filters" disabled={!hasFilters} onClick={() => setFilters(createEmptyFilters())}>
          Limpar filtros
        </button>
      </div>
    </section>
  );
}
