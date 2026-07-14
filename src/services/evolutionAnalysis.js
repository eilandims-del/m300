import { resolvePrimeiroDesloc, resolvePrimeiroDespacho, resolvePrimeiroLogin } from './platformKpis.js';
import { getThreshold, isKpiOnTarget } from '../config/kpiThresholds.js';
import { formatNumber, minutesBetween, parseDateTimeBr } from '../utils/numberDate.js';

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

  const incidents = teamRows.map((row, index) => {
    const previous = index > 0 ? teamRows[index - 1] : null;
    const dayKey = shiftKey(row);
    const previousDayKey = previous ? shiftKey(previous) : null;
    // Só é a primeira do dia quando muda o turno/dia da equipe.
    const isFirstOfDay = !previous || previousDayKey !== dayKey;
    // Nunca cruza o turno: o tempo desde a anterior só vale dentro do mesmo dia.
    const minutosDesdeAnterior = isFirstOfDay ? null : minutesBetween(row.occurrenceDate, previous.occurrenceDate);

    const statuses = PLATFORM_KPIS.map((item) => {
      const value = valueFor(row, item);
      const threshold = getThreshold(item.kpi);
      return {
        ...item,
        value,
        meta: threshold?.meta,
        ok: isKpiOnTarget(value, threshold),
        status: isKpiOnTarget(value, threshold) ? 'Dentro da meta' : 'Fora da meta'
      };
    });
    return {
      id: row.id,
      os: row.nrOrdem || '-',
      data: row.occurrenceDate ? row.occurrenceDate.toLocaleString('pt-BR') : row.dataReferenciaKey,
      causa: row.causa || 'Sem causa informada',
      isFirstOfDay,
      minutosDesdeAnterior,
      statuses,
      diagnostic: buildDiagnostic(statuses)
    };
  });

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

// Resumo do tempo de plataforma por DIA (não por OS). As métricas de plataforma
// são "a primeira do dia", repetidas em cada OS, então basta um valor por dia.
const PLATFORM_DAILY_KPIS = PLATFORM_KPIS.filter((item) => item.kpi !== 'Intervalo');

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
        let value = null;
        for (const row of dayRows) {
          const candidate = valueFor(row, item);
          if (candidate != null) {
            value = candidate;
            break;
          }
        }
        const threshold = getThreshold(item.kpi);
        values[item.label] = {
          value,
          meta: threshold?.meta,
          ok: isKpiOnTarget(value, threshold),
          status: isKpiOnTarget(value, threshold) ? 'Dentro da meta' : 'Fora da meta'
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

function valueFor(row, item) {
  if (item.kpi === '1º Despacho') return resolvePrimeiroDespacho(row);
  if (item.kpi === '1º Login') return resolvePrimeiroLogin(row);
  if (item.kpi === '1º Desloc.') return resolvePrimeiroDesloc(row);
  return row[item.key];
}

// Chave do turno/dia da equipe — usada para não cruzar dias ao medir o
// tempo entre incidências.
function shiftKey(row) {
  return row.dataReferenciaKey || (row.occurrenceDate ? row.occurrenceDate.toLocaleDateString('pt-BR') : '-');
}

function getOccurrenceDate(row) {
  return (
    parseDateTimeBr(row.despachada) ||
    parseDateTimeBr(row.aCaminho) ||
    parseDateTimeBr(row.noLocal) ||
    parseDateTimeBr(row.liberada) ||
    parseDateTimeBr(row.dataReferencia)
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
  const off = statuses.filter((status) => !status.ok && status.value != null);
  if (!off.length) return 'Incidência sem desvio de plataforma relevante.';
  return `Atenção em ${off.map((status) => `${status.label} (${formatNumber(status.value)} min)`).join(', ')}.`;
}
