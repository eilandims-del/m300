import { formatNumber } from '../utils/numberDate.js';

export const KPI_HINTS = {
  'OS Dia': 'média de deslocamentos por equipe por dia',
  Produtividade: 'eficiência × utilização',
  'Eficiência': 'tempo padrão ÷ tempo real',
  'Utilização': 'horas produtivas ÷ horas disponíveis',
  'Task Time': 'tempo de execução ÷ horas disponíveis',
  'TMR Sec': 'tempo médio de resposta (secundárias)',
  'TMR Imp': 'tempo médio de resposta (improdutivas SS)',
  '1º Login': 'atraso médio até o primeiro login',
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
  'OS x Utilização': 'volume de OS versus taxa de utilização por equipe',
  'Alertas mais recorrentes (Pareto)': 'alertas operacionais mais frequentes no recorte'
};

const UNIT_SUFFIX = {
  percent: '%',
  min: 'min',
  hour: 'h'
};

export function getKpiHint(kpi) {
  return KPI_HINTS[kpi] || '';
}

export function getChartHint(title) {
  return CHART_HINTS[title] || '';
}

export function getKpiUnit(kpi) {
  if (['Eficiência', 'Utilização', 'Task Time', 'Produtividade'].includes(kpi)) return 'percent';
  if (['1º Login', '1º Despacho', '1º Desloc.', 'Retorno Base', 'Intervalo', 'TMR Sec', 'TMR Imp'].includes(kpi)) return 'min';
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
  if (unit === 'hour') return `${formatted}h`;
  return formatted;
}

// Documentação de cálculo e pontuação (base: indicadores_operacionais / Spotfire).
// Usada no balão informativo próximo à Tabela resumo por equipe.
export const SCORING_TOTAL = 110;

export const SCORING_GUIDE = [
  {
    group: 'Produtividade e eficiência',
    indicators: [
      {
        kpi: 'Task Time',
        max: 23.33,
        formula: 'Σ Task Time Total TR ÷ Σ HD Total',
        range: '0,40 – 0,65',
        better: 'higher',
        note: 'Densidade de trabalho real: quanto do tempo disponível virou execução. Indicador de maior peso.'
      },
      {
        kpi: 'Produtividade',
        max: 0,
        formula: '(Eficiência × Utilização) — derivada',
        range: '—',
        better: 'higher',
        note: 'Indicador informativo: combina eficiência de execução com taxa de utilização. Não pontua separadamente.'
      },
      {
        kpi: 'Eficiência',
        max: 11.7,
        formula: 'Σ TEMPO_PADRAO_TOTAL_CAL ÷ Σ TR_TOTAL_CAL',
        range: '0,80 – 1,15',
        better: 'higher',
        note: 'Acima de 1,0 a equipe executou mais rápido que o tempo padrão previsto.'
      },
      {
        kpi: 'Utilização',
        max: 11.2,
        formula: 'Σ HT total ÷ Σ HD Total',
        range: '0,60 – 0,88',
        better: 'higher',
        note: 'Percentual do tempo disponível efetivamente usado em atividade produtiva.'
      },
      {
        kpi: 'OS Dia',
        max: 16.5,
        formula: 'Média de deslocamentos por equipe por dia',
        range: '1 – 5,5 ativ.',
        better: 'higher',
        note: 'Volume de atendimentos concluídos por dia.'
      }
    ]
  },
  {
    group: 'Task Time e tempos de resposta',
    indicators: [
      {
        kpi: 'TMR Sec',
        max: 18.41,
        formula: 'Média do TR de ordens secundárias (min)',
        range: '45 – 72 min',
        better: 'lower',
        note: 'Agilidade de resposta em ordens secundárias. Menor tempo, mais pontos.'
      },
      {
        kpi: 'TMR Imp',
        max: 13.75,
        formula: 'Média do TR de ordens improdutivas SS (min)',
        range: '17 – 28 min',
        better: 'lower',
        note: 'Rapidez no tratamento de ocorrências improdutivas sem solução.'
      }
    ]
  },
  {
    group: 'Tempo e logística',
    indicators: [
      {
        kpi: '1º Login',
        max: 13.6,
        formula: 'Média de 1º Login Corrigido (min) por equipe×data; pontuação usa hora decimal do login',
        range: 'exibição: meta 8 min · score: 7h – 12h',
        better: 'lower',
        note: 'Exibição: atraso médio até o login (coluna Spotfire). Pontuação interna usa a hora do login.'
      },
      {
        kpi: '1º Desloc.',
        max: 13.6,
        formula: 'Média de 1º Desloc (min) por equipe×data — início calendário → 1º deslocamento',
        range: '20 – 30 min',
        better: 'lower',
        note: 'Agilidade de saída da equipe para o campo. Usa a coluna oficial do Spotfire.'
      },
      {
        kpi: 'Retorno Base',
        max: 7.5,
        formula: 'Tempo médio de retorno à base (min)',
        range: '35 – 50 min',
        better: 'lower',
        note: 'Retornos muito longos podem indicar ineficiência logística.'
      }
    ]
  },
  {
    group: 'Informativos (sem pontuação)',
    indicators: [
      {
        kpi: '1º Despacho',
        max: 0,
        formula: 'Média de 1º Despacho (min) por equipe×data — início calendário → 1º despacho',
        range: '—',
        better: 'lower',
        note: 'Exibido para contexto; não entra na composição do score. Usa a coluna oficial do Spotfire.'
      },
      {
        kpi: 'Intervalo',
        max: 0,
        formula: 'Média do intervalo diário da equipe (min)',
        range: '—',
        better: 'lower',
        note: 'Exibido para contexto; não entra na composição do score.'
      }
    ]
  }
];
