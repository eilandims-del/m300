import fs from 'fs';
import { buildColumnMap, normalizeRows } from '../src/utils/normalization.js';
import { createDelimitedParser, detectDelimiter, detectTextEncoding } from '../src/utils/delimitedParser.js';
import { setPlatformKpiColumns } from '../src/services/platformKpis.js';
import { buildAnalytics } from '../src/services/kpiCalculator.js';

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

const spotfire = {
  '1º Login': 1,
  '1º Despacho': 10,
  '1º Desloc.': 18,
  'Retorno Base': 52,
  'OS Dia': 4.4
};

console.log('KPI'.padEnd(16), 'Dashboard'.padStart(10), 'Spotfire'.padStart(10), 'Delta'.padStart(10));
for (const [kpi, target] of Object.entries(spotfire)) {
  const value = analytics.rankings[kpi]?.average;
  const delta = value == null ? null : value - target;
  console.log(
    kpi.padEnd(16),
    Number(value).toFixed(2).padStart(10),
    Number(target).toFixed(1).padStart(10),
    (delta >= 0 ? '+' : '') + Number(delta).toFixed(2).padStart(9)
  );
}

console.log('\nOutros:');
for (const kpi of ['Task Time', 'TMR Sec', 'TMR Imp', 'Utilização', 'Eficiência', 'Intervalo']) {
  console.log(kpi, analytics.rankings[kpi]?.average);
}
