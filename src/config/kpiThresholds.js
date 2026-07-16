// Faixas e pontuações dos indicadores, alinhadas à documentação oficial do
// Spotfire (indicadores_operacionais). A função scoreKpi replica as fórmulas
// piecewise do Spotfire (não interpolação genérica).
//
// `scored: false` marca indicadores apenas informativos.
export const KPI_THRESHOLDS = [
  { kpi: 'OS Dia', direction: 'higher-is-better', worst: 1.0, meta: 4.4, metaScore: 12.4667, best: 5.5, maxScore: 16.5 },
  { kpi: 'Produtividade', direction: 'higher-is-better', worst: 60, meta: 85, metaScore: 0, best: 115, maxScore: 0, scored: false },
  { kpi: 'Eficiência', direction: 'higher-is-better', worst: 80, meta: 100, metaScore: 6.6857, best: 115, maxScore: 11.7 },
  { kpi: 'Utilização', direction: 'higher-is-better', worst: 60, meta: 85, metaScore: 10, best: 88, maxScore: 11.2 },
  { kpi: 'Task Time', direction: 'higher-is-better', worst: 40, meta: 55, metaScore: 13.998, best: 65, maxScore: 23.33 },
  { kpi: 'TMR Sec', direction: 'lower-is-better', worst: 72, meta: 55, metaScore: 11.5906, best: 45, maxScore: 18.41 },
  { kpi: 'TMR Imp', direction: 'lower-is-better', worst: 28, meta: 20, metaScore: 10, best: 17, maxScore: 13.75 },
  { kpi: '1º Login', direction: 'lower-is-better', worst: 12, meta: 8, metaScore: 10.88, best: 7, maxScore: 13.6 },
  { kpi: '1º Desloc.', direction: 'lower-is-better', worst: 30, meta: 25, metaScore: 6.8, best: 20, maxScore: 13.6 },
  { kpi: 'Retorno Base', direction: 'lower-is-better', worst: 50, meta: 40, metaScore: 5, best: 35, maxScore: 7.5 },
  { kpi: '1º Despacho', direction: 'lower-is-better', worst: 20, meta: 10, metaScore: 0, best: 5, maxScore: 0, scored: false },
  { kpi: 'Intervalo', direction: 'lower-is-better', worst: 90, meta: 60, metaScore: 0, best: 45, maxScore: 0, scored: false }
];

export const SCORED_KPIS = KPI_THRESHOLDS.filter((item) => item.scored !== false);

export const MAX_TEAM_SCORE = SCORED_KPIS.reduce((sum, item) => sum + item.maxScore, 0);

export const PRIMARY_KPIS = [
  'OS Dia',
  'Produtividade',
  'Eficiência',
  'Utilização',
  'Task Time',
  'TMR Sec',
  'TMR Imp',
  '1º Login',
  '1º Despacho',
  '1º Desloc.',
  'Retorno Base',
  'Intervalo'
];

export const HEATMAP_KPIS = KPI_THRESHOLDS.filter(
  (item) => item.scored !== false || item.kpi === '1º Despacho'
);
export const EVOLUTION_KPIS = [...PRIMARY_KPIS];

export function getThreshold(kpi) {
  return KPI_THRESHOLDS.find((item) => item.kpi === kpi);
}

function asRatio(kpi, value) {
  if (value == null || Number.isNaN(value)) return null;
  if (['Eficiência', 'Utilização', 'Task Time', 'Produtividade'].includes(kpi)) return value / 100;
  return value;
}

// Pontuação Spotfire (fórmulas oficiais do PDF indicadores_operacionais).
export function scoreKpi(value, threshold, { hasData = true } = {}) {
  if (!threshold || threshold.scored === false) return 0;
  if (!hasData) return threshold.maxScore;
  if (value == null || Number.isNaN(value)) return 0;

  const kpi = threshold.kpi;
  const v = asRatio(kpi, value);

  switch (kpi) {
    case 'Eficiência':
      if (v <= 0.8) return 0;
      if (v >= 1.15) return 11.7;
      return v * 50 - 40;
    case 'Utilização':
      if (v <= 0.6) return 0;
      if (v >= 0.88) return 11.2;
      return v * 40 - 24;
    case 'Task Time':
      if (v <= 0.4) return 0;
      if (v >= 0.65) return 23.33;
      return v * 150 - 60;
    case 'OS Dia':
      if (v <= 1) return 0;
      if (v >= 5.5) return 16.5;
      return Math.min(v * 4.412 - 4.413, 16.5);
    case 'TMR Sec':
      if (v <= 45) return 18.41;
      if (v >= 72) return 0;
      return v * -0.682 + 49.1;
    case 'TMR Imp':
      if (v <= 17) return 13.75;
      if (v >= 28) return 0;
      return v * -1.25 + 35;
    case '1º Login':
      // Hora decimal do login (ex.: 8,4 = 08:24).
      if (v <= 7) return 13.6;
      if (v >= 12) return 0;
      return v * -1.25 + 20;
    case '1º Desloc.':
      if (v <= 20) return 13.6;
      if (v >= 30) return 0;
      return v * -1 + 35;
    case 'Retorno Base':
      if (v <= 35) return 7.5;
      if (v >= 50) return 0;
      return v * -0.5 + 25;
    default:
      return 0;
  }
}

export function isKpiOnTarget(value, threshold) {
  if (!threshold || value == null || Number.isNaN(value)) return false;
  return threshold.direction === 'higher-is-better' ? value >= threshold.meta : value <= threshold.meta;
}

export function getKpiStatus(value, threshold) {
  if (!threshold || value == null || Number.isNaN(value)) {
    return { onTarget: false, arrow: 'none', tone: 'neutral', statusText: 'Sem dado' };
  }
  const onTarget = isKpiOnTarget(value, threshold);
  const higher = threshold.direction === 'higher-is-better';
  const arrow = higher ? (onTarget ? 'up' : 'down') : onTarget ? 'down' : 'up';
  return {
    onTarget,
    arrow,
    tone: onTarget ? 'ok' : 'bad',
    statusText: onTarget ? 'Dentro da meta' : 'Fora da meta'
  };
}

// Classificação exibida como no Spotfire (inteiro, soma das pontuações).
export function formatClassificacao(scoreGeral) {
  if (scoreGeral == null || Number.isNaN(scoreGeral)) return '-';
  return Math.round(scoreGeral);
}
