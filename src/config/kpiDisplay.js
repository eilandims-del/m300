import { formatNumber } from '../utils/numberDate.js';

export const KPI_HINTS = {
  'OS Dia': 'média de OS concluídas por dia',
  'Eficiência': 'tempo padrão ÷ tempo real',
  'Utilização': 'horas produtivas ÷ horas disponíveis',
  'TME IMP': 'tempo médio em improdutivo',
  '1º Login': 'atraso até o primeiro login',
  '1º Despacho': 'atraso até o primeiro despacho',
  '1º Desloc.': 'tempo até o primeiro deslocamento',
  'Retorno Base': 'tempo de retorno à base',
  Intervalo: 'tempo total em pausa no dia'
};

export const CHART_HINTS = {
  'Ranking OS Dia': KPI_HINTS['OS Dia'],
  'Ranking Utilização': KPI_HINTS['Utilização'],
  'Ranking Retorno Base': KPI_HINTS['Retorno Base'],
  'Ranking Intervalo': KPI_HINTS.Intervalo,
  'Tendência diária OS Dia': KPI_HINTS['OS Dia'],
  'Tendência diária Utilização': KPI_HINTS['Utilização'],
  'Tendência diária 1º Deslocamento': KPI_HINTS['1º Desloc.'],
  'Tendência diária Retorno Base': KPI_HINTS['Retorno Base'],
  'Tendência diária Intervalo': KPI_HINTS.Intervalo,
  'OS x Utilização': 'volume de OS versus taxa de utilização por equipe',
  'Alertas mais recorrentes (Pareto)': 'alertas operacionais mais frequentes no recorte'
};

const UNIT_SUFFIX = {
  percent: '%',
  min: 'min'
};

export function getKpiHint(kpi) {
  return KPI_HINTS[kpi] || '';
}

export function getChartHint(title) {
  return CHART_HINTS[title] || '';
}

export function getKpiUnit(kpi) {
  if (kpi === 'Eficiência' || kpi === 'Utilização') return 'percent';
  if (['1º Login', '1º Despacho', '1º Desloc.', 'Retorno Base', 'Intervalo', 'TME IMP'].includes(kpi)) return 'min';
  return null;
}

export function formatKpiDisplayValue(kpi, value) {
  if (value == null || Number.isNaN(value)) return { main: '-', unit: null };
  const unit = getKpiUnit(kpi);
  return { main: formatNumber(value), unit: UNIT_SUFFIX[unit] || null };
}

export function formatKpiMeta(kpi, meta) {
  if (meta == null || Number.isNaN(meta)) return '-';
  const unit = getKpiUnit(kpi);
  const formatted = formatNumber(meta);
  if (unit === 'percent') return `${formatted}%`;
  if (unit === 'min') return `${formatted} min`;
  return formatted;
}
