import { KPI_THRESHOLDS, getThreshold, isKpiOnTarget, scoreKpi } from '../config/kpiThresholds.js';
import { averagePrimeiroDesloc, averagePrimeiroDespacho, averagePrimeiroLogin } from './platformKpis.js';
import { average, minutesBetween, sum } from '../utils/numberDate.js';

const KPI_NAMES = KPI_THRESHOLDS.map((item) => item.kpi);

export function buildAnalytics(rows) {
  const teams = groupBy(rows, (row) => row.equipe);
  const teamSummaries = [...teams.entries()].map(([team, teamRows]) => calculateTeam(team, teamRows));
  const dailyTrends = calculateDailyTrends(rows);
  const rankings = calculateRankings(teamSummaries);
  const overview = calculateOverview(rows, teamSummaries, rankings);

  return { teamSummaries, dailyTrends, rankings, overview };
}

function calculateTeam(team, rows) {
  const dates = new Set(rows.map((row) => row.dataReferenciaKey).filter(Boolean));
  const os = new Set(rows.map((row) => row.nrOrdem).filter(Boolean));
  const dedupe = uniqueBy(rows, (row) => `${row.equipe}|${row.dataReferenciaKey}`);

  const kpis = {
    'OS Dia': dates.size ? os.size / dates.size : null,
    // Os totais *_TOTAL_CAL são diários (repetidos por OS); dedupe por equipe+dia
    // evita ponderar cada dia pela quantidade de OS, igual à Utilização.
    'Eficiência': ratioPercent(sum(dedupe.map((row) => row.tempoPadraoTotalCal)), sum(dedupe.map((row) => row.trTotalCal))),
    'Utilização': ratioPercent(sum(dedupe.map((row) => row.htTotal)), sum(dedupe.map((row) => row.hdTotal))),
    'TME IMP': calculateTmeImp(rows),
    '1º Login': averagePrimeiroLogin(dedupe),
    '1º Despacho': averagePrimeiroDespacho(dedupe),
    '1º Desloc.': averagePrimeiroDesloc(dedupe),
    'Retorno Base': average(dedupe.map((row) => row.retornoBase)),
    'Intervalo': calculateIntervalo(rows)
  };

  const scores = Object.fromEntries(KPI_NAMES.map((kpi) => [kpi, scoreKpi(kpis[kpi], getThreshold(kpi))]));
  const outOfTarget = KPI_NAMES.filter((kpi) => !isKpiOnTarget(kpis[kpi], getThreshold(kpi)));
  const first = rows[0] || {};
  return {
    equipe: team,
    polo: first.polo,
    base: first.baseResolvida,
    tipo: first.tipoResolvido,
    rows,
    orders: os.size,
    dates: dates.size,
    kpis,
    scores,
    outOfTarget,
    scoreGeral: sum(Object.values(scores))
  };
}

function calculateTmeImp(rows) {
  const preferred = rows.map((row) => row.trOrdemImpSsEquipe).filter((value) => value > 0);
  if (preferred.length) return average(preferred);
  return average(
    rows
      .filter((row) => String(row.status || '').toLowerCase().includes('improdutivo') && row.trOrdem > 0)
      .map((row) => row.trOrdem)
  );
}

function calculateFirstLogin(rows) {
  return averagePrimeiroLogin(rows);
}

function calculateFirstDispatch(rows) {
  return averagePrimeiroDespacho(rows);
}

function calculateFirstDesloc(rows) {
  return averagePrimeiroDesloc(rows);
}

function calculateIntervalo(rows) {
  const byDate = groupBy(rows, (row) => row.dataReferenciaKey);
  const dailyTotals = [...byDate.values()]
    .map((dayRows) => dailyIntervalMinutes(dayRows))
    .filter((value) => value != null);

  return dailyTotals.length ? average(dailyTotals) : null;
}

// A equipe faz um único intervalo por dia, mas o valor costuma vir repetido em
// cada OS daquele dia. Por isso deduplicamos por assinatura (início/fim/valor)
// para não somar o mesmo intervalo várias vezes.
function dailyIntervalMinutes(dayRows) {
  const unique = new Map();
  for (const row of dayRows) {
    const minutes = intervalMinutes(row);
    if (minutes == null || minutes <= 0) continue;
    const signature = `${row.inicioIntervalo ?? ''}|${row.fimIntervalo ?? ''}|${row.intervalo ?? ''}`;
    if (!unique.has(signature)) unique.set(signature, minutes);
  }
  if (!unique.size) return null;
  return sum([...unique.values()]);
}

function intervalMinutes(row) {
  const fromTimes = minutesBetween(row.fimIntervalo, row.inicioIntervalo);
  if (fromTimes != null && fromTimes > 0) return fromTimes;

  if (row.intervalo == null || row.intervalo <= 0) return null;
  // Valores pequenos inteiros (1, 2, 3…) costumam ser contagem de intervalos, não minutos.
  if (Number.isInteger(row.intervalo) && row.intervalo <= 5) return null;
  return row.intervalo;
}

function calculateDailyTrends(rows) {
  const groups = groupBy(rows, (row) => `${row.dataReferenciaKey}|${row.equipe}|${row.baseResolvida}`);
  return [...groups.entries()].map(([key, groupRows]) => {
    const [date, equipe, base] = key.split('|');
    const os = new Set(groupRows.map((row) => row.nrOrdem).filter(Boolean));
    const first = groupRows[0] || {};
    return {
      date,
      equipe,
      base,
      'OS Dia': os.size,
      'Eficiência': ratioPercent(sum(groupRows.map((row) => row.tempoPadraoTotalCal)), sum(groupRows.map((row) => row.trTotalCal))),
      'Utilização': ratioPercent(first.htTotal, first.hdTotal),
      'TME IMP': calculateTmeImp(groupRows),
      '1º Login': calculateFirstLogin([first]),
      '1º Despacho': calculateFirstDispatch([first]),
      '1º Desloc.': calculateFirstDesloc([first]),
      'Retorno Base': first.retornoBase,
      'Intervalo': calculateIntervalo(groupRows),
      causas: topCauses(groupRows)
    };
  });
}

function calculateRankings(teamSummaries) {
  return Object.fromEntries(
    KPI_NAMES.map((kpi) => {
      const threshold = getThreshold(kpi);
      const ranked = teamSummaries
        .filter((team) => team.kpis[kpi] != null)
        .sort((a, b) =>
          threshold.direction === 'higher-is-better' ? b.kpis[kpi] - a.kpis[kpi] : a.kpis[kpi] - b.kpis[kpi]
        );
      const outOfTarget = ranked.filter((team) => !isKpiOnTarget(team.kpis[kpi], threshold));
      const needsImprovement = [...outOfTarget].reverse().slice(0, 3);
      return [
        kpi,
        {
          average: average(ranked.map((team) => team.kpis[kpi])),
          ranking: ranked,
          top3: ranked.slice(0, 3),
          needsImprovement
        }
      ];
    })
  );
}

function calculateOverview(rows, teams, rankings) {
  const dates = rows.map((row) => row.dataReferenciaDate).filter(Boolean).sort((a, b) => a - b);
  const belowMeta = teams.filter((team) => team.outOfTarget.length > 0);
  const critical = KPI_NAMES.map((kpi) => ({
    kpi,
    out: teams.filter((team) => !isKpiOnTarget(team.kpis[kpi], getThreshold(kpi))).length
  })).sort((a, b) => b.out - a.out)[0];

  return {
    totalEquipes: teams.length,
    totalOs: new Set(rows.map((row) => row.nrOrdem).filter(Boolean)).size,
    periodo: dates.length ? `${dates[0].toLocaleDateString('pt-BR')} a ${dates.at(-1).toLocaleDateString('pt-BR')}` : '-',
    equipesAbaixoMeta: belowMeta.length,
    equipesComIntervalo: new Set(rows.filter(hasInterval).map((row) => row.equipe)).size,
    kpiMaisCritico: critical?.kpi || '-',
    piorUtilizacao: rankings['Utilização']?.ranking?.at(-1)?.equipe || '-',
    piorRetornoBase: rankings['Retorno Base']?.ranking?.at(-1)?.equipe || '-',
    piorPrimeiroLogin: rankings['1º Login']?.ranking?.at(-1)?.equipe || '-',
    piorPrimeiroDesloc: formatWorstTeam(rankings['1º Desloc.']?.ranking?.at(-1), '1º Desloc.'),
    equipesOciosidade: teams.filter((team) => (team.kpis['Utilização'] ?? 100) < 70).length
  };
}

function hasInterval(row) {
  return intervalMinutes(row) != null || String(row.raw?.Intervalo ?? '').trim() !== '';
}

function topCauses(rows) {
  const counts = new Map();
  for (const row of rows) {
    const cause = String(row.causa || '').trim();
    if (!cause) continue;
    counts.set(cause, (counts.get(cause) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cause, count]) => `${cause}${count > 1 ? ` (${count})` : ''}`);
}

function formatWorstTeam(team, kpi) {
  if (!team || team.kpis[kpi] == null) return '-';
  return `${team.equipe} (${team.kpis[kpi].toLocaleString('pt-BR', { maximumFractionDigits: 1 })} min)`;
}

function ratioPercent(numerator, denominator) {
  return denominator > 0 ? (numerator / denominator) * 100 : null;
}

function uniqueBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
}

// Séries diárias por equipe + consolidado, para a página de Evolutivo.
export function buildEvolution(dailyTrends, kpi) {
  const dates = [...new Set(dailyTrends.map((row) => row.date))].sort(compareDateKey);
  const teams = [...new Set(dailyTrends.map((row) => row.equipe))].sort();

  const series = teams.map((equipe) => ({
    equipe,
    values: dates.map((date) => {
      const match = dailyTrends.filter((row) => row.equipe === equipe && row.date === date && row[kpi] != null);
      return match.length ? avg(match.map((row) => row[kpi])) : null;
    }),
    causes: dates.map((date) => {
      const match = dailyTrends.find((row) => row.equipe === equipe && row.date === date);
      return match?.causas || [];
    })
  }));

  const consolidated = dates.map((date) => {
    const dayValues = dailyTrends.filter((row) => row.date === date && row[kpi] != null).map((row) => row[kpi]);
    return dayValues.length ? avg(dayValues) : null;
  });

  return { dates, series, consolidated };
}

function avg(values) {
  const valid = values.filter((value) => value != null && !Number.isNaN(value));
  return valid.length ? valid.reduce((total, value) => total + value, 0) / valid.length : null;
}

function compareDateKey(a, b) {
  const [ad, am, ay] = a.split('/').map(Number);
  const [bd, bm, by] = b.split('/').map(Number);
  return new Date(ay, am - 1, ad) - new Date(by, bm - 1, bd);
}

export function groupBy(items, keyFn) {
  const map = new Map();
  for (const item of items) {
    const key = keyFn(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}
