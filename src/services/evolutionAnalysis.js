import { resolvePrimeiroDesloc, resolvePrimeiroDespacho, resolvePrimeiroLogin } from './platformKpis.js';
import { dailyIntervalMinutes, intervalMinutes } from './kpiCalculator.js';
import { getThreshold, isKpiOnTarget } from '../config/kpiThresholds.js';
import { formatDateTimeBr, formatNumber, minutesBetween, parseDateTimeBr } from '../utils/numberDate.js';

const PLATFORM_KPIS = [
  { key: 'primeiroLoginCorrigido', kpi: '1º Login', label: '1º Login' },
  { key: 'primeiroDespacho', kpi: '1º Despacho', label: '1º Despacho' },
  { key: 'primeiroDesloc', kpi: '1º Desloc.', label: '1º Deslocamento' },
  { key: 'intervalo', kpi: 'Intervalo', label: 'Intervalo' }
];

export function buildEvolutionTeamAnalysis(rows, selectedTeam) {
  const teams = [...new Set(rows.map((row) => row.equipe).filter(Boolean))].sort();
  const team = selectedTeam && teams.includes(selectedTeam) ? selectedTeam : teams[0] || '';
  const teamRows = rows
    .filter((row) => row.equipe === team)
    .map((row) => ({ ...row, occurrenceDate: getOccurrenceDate(row) }))
    .sort((a, b) => (a.occurrenceDate?.getTime() || 0) - (b.occurrenceDate?.getTime() || 0));

  const incidents = [];
  const rowsByDay = new Map();
  for (const row of teamRows) {
    const key = shiftKey(row);
    if (!rowsByDay.has(key)) rowsByDay.set(key, []);
    rowsByDay.get(key).push(row);
  }

  for (let index = 0; index < teamRows.length; index += 1) {
    const row = teamRows[index];
    const previous = index > 0 ? teamRows[index - 1] : null;
    const dayKey = shiftKey(row);
    const previousDayKey = previous ? shiftKey(previous) : null;
    const isFirstOfDay = !previous || previousDayKey !== dayKey;
    const minutosDesdeAnterior = isFirstOfDay ? null : minutesBetween(row.occurrenceDate, previous.occurrenceDate);
    const dayRows = rowsByDay.get(dayKey) || [row];

    const statuses = PLATFORM_KPIS.map((item) => {
      const value = isFirstOfDay ? valueFor(row, item, dayRows) : null;
      const threshold = getThreshold(item.kpi);
      const hasValue = value != null && !Number.isNaN(value);
      return {
        ...item,
        value: hasValue ? value : null,
        meta: threshold?.meta,
        ok: hasValue ? isKpiOnTarget(value, threshold) : null,
        status: !hasValue ? 'Sem dado' : isKpiOnTarget(value, threshold) ? 'Dentro da meta' : 'Fora da meta'
      };
    });
    incidents.push({
      id: row.id,
      os: row.nrOrdem || '-',
      data: formatDateTimeBr(row.occurrenceDate) || row.dataReferenciaKey,
      causa: row.causa || 'Sem causa informada',
      isFirstOfDay,
      minutosDesdeAnterior,
      statuses,
      diagnostic: buildDiagnostic(statuses)
    });
  }

  return {
    teams,
    selectedTeam: team,
    causeRanking: rankCauses(teamRows),
    incidents,
    platformRows: incidents.map((incident) => ({
      ...incident,
      values: Object.fromEntries(incident.statuses.map((status) => [status.label, status]))
    })),
    platformDaily: buildPlatformDaily(teamRows)
  };
}

const PLATFORM_DAILY_KPIS = PLATFORM_KPIS;

function buildPlatformDaily(teamRows) {
  const byDay = new Map();
  for (const row of teamRows) {
    const key = row.dataReferenciaKey || (row.occurrenceDate ? row.occurrenceDate.toLocaleDateString('pt-BR') : '-');
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(row);
  }

  return [...byDay.entries()]
    .map(([day, dayRows]) => {
      const values = {};
      for (const item of PLATFORM_DAILY_KPIS) {
        const value = valueFor(dayRows[0], item, dayRows);
        const threshold = getThreshold(item.kpi);
        const hasValue = value != null && !Number.isNaN(value);
        values[item.label] = {
          value: hasValue ? value : null,
          meta: threshold?.meta,
          ok: hasValue ? isKpiOnTarget(value, threshold) : null,
          status: !hasValue ? 'Sem dado' : isKpiOnTarget(value, threshold) ? 'Dentro da meta' : 'Fora da meta'
        };
      }
      const osCount = new Set(dayRows.map((row) => row.nrOrdem).filter(Boolean)).size;
      return { day, osCount, values };
    })
    .sort((a, b) => compareDayKey(a.day, b.day));
}

function compareDayKey(a, b) {
  const [ad, am, ay] = String(a).split('/').map(Number);
  const [bd, bm, by] = String(b).split('/').map(Number);
  if ([ad, am, ay, bd, bm, by].some(Number.isNaN)) return String(a).localeCompare(String(b));
  return new Date(ay, am - 1, ad) - new Date(by, bm - 1, bd);
}

function valueFor(row, item, dayRows = null) {
  if (item.kpi === '1º Despacho') {
    if (dayRows?.length) {
      for (const dayRow of dayRows) {
        const value = resolvePrimeiroDespacho(dayRow);
        if (value != null) return value;
      }
      return null;
    }
    return resolvePrimeiroDespacho(row);
  }
  if (item.kpi === '1º Login') {
    if (dayRows?.length) {
      for (const dayRow of dayRows) {
        const value = resolvePrimeiroLogin(dayRow);
        if (value != null) return value;
      }
      return null;
    }
    return resolvePrimeiroLogin(row);
  }
  if (item.kpi === '1º Desloc.') {
    if (dayRows?.length) {
      for (const dayRow of dayRows) {
        const value = resolvePrimeiroDesloc(dayRow);
        if (value != null) return value;
      }
      return null;
    }
    return resolvePrimeiroDesloc(row);
  }
  if (item.kpi === 'Intervalo') {
    return dayRows?.length ? dailyIntervalMinutes(dayRows) : intervalMinutes(row);
  }
  return row[item.key];
}

function shiftKey(row) {
  return row.dataReferenciaKey || (row.occurrenceDate ? row.occurrenceDate.toLocaleDateString('pt-BR') : '-');
}

function getOccurrenceDate(row) {
  return (
    parseDateTimeBr(row.despachada) ||
    parseDateTimeBr(row.aCaminho) ||
    parseDateTimeBr(row.noLocal) ||
    parseDateTimeBr(row.liberada) ||
    parseDateTimeBr(row.dataReferenciaDate)
  );
}

function rankCauses(rows) {
  const counts = new Map();
  for (const row of rows) {
    const cause = String(row.causa || 'Sem causa informada').trim();
    counts.set(cause, (counts.get(cause) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([cause, count]) => ({ cause, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

function buildDiagnostic(statuses) {
  const off = statuses.filter((status) => status.ok === false && status.value != null);
  if (!off.length) return 'Incidência sem desvio de plataforma relevante.';
  return `Atenção em ${off.map((status) => `${status.label} (${formatNumber(status.value)} min)`).join(', ')}.`;
}
