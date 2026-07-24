import fs from 'fs';
import { buildColumnMap, normalizeRows } from '../src/utils/normalization.js';
import { createDelimitedParser, detectDelimiter, detectTextEncoding } from '../src/utils/delimitedParser.js';
import { setPlatformKpiColumns } from '../src/services/platformKpis.js';
import { buildAnalytics, coalesceTeamDays } from '../src/services/kpiCalculator.js';
import { buildAlerts } from '../src/services/alerts.js';
import { buildEvolutionTeamAnalysis } from '../src/services/evolutionAnalysis.js';

const path = 'c:/Users/Lucass/Downloads/Scanner 4.0 - CE - Deslocamentos (1).csv';
const buf = fs.readFileSync(path);
const text = new TextDecoder(detectTextEncoding(buf)).decode(buf);
const delimiter = detectDelimiter(text, 'csv');
const rowsRaw = [];
let columns = null;
const parser = createDelimitedParser({
  delimiter,
  onRow(values) {
    if (!values.some((v) => String(v || '').trim())) return;
    if (!columns) {
      columns = values.map((v) => String(v || '').replace(/^\uFEFF/, '').trim());
      return;
    }
    const row = {};
    columns.forEach((c, i) => {
      row[c] = values[i] ?? '';
    });
    rowsRaw.push(row);
  }
});
parser.feed(text, true);
const { map } = buildColumnMap(rowsRaw);
const rows = normalizeRows(rowsRaw, map);
setPlatformKpiColumns(map);

const analytics = buildAnalytics(rows, { columnMap: map });
const alerts = buildAlerts(rows, analytics.teamSummaries);

const spotfire = {
  '1º Login': 1,
  '1º Despacho': 10,
  '1º Desloc.': 18,
  'Retorno Base': 52,
  'OS Dia': 4.4
};

console.log('=== Cards vs Spotfire ===');
for (const [kpi, target] of Object.entries(spotfire)) {
  const value = analytics.rankings[kpi]?.average;
  console.log(kpi.padEnd(16), Number(value).toFixed(2), 'spotfire', target);
}

// Consistency: team KPI for a team should match average of its dailyTrends
const sampleTeam = analytics.teamSummaries[0];
const teamDays = analytics.dailyTrends.filter((d) => d.equipe === sampleTeam.equipe);
const avgLoginDays = teamDays.map((d) => d['1º Login']).filter((v) => v != null);
const mean = avgLoginDays.reduce((a, b) => a + b, 0) / (avgLoginDays.length || 1);
console.log('\n=== Consistência equipe vs dailyTrends ===');
console.log('equipe', sampleTeam.equipe);
console.log('team 1º Login', sampleTeam.kpis['1º Login']?.toFixed?.(2), 'daily mean', mean.toFixed(2));
console.log('team OS Dia', sampleTeam.kpis['OS Dia']?.toFixed?.(2));
console.log('team Intervalo', sampleTeam.kpis['Intervalo']?.toFixed?.(2));

// Platform alerts should be ~1 per team-day max for login/despacho
const dayKeys = new Set();
let platformAlertRows = 0;
for (const row of alerts.evidenceRows) {
  const hasPlatform = row.alerts.some((a) => ['inicio_ruim', 'despacho_ruim'].includes(a));
  if (!hasPlatform) continue;
  platformAlertRows += 1;
  dayKeys.add(`${row.equipe}|${row.dataReferenciaKey}`);
}
console.log('\n=== Alertas de plataforma ===');
console.log('linhas com inicio/despacho', platformAlertRows, 'equipe×dias únicos', dayKeys.size);
console.log('pareto top', alerts.alertPareto.slice(0, 5));

// Evolutivo platform averages vs team kpis
const evo = buildEvolutionTeamAnalysis(rows, sampleTeam.equipe);
const loginVals = evo.platformDaily.map((d) => d.values['1º Login']?.value).filter((v) => v != null);
const evoAvg = loginVals.reduce((a, b) => a + b, 0) / (loginVals.length || 1);
console.log('\n=== Evolutivo Tempo de plataforma ===');
console.log('evo avg 1º Login', evoAvg.toFixed(2), 'team kpi', sampleTeam.kpis['1º Login']?.toFixed?.(2));

// outOfTarget should not include null KPIs
const nullAsOut = analytics.teamSummaries.filter((t) =>
  Object.entries(t.kpis).some(([kpi, value]) => value == null && t.outOfTarget.includes(kpi))
);
console.log('\n=== outOfTarget com null ===', nullAsOut.length);

// coalesce works
const coalesced = coalesceTeamDays(rows);
console.log('team-days', coalesced.length);

console.log('\nOK');
