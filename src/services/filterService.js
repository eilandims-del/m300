import { startOfDay } from '../utils/dateUtils.js';
import { normalizeToken } from '../utils/normalization.js';

export function createEmptyFilters() {
  return { bases: [], equipes: [], tiposEquipe: [], periodos: [], dataInicio: null, dataFim: null };
}

// Filtro único consumido por dashboard, evolutivo, rankings, tabelas e PDF.
export function applyFilters(rows, filters) {
  if (!rows?.length) return [];
  const f = filters || createEmptyFilters();
  const inicio = f.dataInicio ? startOfDay(f.dataInicio)?.getTime() : null;
  const fim = f.dataFim ? endOfDayTime(f.dataFim) : null;
  const baseSet = normalizedSet(f.bases);
  const equipeSet = normalizedSet(f.equipes);
  const tipoSet = normalizedSet(f.tiposEquipe);
  const periodoSet = normalizedSet(f.periodos);

  return rows.filter((row) => {
    if (baseSet.size && !baseSet.has(normalizeToken(row.baseResolvida))) return false;
    if (equipeSet.size && !equipeSet.has(normalizeToken(row.equipe))) return false;
    if (tipoSet.size && !tipoSet.has(normalizeToken(row.tipoResolvido))) return false;
    if (periodoSet.size && !periodoSet.has(normalizeToken(row.periodoResolvido))) return false;

    if (inicio != null || fim != null) {
      const time = row.dataReferenciaDate instanceof Date ? row.dataReferenciaDate.getTime() : null;
      if (time == null) return false;
      if (inicio != null && time < inicio) return false;
      if (fim != null && time > fim) return false;
    }
    return true;
  });
}

// Opções disponíveis para os selects, calculadas a partir das linhas já resolvidas.
export function deriveFilterOptions(rows) {
  return {
    bases: unique(rows.map((row) => row.baseResolvida)),
    equipes: unique(rows.map((row) => row.equipe)),
    tiposEquipe: unique(rows.map((row) => row.tipoResolvido)),
    periodos: unique(rows.map((row) => row.periodoResolvido))
  };
}

// Opções encadeadas: Equipe depende de Base + Tipo + Período/Turno atuais.
// Datas não restringem a lista de opções para evitar sumiços inesperados ao ajustar período.
export function deriveChainedFilterOptions(rows, filters) {
  const f = filters || createEmptyFilters();
  const baseSet = normalizedSet(f.bases);
  const tipoSet = normalizedSet(f.tiposEquipe);
  const periodoSet = normalizedSet(f.periodos);

  const rowsForTeams = rows.filter((row) => {
    if (baseSet.size && !baseSet.has(normalizeToken(row.baseResolvida))) return false;
    if (tipoSet.size && !tipoSet.has(normalizeToken(row.tipoResolvido))) return false;
    if (periodoSet.size && !periodoSet.has(normalizeToken(row.periodoResolvido))) return false;
    return true;
  });

  return {
    bases: unique(rows.map((row) => row.baseResolvida)),
    equipes: unique(rowsForTeams.map((row) => row.equipe)),
    tiposEquipe: unique(rows.map((row) => row.tipoResolvido)),
    periodos: unique(rows.map((row) => row.periodoResolvido))
  };
}

export function sanitizeFilters(filters, options) {
  const validTeams = normalizedSet(options.equipes);
  const equipes = filters.equipes.filter((team) => validTeams.has(normalizeToken(team)));
  return equipes.length === filters.equipes.length ? filters : { ...filters, equipes };
}

export function getDateBounds(rows) {
  const dates = rows.map((row) => row.dataReferenciaDate).filter((date) => date instanceof Date && !Number.isNaN(date.getTime()));
  if (!dates.length) return { min: null, max: null };
  const times = dates.map((date) => date.getTime());
  return { min: new Date(Math.min(...times)), max: new Date(Math.max(...times)) };
}

function endOfDayTime(value) {
  const start = startOfDay(value);
  if (!start) return null;
  return start.getTime() + 24 * 60 * 60 * 1000 - 1;
}

function unique(values) {
  return [...new Set(values.filter((value) => value != null && value !== ''))].sort();
}

function normalizedSet(values = []) {
  return new Set(values.filter(Boolean).map((value) => normalizeToken(value)));
}
