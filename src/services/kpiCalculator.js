import { KPI_THRESHOLDS, SCORED_KPIS, getThreshold, isKpiOnTarget, scoreKpi } from '../config/kpiThresholds.js';
import {
  averagePrimeiroDesloc,
  averagePrimeiroDespacho,
  averageLoginHour,
  averagePrimeiroLogin,
  resolvePrimeiroDesloc,
  resolvePrimeiroDespacho,
  resolvePrimeiroLogin,
  setPlatformKpiColumns
} from './platformKpis.js';
import { average, minutesBetween, sum } from '../utils/numberDate.js';

const KPI_NAMES = KPI_THRESHOLDS.map((item) => item.kpi);
const SCORED_KPI_NAMES = SCORED_KPIS.map((item) => item.kpi);

// Campos de jornada (equipe×data). Na deduplicação, preenchemos a partir de
// qualquer OS do dia para não perder valor quando a primeira linha vem vazia.
const DAY_LEVEL_FIELDS = [
  'primeiroLoginCorrigido',
  'primeiroLogin',
  'primeiroDespacho',
  'primeiroDesloc',
  'retornoBase',
  'htTotal',
  'hdTotal',
  'taskTimeTotalTr',
  'tempoPadraoTotalCal',
  'trTotalCal',
  'qtdDeslocamentos',
  'logInCorrigido',
  'logIn',
  'inicioCalendario',
  'horaPrimeiroDeslocamento',
  'horaPrimeiroDespacho',
  'inicioIntervalo',
  'fimIntervalo',
  'intervalo',
  'intervaloInformado',
  'logOffCorrigido',
  'logOff',
  'trOrdemImpSsEquipe'
];

export function buildAnalytics(rows, { columnMap } = {}) {
  if (columnMap) setPlatformKpiColumns(columnMap);

  const teams = groupBy(rows, (row) => row.equipe);
  const teamSummaries = [...teams.entries()].map(([team, teamRows]) => calculateTeam(team, teamRows));
  const dailyTrends = calculateDailyTrends(rows);
  const platformKpis = calculatePlatformKpis(rows);
  const rankings = calculateRankings(teamSummaries, platformKpis);
  const overview = calculateOverview(rows, teamSummaries, rankings);

  return { teamSummaries, dailyTrends, rankings, overview, platformKpis };
}

function calculateTeam(team, rows) {
  const dates = new Set(rows.map((row) => row.dataReferenciaKey).filter(Boolean));
  const os = new Set(rows.map((row) => row.nrOrdem).filter(Boolean));
  const dedupe = coalesceTeamDays(rows);

  const kpis = {
    'OS Dia': calculateOsDia(rows),
    'Eficiência': ratioPercent(sum(dedupe.map((row) => row.tempoPadraoTotalCal)), sum(dedupe.map((row) => row.trTotalCal))),
    'Utilização': ratioPercent(sum(dedupe.map((row) => row.htTotal)), sum(dedupe.map((row) => row.hdTotal))),
    'Task Time': ratioPercent(sum(dedupe.map((row) => row.taskTimeTotalTr)), sum(dedupe.map((row) => row.hdTotal))),
    'TMR Sec': calculateTmrSec(rows),
    'TMR Imp': calculateTmrImp(rows),
    '1º Login': averagePrimeiroLogin(dedupe),
    '1º Despacho': averagePrimeiroDespacho(dedupe),
    '1º Desloc.': averagePrimeiroDesloc(dedupe),
    'Retorno Base': average(dedupe.map((row) => row.retornoBase)),
    'Intervalo': calculateIntervalo(rows)
  };
  kpis['Produtividade'] = calculateProdutividade(kpis['Eficiência'], kpis['Utilização']);

  const loginHour = averageLoginHour(dedupe);
  const scores = Object.fromEntries(
    SCORED_KPI_NAMES.map((kpi) => {
      if (kpi === '1º Login') {
        return [kpi, scoreKpi(loginHour, getThreshold(kpi))];
      }
      if (kpi === 'TMR Sec') {
        return [kpi, scoreKpi(kpis[kpi], getThreshold(kpi), { hasData: hasTmrSecData(rows) })];
      }
      if (kpi === 'TMR Imp') {
        return [kpi, scoreKpi(kpis[kpi], getThreshold(kpi), { hasData: hasTmrImpData(rows) })];
      }
      return [kpi, scoreKpi(kpis[kpi], getThreshold(kpi))];
    })
  );

  // Sem dado ≠ fora da meta (evita heatmap/report vermelho por ausência).
  const outOfTarget = SCORED_KPI_NAMES.filter((kpi) => {
    const value = kpis[kpi];
    if (value == null || Number.isNaN(value)) return false;
    return !isKpiOnTarget(value, getThreshold(kpi));
  });

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

/** OS Dia Spotfire: média de Qtd Deslocamentos por equipe×data (fallback: OS únicas). */
function calculateOsDia(rows) {
  const values = [...groupBy(rows, teamDayKey).values()]
    .map((dayRows) => osDiaForTeamDay(dayRows))
    .filter((value) => value != null);
  return values.length ? average(values) : null;
}

function osDiaForTeamDay(dayRows) {
  const qtd = Math.max(0, ...dayRows.map((row) => row.qtdDeslocamentos || 0));
  if (qtd > 0) return qtd;
  const uniqueOs = new Set(dayRows.map((row) => row.nrOrdem).filter(Boolean)).size;
  return uniqueOs > 0 ? uniqueOs : null;
}

function calculateProdutividade(eficiencia, utilizacao) {
  if (eficiencia == null || utilizacao == null) return null;
  return (eficiencia / 100) * (utilizacao / 100) * 100;
}

function hasTmrSecData(rows) {
  return rows.some((row) => row.trOrdemSec > 0);
}

function hasTmrImpData(rows) {
  return rows.some(
    (row) =>
      row.trOrdemImpSsEquipe > 0 ||
      row.trOrdemImpSs > 0 ||
      String(row.status || '').toLowerCase().includes('improdutivo')
  );
}

function calculateTmrImp(rows) {
  // Coluna "* equipe" é de jornada: deduplica equipe×data para não ponderar por nº de OS.
  const dayRows = coalesceTeamDays(rows);
  const preferred = dayRows.map((row) => row.trOrdemImpSsEquipe).filter((value) => value > 0);
  if (preferred.length) return average(preferred);

  const perOs = rows.map((row) => row.trOrdemImpSs).filter((value) => value > 0);
  if (perOs.length) return average(perOs);

  return average(
    rows
      .filter((row) => String(row.status || '').toLowerCase().includes('improdutivo') && row.trOrdem > 0)
      .map((row) => row.trOrdem)
  );
}

function calculateTmrSec(rows) {
  // TR secundário é por OS — média em todas as ordens com valor.
  const values = rows.map((row) => row.trOrdemSec).filter((value) => value > 0);
  return values.length ? average(values) : null;
}

function calculateIntervalo(rows) {
  const dailyTotals = [...groupBy(rows, teamDayKey).values()]
    .map((dayRows) => dailyIntervalMinutes(dayRows))
    .filter((value) => value != null);

  return dailyTotals.length ? average(dailyTotals) : null;
}

// A equipe faz um único intervalo por dia, mas o valor costuma vir repetido em
// cada OS daquele dia. Por isso deduplicamos por assinatura (início/fim/valor).
export function dailyIntervalMinutes(dayRows) {
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

export function intervalMinutes(row) {
  const fromTimes = minutesBetween(row.fimIntervalo, row.inicioIntervalo);
  if (fromTimes != null && fromTimes > 0) return fromTimes;

  if (row.intervalo == null || row.intervalo <= 0) return null;
  // Valores pequenos inteiros (1, 2, 3…) costumam ser contagem de intervalos, não minutos.
  if (Number.isInteger(row.intervalo) && row.intervalo <= 5) return null;
  return row.intervalo;
}

function calculateDailyTrends(rows) {
  // Um ponto por equipe×data (não fragmenta por base no mesmo dia).
  return [...groupBy(rows, teamDayKey).values()].map((groupRows) => {
    const day = coalesceTeamDay(groupRows);
    const eficiencia = ratioPercent(
      sum(groupRows.map((row) => row.tempoPadraoTotalCal)),
      sum(groupRows.map((row) => row.trTotalCal))
    );
    // Preferir campos de jornada coalescidos (evita primeira OS vazia).
    const utilizacao = ratioPercent(day.htTotal, day.hdTotal);
    return {
      date: day.dataReferenciaKey,
      equipe: day.equipe,
      base: day.baseResolvida,
      'OS Dia': osDiaForTeamDay(groupRows),
      'Eficiência': eficiencia,
      'Utilização': utilizacao,
      'Task Time': ratioPercent(day.taskTimeTotalTr, day.hdTotal),
      'TMR Sec': calculateTmrSec(groupRows),
      'TMR Imp': calculateTmrImp(groupRows),
      'Produtividade': calculateProdutividade(eficiencia, utilizacao),
      '1º Login': resolvePrimeiroLogin(day),
      '1º Despacho': resolvePrimeiroDespacho(day),
      '1º Desloc.': resolvePrimeiroDesloc(day),
      'Retorno Base': day.retornoBase,
      'Intervalo': dailyIntervalMinutes(groupRows),
      causas: topCauses(groupRows)
    };
  });
}

function calculatePlatformKpis(rows) {
  const dedupe = coalesceTeamDays(rows);

  const kpis = {
    'OS Dia': calculateOsDia(rows),
    'Eficiência': ratioPercent(sum(dedupe.map((row) => row.tempoPadraoTotalCal)), sum(dedupe.map((row) => row.trTotalCal))),
    'Utilização': ratioPercent(sum(dedupe.map((row) => row.htTotal)), sum(dedupe.map((row) => row.hdTotal))),
    'Task Time': ratioPercent(sum(dedupe.map((row) => row.taskTimeTotalTr)), sum(dedupe.map((row) => row.hdTotal))),
    'TMR Sec': calculateTmrSec(rows),
    'TMR Imp': calculateTmrImp(rows),
    '1º Login': averagePrimeiroLogin(dedupe),
    '1º Despacho': averagePrimeiroDespacho(dedupe),
    '1º Desloc.': averagePrimeiroDesloc(dedupe),
    'Retorno Base': average(dedupe.map((row) => row.retornoBase)),
    'Intervalo': calculateIntervalo(rows)
  };
  kpis['Produtividade'] = calculateProdutividade(kpis['Eficiência'], kpis['Utilização']);
  return kpis;
}

function calculateRankings(teamSummaries, platformKpis = {}) {
  return Object.fromEntries(
    KPI_NAMES.map((kpi) => {
      const threshold = getThreshold(kpi);
      const ranked = teamSummaries
        .filter((team) => team.kpis[kpi] != null)
        .sort((a, b) =>
          threshold.direction === 'higher-is-better' ? b.kpis[kpi] - a.kpis[kpi] : a.kpis[kpi] - b.kpis[kpi]
        );
      const outOfTarget = ranked.filter((team) => {
        const value = team.kpis[kpi];
        if (value == null || Number.isNaN(value)) return false;
        return !isKpiOnTarget(value, threshold);
      });
      const needsImprovement = [...outOfTarget].reverse().slice(0, 3);
      return [
        kpi,
        {
          average: platformKpis[kpi] ?? average(ranked.map((team) => team.kpis[kpi])),
          ranking: ranked,
          top3: ranked.slice(0, 3),
          needsImprovement
        }
      ];
    })
  );
}

function calculateOverview(rows, teams, rankings) {
  let minDate = Number.POSITIVE_INFINITY;
  let maxDate = Number.NEGATIVE_INFINITY;
  const osSet = new Set();
  const intervalTeams = new Set();

  for (const row of rows) {
    const time = typeof row.dataReferenciaDate === 'number'
      ? row.dataReferenciaDate
      : row.dataReferenciaDate instanceof Date
        ? row.dataReferenciaDate.getTime()
        : null;
    if (Number.isFinite(time)) {
      if (time < minDate) minDate = time;
      if (time > maxDate) maxDate = time;
    }
    if (row.nrOrdem) osSet.add(row.nrOrdem);
    if (hasInterval(row)) intervalTeams.add(row.equipe);
  }

  const belowMeta = teams.filter((team) => team.outOfTarget.length > 0);
  const critical = SCORED_KPI_NAMES.map((kpi) => ({
    kpi,
    out: teams.filter((team) => {
      const value = team.kpis[kpi];
      if (value == null || Number.isNaN(value)) return false;
      return !isKpiOnTarget(value, getThreshold(kpi));
    }).length
  })).sort((a, b) => b.out - a.out)[0];

  return {
    totalEquipes: teams.length,
    totalOs: osSet.size,
    periodo: Number.isFinite(minDate)
      ? `${new Date(minDate).toLocaleDateString('pt-BR')} a ${new Date(maxDate).toLocaleDateString('pt-BR')}`
      : '-',
    equipesAbaixoMeta: belowMeta.length,
    equipesComIntervalo: intervalTeams.size,
    kpiMaisCritico: critical?.kpi || '-',
    piorUtilizacao: rankings['Utilização']?.ranking?.at(-1)?.equipe || '-',
    piorRetornoBase: rankings['Retorno Base']?.ranking?.at(-1)?.equipe || '-',
    piorPrimeiroLogin: rankings['1º Login']?.ranking?.at(-1)?.equipe || '-',
    piorPrimeiroDesloc: formatWorstTeam(rankings['1º Desloc.']?.ranking?.at(-1), '1º Desloc.'),
    equipesOciosidade: teams.filter((team) => {
      const value = team.kpis['Utilização'];
      return value != null && value < 70;
    }).length
  };
}

function hasInterval(row) {
  return intervalMinutes(row) != null || row.intervaloInformado === true;
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

function teamDayKey(row) {
  return `${row.equipe}|${row.dataReferenciaKey}`;
}

function hasValue(value) {
  if (value == null || value === '') return false;
  if (typeof value === 'number' && Number.isNaN(value)) return false;
  return true;
}

/** Uma linha por equipe×data, coalescendo campos de jornada. */
export function coalesceTeamDays(rows) {
  return [...groupBy(rows, teamDayKey).values()].map((dayRows) => coalesceTeamDay(dayRows));
}

export function coalesceTeamDay(dayRows) {
  const base = { ...dayRows[0] };
  for (const field of DAY_LEVEL_FIELDS) {
    if (hasValue(base[field])) continue;
    for (let index = 1; index < dayRows.length; index += 1) {
      if (hasValue(dayRows[index][field])) {
        base[field] = dayRows[index][field];
        break;
      }
    }
  }
  return base;
}

// Séries diárias por equipe + consolidado, para a página de Evolutivo.
export function buildEvolution(dailyTrends, kpi) {
  const dates = [...new Set(dailyTrends.map((row) => row.date))].sort(compareDateKey);
  const teams = [...new Set(dailyTrends.map((row) => row.equipe))].sort();

  const series = teams.map((equipe) => ({
    equipe,
    values: dates.map((date) => {
      const match = dailyTrends.find((row) => row.equipe === equipe && row.date === date && row[kpi] != null);
      return match ? match[kpi] : null;
    }),
    causes: dates.map((date) => {
      const match = dailyTrends.find((row) => row.equipe === equipe && row.date === date);
      return match?.causas || [];
    })
  }));

  const ratioKpis = new Set(['Eficiência', 'Utilização', 'Task Time', 'Produtividade']);
  const consolidated = dates.map((date) => {
    const dayValues = dailyTrends.filter((row) => row.date === date && row[kpi] != null).map((row) => row[kpi]);
    if (!dayValues.length) return null;
    // Para KPIs de razão, média simples das equipes do dia (já calculados corretamente por equipe).
    // Mantém comportamento estável sem reabrir Σ/Σ sem denominadores aqui.
    if (ratioKpis.has(kpi)) return avg(dayValues);
    return avg(dayValues);
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
