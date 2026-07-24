import { jsPDF } from 'jspdf';
import { PRIMARY_KPIS, getKpiStatus, getThreshold, isKpiOnTarget } from '../config/kpiThresholds.js';
import { RECOMMENDATIONS, formatAlertLabel } from './alerts.js';
import { formatNumber, parseDateTimeBr } from '../utils/numberDate.js';

const MARGIN = 40;
const DARK = [15, 23, 42];
const MUTED = [100, 116, 139];
const BLUE = [15, 59, 102];
const GREEN = [22, 163, 74];
const RED = [220, 38, 38];
const ORANGE = [217, 119, 6];
const LIGHT_BLUE = [237, 244, 255];
const LIGHT_RED = [254, 242, 242];

const ACTION_BY_KPI = {
  'OS Dia': 'Revisar fila de OS, despacho e tempo parado durante o dia.',
  'Eficiência': 'Conferir tempo realizado e tempo padrão das OS com maior desvio.',
  'Utilização': 'Reduzir ociosidade e melhorar distribuição de OS entre as equipes.',
  'Task Time': 'Aumentar o tempo efetivo de execução dentro das horas disponíveis.',
  'TMR Sec': 'Reduzir o tempo de resposta das ordens secundárias.',
  'TMR Imp': 'Agilizar o tratamento das ordens improdutivas sem solução.',
  '1º Login': 'Reforçar login como primeira ação no início da jornada.',
  '1º Despacho': 'Acelerar o envio da primeira OS após o início da jornada.',
  '1º Desloc.': 'Orientar saída rápida e registro de "A Caminho" após o despacho.',
  'Retorno Base': 'Revisar rota da última OS e rotina de encerramento do dia.',
  'Intervalo': 'Conferir se o intervalo está sendo registrado corretamente.'
};

export function generateExecutivePdf({ analytics, alerts, filters }) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const page = { width: doc.internal.pageSize.getWidth(), height: doc.internal.pageSize.getHeight() };
  const report = buildReportData(analytics, alerts);

  drawCover(doc, page, analytics, filters, report);
  drawKpiPage(doc, page, analytics, report);
  drawTeamsPage(doc, page, report);
  drawActionPage(doc, page, report);

  addFooters(doc);
  doc.save('Scanner M300 - Detalhado.pdf');
}

function buildReportData(analytics, alerts) {
  const teams = analytics.teamSummaries || [];
  const visibleKpis = PRIMARY_KPIS;
  const bestTeams = [...teams]
    .sort((a, b) => (b.scoreGeral ?? 0) - (a.scoreGeral ?? 0))
    .slice(0, 5);
  const improvementTeams = [...teams]
    .filter((team) => visibleOutOfTarget(team).length > 0)
    .sort((a, b) => visibleOutOfTarget(b).length - visibleOutOfTarget(a).length || (a.scoreGeral ?? 0) - (b.scoreGeral ?? 0))
    .slice(0, 6);
  const criticalKpis = visibleKpis
    .map((kpi) => ({
      kpi,
      value: analytics.rankings[kpi]?.average,
      out: teams.filter((team) => {
        const value = team.kpis[kpi];
        if (value == null || Number.isNaN(value)) return false;
        return !isKpiOnTarget(value, getThreshold(kpi));
      }).length
    }))
    .sort((a, b) => b.out - a.out)
    .slice(0, 4);
  const topAlerts = (alerts.alertPareto || []).slice(0, 5).map((item) => ({
    ...item,
    label: formatAlertLabel(item.alerta),
    recommendation: RECOMMENDATIONS[item.alerta] || 'Conferir ocorrência com a equipe operacional.'
  }));

  return { bestTeams, improvementTeams, criticalKpis, topAlerts };
}

function drawCover(doc, page, analytics, filters, report) {
  header(doc, page, 'Scanner M300 - Detalhado', 'Resumo para liderança');
  let y = 126;
  const { overview } = analytics;
  const bases = filters?.bases?.length ? filters.bases.join(', ') : 'Todas as bases';
  const criticos = report.criticalKpis.filter((item) => item.out > 0);

  y = drawSummaryCards(doc, page, y, [
    ['Período', overview.periodo || '-'],
    ['Bases', bases],
    ['Equipes', String(overview.totalEquipes ?? '-')],
    ['OS analisadas', formatNumber(overview.totalOs, 0)]
  ]);

  y += 18;
  sectionTitle(doc, y, 'Diagnóstico geral');
  y += 18;
  const diagnostic = criticos.length
    ? `O principal foco de melhoria está em ${criticos.slice(0, 3).map((item) => item.kpi).join(', ')}. Existem ${overview.equipesAbaixoMeta} equipes com pelo menos um KPI fora da meta.`
    : 'O recorte analisado está com os principais KPIs dentro da meta. A recomendação é manter acompanhamento e repetir as melhores práticas.';
  y = paragraph(doc, MARGIN, y, diagnostic, page.width - MARGIN * 2, 12);

  y += 18;
  sectionTitle(doc, y, 'Mensagem principal para gestão');
  y += 18;
  const best = report.bestTeams[0]?.equipe || '-';
  const worst = report.improvementTeams[0]?.equipe || '-';
  const message = `Melhor referência operacional: ${best}. Maior ponto de atenção: ${worst}. O plano deve priorizar as equipes com mais KPIs fora da meta e atacar os alertas mais recorrentes.`;
  y = paragraph(doc, MARGIN, y, message, page.width - MARGIN * 2, 12);

  y += 18;
  simpleBullets(doc, y, 'Alertas mais recorrentes', report.topAlerts.length
    ? report.topAlerts.map((item) => `${item.label}: ${item.quantidade} ocorrência(s)`)
    : ['Sem alertas recorrentes no período.'], ORANGE, page);
}

function drawKpiPage(doc, page, analytics, report) {
  doc.addPage();
  header(doc, page, 'Principais KPIs', 'Resultado médio do período');
  let y = 124;

  sectionTitle(doc, y, 'Leitura rápida');
  y += 20;
  y = drawKpiTable(doc, y, analytics, page);

  y += 20;
  sectionTitle(doc, y, 'KPIs que mais pedem atenção');
  y += 18;
  const items = report.criticalKpis
    .filter((item) => item.out > 0)
    .map((item) => {
      const threshold = getThreshold(item.kpi);
      const hasData = item.value != null && !Number.isNaN(item.value);
      const status = !hasData
        ? 'sem dado'
        : isKpiOnTarget(item.value, threshold)
          ? 'dentro da meta'
          : 'fora da meta';
      return `${item.kpi}: média ${formatNumber(item.value)} (${status}); ${item.out} equipe(s) fora.`;
    });
  simpleBullets(doc, y, items.length ? null : 'Sem pontos críticos', items.length ? items : ['Nenhum KPI crítico no período.'], RED, page);
}

function drawTeamsPage(doc, page, report) {
  doc.addPage();
  header(doc, page, 'Viaturas: destaques e atenção', 'Onde está bom e onde precisa agir');
  let y = 124;

  sectionTitle(doc, y, 'Melhores viaturas');
  y += 18;
  y = report.bestTeams.length
    ? drawTeamCards(doc, y, report.bestTeams, 'best', page)
    : simpleBullets(doc, y, null, ['Sem dados suficientes para ranking.'], MUTED, page);

  y += 16;
  y = ensurePage(doc, page, y, 130);
  sectionTitle(doc, y, 'Viaturas que precisam melhorar');
  y += 18;
  y = report.improvementTeams.length
    ? drawTeamCards(doc, y, report.improvementTeams, 'bad', page)
    : simpleBullets(doc, y, null, ['Nenhuma viatura com KPI fora da meta.'], GREEN, page);
}

function drawActionPage(doc, page, report) {
  doc.addPage();
  header(doc, page, 'O que precisa mudar', 'Plano resumido de ação');
  let y = 124;

  sectionTitle(doc, y, 'Ações prioritárias');
  y += 18;
  const kpiActions = report.criticalKpis
    .filter((item) => item.out > 0)
    .map((item) => `${item.kpi}: ${ACTION_BY_KPI[item.kpi] || 'Acompanhar equipes fora da meta e corrigir desvios.'}`);
  y = simpleBullets(doc, y, null, kpiActions.length ? kpiActions : ['Manter rotina atual e acompanhar desvios pontuais.'], BLUE, page);

  y += 12;
  y = ensurePage(doc, page, y, 170);
  sectionTitle(doc, y, 'O que foi ruim nas viaturas de atenção');
  y += 18;
  const badTeamItems = report.improvementTeams.slice(0, 5).map((team) => {
    const badKpis = visibleOutOfTarget(team).slice(0, 4);
    return `${team.equipe}: piorou em ${badKpis.join(', ')}. Ação: ${bestTeamAction(team)}`;
  });
  y = simpleBullets(doc, y, null, badTeamItems.length ? badTeamItems : ['Sem viaturas críticas no período.'], RED, page);

  y += 12;
  y = ensurePage(doc, page, y, 160);
  sectionTitle(doc, y, 'Diagnóstico dos alertas');
  y += 18;
  const alertActions = report.topAlerts.map((item) => `${item.label}: ${item.recommendation}`);
  simpleBullets(doc, y, null, alertActions.length ? alertActions : ['Sem alertas relevantes no período.'], ORANGE, page);
}

function drawSummaryCards(doc, page, y, cards) {
  const gap = 10;
  const width = (page.width - MARGIN * 2 - gap) / 2;
  cards.forEach(([label, value], index) => {
    const x = MARGIN + (index % 2) * (width + gap);
    const rowY = y + Math.floor(index / 2) * 58;
    doc.setFillColor(...LIGHT_BLUE);
    doc.roundedRect(x, rowY, width, 46, 8, 8, 'F');
    setColor(doc, MUTED);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text(label.toUpperCase(), x + 10, rowY + 16);
    setColor(doc, DARK);
    doc.setFontSize(12);
    doc.text(fitText(doc, String(value ?? '-'), width - 20), x + 10, rowY + 34);
  });
  return y + 116;
}

function drawKpiTable(doc, y, analytics, page) {
  const cols = [MARGIN, MARGIN + 110, MARGIN + 190, MARGIN + 270, MARGIN + 380];
  tableHeader(doc, y, ['KPI', 'Realizado', 'Meta', 'Status', 'Leitura'], cols);
  y += 24;

  PRIMARY_KPIS.forEach((kpi) => {
    const threshold = getThreshold(kpi);
    const value = analytics.rankings[kpi]?.average;
    const status = getKpiStatus(value, threshold);
    y = ensurePage(doc, page, y, 24);
    setColor(doc, DARK);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(kpi, cols[0], y);
    doc.text(formatNumber(value), cols[1], y);
    doc.text(formatNumber(threshold?.meta), cols[2], y);
    setColor(doc, status.onTarget ? GREEN : RED);
    doc.text(status.statusText, cols[3], y);
    setColor(doc, DARK);
    doc.text(status.onTarget ? 'Bom' : 'Precisa melhorar', cols[4], y);
    y += 19;
  });
  return y;
}

function drawTeamCards(doc, y, teams, mode, page) {
  for (const team of teams) {
    y = ensurePage(doc, page, y, 76);
    const badKpis = visibleOutOfTarget(team);
    const fill = mode === 'best' ? [240, 253, 244] : LIGHT_RED;
    const accent = mode === 'best' ? GREEN : RED;
    doc.setFillColor(...fill);
    doc.roundedRect(MARGIN, y, page.width - MARGIN * 2, 62, 8, 8, 'F');
    setColor(doc, accent);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(team.equipe || '-', MARGIN + 10, y + 18);
    setColor(doc, DARK);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const line1 = mode === 'best'
      ? `Score ${formatNumber(team.scoreGeral)} · OS Dia ${formatNumber(team.kpis['OS Dia'])} · Utilização ${formatNumber(team.kpis['Utilização'])}%`
      : `${badKpis.length} KPI(s) fora · Score ${formatNumber(team.scoreGeral)} · Base ${team.base || '-'}`;
    doc.text(fitText(doc, line1, page.width - MARGIN * 2 - 20), MARGIN + 10, y + 36);
    const line2 = mode === 'best'
      ? 'Manter padrão e usar como referência para outras viaturas.'
      : `Ruim em: ${badKpis.slice(0, 5).join(', ') || '-'}`;
    doc.text(fitText(doc, line2, page.width - MARGIN * 2 - 20), MARGIN + 10, y + 52);
    y += 74;
  }
  return y;
}

function simpleBullets(doc, y, title, items, color, page) {
  if (title) {
    sectionTitle(doc, y, title);
    y += 18;
  }
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  for (const item of items) {
    y = ensurePage(doc, page, y, 32);
    setColor(doc, color);
    doc.text('-', MARGIN, y);
    setColor(doc, DARK);
    y = paragraph(doc, MARGIN + 14, y, String(item), page.width - MARGIN * 2 - 14, 11);
    y += 5;
  }
  return y + 4;
}

function header(doc, page, title, subtitle) {
  doc.setFillColor(16, 42, 67);
  doc.rect(0, 0, page.width, 88, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(19);
  doc.text(title, MARGIN, 48);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(167, 243, 208);
  doc.text(subtitle, MARGIN, 68);
  setColor(doc, DARK);
}

function sectionTitle(doc, y, text) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  setColor(doc, BLUE);
  doc.text(text, MARGIN, y);
  doc.setFont('helvetica', 'normal');
}

function tableHeader(doc, y, headers, cols) {
  doc.setFillColor(...LIGHT_BLUE);
  doc.rect(MARGIN - 6, y - 13, 520, 22, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setColor(doc, BLUE);
  headers.forEach((text, index) => doc.text(text, cols[index], y));
  doc.setFont('helvetica', 'normal');
}

function paragraph(doc, x, y, text, maxWidth, lineHeight = 13) {
  const lines = doc.splitTextToSize(String(text ?? '-'), maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function ensurePage(doc, page, y, needed) {
  if (y + needed <= page.height - 46) return y;
  doc.addPage();
  header(doc, page, 'Scanner M300 - Detalhado', 'Continuação');
  return 124;
}

function addFooters(doc) {
  const total = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
    doc.setPage(pageNumber);
    setColor(doc, MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Scanner M300 - Detalhado · Página ${pageNumber} de ${total}`, MARGIN, doc.internal.pageSize.getHeight() - 22);
  }
}

function setColor(doc, rgb) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

// PDF detalhado da Tabela de evidências (uma linha por incidência do recorte).
const EVIDENCE_COLUMNS = [
  { key: 'data', label: 'Data', w: 52 },
  { key: 'equipe', label: 'Equipe', w: 92 },
  { key: 'os', label: 'OS', w: 58 },
  { key: 'causa', label: 'Causa', w: 120, wrap: true },
  { key: 'inicio', label: 'Início', w: 40 },
  { key: 'despachada', label: 'Despach.', w: 44 },
  { key: 'aCaminho', label: 'A Cam.', w: 40 },
  { key: 'noLocal', label: 'No Local', w: 44 },
  { key: 'liberada', label: 'Liberada', w: 44 },
  { key: 'tr', label: 'TR', w: 32, align: 'right' },
  { key: 'tl', label: 'TL', w: 32, align: 'right' },
  { key: 'alertas', label: 'Alertas', w: 180, wrap: true }
];

export function generateEvidencePdf(rows, { teams = [] } = {}) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
  const page = { width: doc.internal.pageSize.getWidth(), height: doc.internal.pageSize.getHeight() };
  const margin = 32;
  const bottom = page.height - 34;

  const cols = [];
  let x = margin;
  for (const column of EVIDENCE_COLUMNS) {
    cols.push({ ...column, x });
    x += column.w;
  }

  const scope = teams.length ? teams.join(', ') : 'Todas as equipes';
  const subtitle = `${formatNumber(rows.length, 0)} incidências · ${scope}`;

  let y = drawEvidenceHeader(doc, page, subtitle);

  doc.setFontSize(7.5);
  rows.forEach((row, index) => {
    const values = evidenceRowValues(row);
    const cellLines = cols.map((column) =>
      column.wrap ? doc.splitTextToSize(values[column.key], column.w - 6) : [values[column.key]]
    );
    const rowHeight = Math.max(...cellLines.map((lines) => lines.length)) * 9 + 6;

    if (y + rowHeight > bottom) {
      y = drawEvidenceHeader(doc, page, subtitle);
      doc.setFontSize(7.5);
    }

    if (index % 2 === 1) {
      doc.setFillColor(244, 247, 251);
      doc.rect(margin, y - 8, page.width - margin * 2, rowHeight, 'F');
    }

    setColor(doc, DARK);
    doc.setFont('helvetica', 'normal');
    cols.forEach((column, columnIndex) => {
      const lines = cellLines[columnIndex];
      const align = column.align === 'right' ? 'right' : 'left';
      const posX = align === 'right' ? column.x + column.w - 6 : column.x + 2;
      doc.text(lines, posX, y, { align });
    });
    y += rowHeight;
  });

  addEvidenceFooters(doc, page);
  doc.save('Scanner M300 - Evidências.pdf');
}

function drawEvidenceHeader(doc, page, subtitle) {
  const margin = 32;
  doc.setFillColor(16, 42, 67);
  doc.rect(0, 0, page.width, 60, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Scanner M300 - Evidências por OS', margin, 30);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(167, 243, 208);
  doc.text(subtitle, margin, 47);

  const y = 78;
  doc.setFillColor(...LIGHT_BLUE);
  doc.rect(margin, y - 11, page.width - margin * 2, 18, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setColor(doc, BLUE);
  let x = margin;
  for (const column of EVIDENCE_COLUMNS) {
    const align = column.align === 'right' ? 'right' : 'left';
    const posX = align === 'right' ? x + column.w - 6 : x + 2;
    doc.text(column.label, posX, y, { align });
    x += column.w;
  }
  doc.setFont('helvetica', 'normal');
  return y + 16;
}

function addEvidenceFooters(doc, page) {
  const total = doc.getNumberOfPages();
  for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
    doc.setPage(pageNumber);
    setColor(doc, MUTED);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Scanner M300 - Evidências · Página ${pageNumber} de ${total}`, 32, page.height - 16);
  }
}

function evidenceRowValues(row) {
  return {
    data: row.dataReferenciaKey || '-',
    equipe: row.equipe || '-',
    os: row.nrOrdem || '-',
    causa: row.causa ? String(row.causa) : '—',
    inicio: pdfTime(row.inicioCalendario),
    despachada: pdfTime(row.despachada),
    aCaminho: pdfTime(row.aCaminho),
    noLocal: pdfTime(row.noLocal),
    liberada: pdfTime(row.liberada),
    tr: row.trOrdem != null ? formatNumber(row.trOrdem, 0) : '-',
    tl: row.tlOrdem != null ? formatNumber(row.tlOrdem, 0) : '-',
    alertas: row.alerts?.length ? row.alerts.map((code) => formatAlertLabel(code)).join(', ') : '—'
  };
}

function pdfTime(value) {
  if (value == null || value === '') return '—';
  const date = parseDateTimeBr(value);
  if (date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  const match = String(value).match(/(\d{1,2}:\d{2})/);
  return match ? match[1] : '—';
}

function visibleOutOfTarget(team) {
  return (team.outOfTarget || []).filter((kpi) => PRIMARY_KPIS.includes(kpi));
}

function bestTeamAction(team) {
  const kpi = visibleOutOfTarget(team)[0];
  return ACTION_BY_KPI[kpi] || 'Acompanhar rotina da equipe e corrigir os maiores desvios.';
}

function fitText(doc, text, maxWidth) {
  const value = String(text ?? '-');
  if (doc.getTextWidth(value) <= maxWidth) return value;
  let output = value;
  while (output.length > 3 && doc.getTextWidth(`${output}...`) > maxWidth) {
    output = output.slice(0, -1);
  }
  return `${output}...`;
}
