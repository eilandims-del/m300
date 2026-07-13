export const KPI_THRESHOLDS = [
  { kpi: 'OS Dia', direction: 'higher-is-better', worst: 1.0, meta: 4.4, metaScore: 15, best: 5.5, maxScore: 16.5 },
  { kpi: 'Eficiência', direction: 'higher-is-better', worst: 80, meta: 100, metaScore: 10, best: 125, maxScore: 11.7 },
  { kpi: 'Utilização', direction: 'higher-is-better', worst: 60, meta: 85, metaScore: 10, best: 88, maxScore: 11.2 },
  { kpi: 'TME IMP', direction: 'lower-is-better', worst: 28, meta: 20, metaScore: 10, best: 17, maxScore: 13.8 },
  { kpi: '1º Login', direction: 'lower-is-better', worst: 12, meta: 8, metaScore: 5, best: 7, maxScore: 6.3 },
  { kpi: '1º Despacho', direction: 'lower-is-better', worst: 20, meta: 10, metaScore: 5, best: 5, maxScore: 8 },
  { kpi: '1º Desloc.', direction: 'lower-is-better', worst: 30, meta: 25, metaScore: 5, best: 20, maxScore: 10 },
  { kpi: 'Retorno Base', direction: 'lower-is-better', worst: 50, meta: 40, metaScore: 5, best: 35, maxScore: 7.5 },
  { kpi: 'Intervalo', direction: 'lower-is-better', worst: 90, meta: 60, metaScore: 5, best: 45, maxScore: 7 }
];

export const PRIMARY_KPIS = ['OS Dia', 'Eficiência', 'Utilização', '1º Login', '1º Despacho', '1º Desloc.', 'Retorno Base', 'Intervalo'];
export const HEATMAP_KPIS = KPI_THRESHOLDS.filter(({ kpi }) => kpi !== 'TME IMP');
export const EVOLUTION_KPIS = [...PRIMARY_KPIS];

export function getThreshold(kpi) {
  return KPI_THRESHOLDS.find((item) => item.kpi === kpi);
}

export function scoreKpi(value, threshold) {
  if (!threshold || value == null || Number.isNaN(value)) return 0;
  const { direction, worst, meta, metaScore, best, maxScore } = threshold;

  if (direction === 'higher-is-better') {
    if (value <= worst) return 0;
    if (value >= best) return maxScore;
    if (value <= meta) {
      return ((value - worst) / (meta - worst)) * metaScore;
    }
    return metaScore + ((value - meta) / (best - meta)) * (maxScore - metaScore);
  }

  if (value >= worst) return 0;
  if (value <= best) return maxScore;
  if (value >= meta) {
    return ((worst - value) / (worst - meta)) * metaScore;
  }
  return metaScore + ((meta - value) / (meta - best)) * (maxScore - metaScore);
}

export function isKpiOnTarget(value, threshold) {
  if (!threshold || value == null || Number.isNaN(value)) return false;
  return threshold.direction === 'higher-is-better' ? value >= threshold.meta : value <= threshold.meta;
}

// Status visual do KPI (cor + seta + texto), respeitando a direção da meta.
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
