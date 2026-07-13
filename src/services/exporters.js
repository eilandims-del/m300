import { KPI_THRESHOLDS } from '../config/kpiThresholds.js';
import { formatNumber } from '../utils/numberDate.js';
import { recommendationsForTeam } from './alerts.js';

export function downloadJson(filename, data) {
  downloadBlob(filename, JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
}

export function downloadCsv(filename, rows) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(';')]
    .concat(rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(';')))
    .join('\n');
  downloadBlob(filename, `\ufeff${csv}`, 'text/csv;charset=utf-8');
}

export function downloadHtmlReport(filename, report) {
  downloadBlob(filename, buildHtmlReport(report), 'text/html;charset=utf-8');
}

export function buildHtmlReport({ analytics, alerts }) {
  const { overview, teamSummaries, rankings } = analytics;
  const rows = teamSummaries
    .map(
      (team) =>
        `<tr><td>${team.equipe}</td><td>${team.base}</td><td>${team.tipo}</td>${KPI_THRESHOLDS.map(
          ({ kpi }) => `<td>${formatNumber(team.kpis[kpi])}</td>`
        ).join('')}<td>${formatNumber(team.scoreGeral)}</td></tr>`
    )
    .join('');
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Dashboard - M300 - Relatório</title>
  <style>
    body { font-family: Inter, Arial, sans-serif; color: #172033; margin: 32px; }
    h1, h2 { color: #0f3b66; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; font-size: 12px; }
    th, td { border: 1px solid #d8e0eb; padding: 8px; text-align: left; }
    th { background: #edf4ff; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .card { border: 1px solid #d8e0eb; border-radius: 12px; padding: 12px; }
    @media print { button { display: none; } body { margin: 12mm; } }
  </style>
</head>
<body>
  <button onclick="window.print()">Salvar em PDF / Imprimir</button>
  <h1>Dashboard - M300</h1>
  <h2>Resumo</h2>
  <div class="grid">
    <div class="card"><strong>Total de equipes</strong><br>${overview.totalEquipes}</div>
    <div class="card"><strong>Total de OS</strong><br>${overview.totalOs}</div>
    <div class="card"><strong>Período</strong><br>${overview.periodo}</div>
    <div class="card"><strong>KPI crítico</strong><br>${overview.kpiMaisCritico}</div>
  </div>
  <h2>KPIs por equipe</h2>
  <table><thead><tr><th>Equipe</th><th>Base</th><th>Tipo</th>${KPI_THRESHOLDS.map(({ kpi }) => `<th>${kpi}</th>`).join('')}<th>Score</th></tr></thead><tbody>${rows}</tbody></table>
  <h2>Top 3 melhores</h2>
  ${Object.entries(rankings).map(([kpi, data]) => `<h3>${kpi}</h3><ol>${data.top3.map((team) => `<li>${team.equipe}: ${formatNumber(team.kpis[kpi])}</li>`).join('')}</ol>`).join('')}
  <h2>Precisa melhorar (top 3)</h2>
  ${Object.entries(rankings).map(([kpi, data]) => `<h3>${kpi}</h3><ol>${data.needsImprovement.map((team) => `<li>${team.equipe}: ${formatNumber(team.kpis[kpi])}</li>`).join('')}</ol>`).join('')}
  <h2>Análise e recomendações por equipe</h2>
  ${teamSummaries.map((team) => `<h3>${team.equipe}</h3><p>KPIs fora da meta: ${team.outOfTarget.join(', ') || 'nenhum'}.</p><ul>${recommendationsForTeam(team, alerts.teamAlerts).map((rec) => `<li>${rec}</li>`).join('')}</ul>`).join('')}
  <h2>Evidências por OS</h2>
  <table><thead><tr><th>Data</th><th>Equipe</th><th>OS</th><th>Alertas</th><th>Diagnóstico</th></tr></thead><tbody>${alerts.evidenceRows
    .filter((row) => row.alerts.length)
    .slice(0, 200)
    .map((row) => `<tr><td>${row.dataReferenciaKey}</td><td>${row.equipe}</td><td>${row.nrOrdem}</td><td>${row.alerts.join(', ')}</td><td>${row.diagnostic}</td></tr>`)
    .join('')}</tbody></table>
</body></html>`;
}

function downloadBlob(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(value) {
  const text = String(value ?? '');
  return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
