import { formatDateKey, parseDateTimeBr, parseNumber } from './numberDate.js';

export function normalizeToken(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/º/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}

export function resolveColumn(candidates, columns = []) {
  const normalized = new Map(columns.map((column) => [normalizeToken(column), column]));
  for (const candidate of candidates) {
    const key = normalizeToken(candidate);
    if (normalized.has(key)) return normalized.get(key);
  }
  for (const candidate of candidates) {
    const key = normalizeToken(candidate);
    const partial = [...normalized.entries()].find(([columnKey]) => columnKey.includes(key) || key.includes(columnKey));
    if (partial) return partial[1];
  }
  return null;
}

export const COLUMN_DEFINITIONS = {
  dataReferencia: ['Data Referência', 'Data Referencia'],
  equipe: ['Equipe'],
  inicioCalendario: ['Inicio Calendario', 'Início Calendário'],
  logIn: ['Log In'],
  logOff: ['Log Off'],
  logInCorrigido: ['Log In Corrigido'],
  logOffCorrigido: ['Log Off Corrigido'],
  inicioIntervalo: ['Inicio Intervalo', 'Início Intervalo'],
  fimIntervalo: ['Fim Intervalo'],
  intervalo: ['Intervalo'],
  nrOrdem: ['Nr_Ordem', 'Nr Ordem', 'NR_ORDEM', 'Numero OS', 'Número OS'],
  despachada: ['Despachada'],
  aCaminho: ['A_Caminho', 'A Caminho'],
  noLocal: ['No_Local', 'No Local'],
  liberada: ['Liberada'],
  htOrdem: ['HT Ordem'],
  trOrdem: ['TR Ordem'],
  tlOrdem: ['TL Ordem'],
  trOrdemImpSs: ['TR Ordem Imp SS'],
  trOrdemImpSsEquipe: ['TR Ordem Imp SS equipe'],
  trOrdemSec: ['TR Ordem Sencundário equipe', 'TR Ordem Secundário equipe', 'TR Ordem Secundário', 'TR Ordem Sencundário', 'TR Ordem Secundario'],
  status: ['status', 'Status'],
  tempoPadrao: ['tempo_padrao'],
  htTotal: ['HT total', 'HT Total'],
  hdTotal: ['HD Total'],
  taskTimeTotalTr: ['Task Time Total TR'],
  trTotalCal: ['TR_TOTAL_CAL'],
  tempoPadraoTotalCal: ['TEMPO_PADRAO_TOTAL_CAL'],
  qtdDeslocamentos: ['Qtd Deslocamentos'],
  primeiroLogin: ['1º Login'],
  primeiroLoginCorrigido: ['1º Login Corrigido'],
  primeiroDesloc: ['1º Desloc', '1º Desloc.'],
  primeiroDespacho: ['1º Despacho'],
  horaPrimeiroDeslocamento: ['Hora 1º Deslocamento'],
  horaPrimeiroDespacho: ['Hora 1º Despacho'],
  horaUltimaOrdem: ['Hora Ultima Ordem', 'Hora Última Ordem'],
  retornoBase: ['Retorno a base', 'Retorno a Base', 'Retorno Base'],
  horasExtras: ['Horas Extras'],
  classe: ['CLASSE'],
  causa: ['CAUSA'],
  base: ['Base'],
  tipoEquipe: ['Tipo Equipe'],
  periodo: ['Período', 'Periodo'],
  desvios: ['Desvios']
};

export const REQUIRED_FOR_KPI = {
  'OS Dia': ['dataReferencia', 'equipe', 'qtdDeslocamentos', 'nrOrdem'],
  'Eficiência': ['tempoPadraoTotalCal', 'trTotalCal'],
  'Utilização': ['htTotal', 'hdTotal'],
  'Task Time': ['taskTimeTotalTr', 'hdTotal'],
  'TMR Sec': ['trOrdemSec'],
  'TMR Imp': ['trOrdemImpSsEquipe', 'status', 'trOrdem'],
  '1º Login': ['primeiroLoginCorrigido', 'logInCorrigido', 'inicioCalendario'],
  '1º Despacho': ['primeiroDespacho', 'horaPrimeiroDespacho', 'despachada', 'inicioCalendario'],
  '1º Desloc.': ['primeiroDesloc', 'horaPrimeiroDeslocamento', 'aCaminho', 'inicioCalendario'],
  'Retorno Base': ['retornoBase'],
  Intervalo: ['inicioIntervalo', 'fimIntervalo', 'intervalo']
};

// Campos de data/hora. Quando a planilha é lida com formatação (raw:false), o
// Excel pode devolver apenas a data (perdendo o horário). Por isso preferimos o
// valor "cru" (Date/serial) desses campos, que preserva o horário real.
const dateTimeFields = [
  'dataReferencia',
  'inicioCalendario',
  'logIn',
  'logOff',
  'logInCorrigido',
  'logOffCorrigido',
  'inicioIntervalo',
  'fimIntervalo',
  'despachada',
  'aCaminho',
  'noLocal',
  'liberada',
  'horaPrimeiroDeslocamento',
  'horaPrimeiroDespacho',
  'horaUltimaOrdem'
];

const numberFields = [
  'htOrdem',
  'trOrdem',
  'tlOrdem',
  'trOrdemImpSs',
  'trOrdemImpSsEquipe',
  'trOrdemSec',
  'tempoPadrao',
  'htTotal',
  'hdTotal',
  'taskTimeTotalTr',
  'trTotalCal',
  'tempoPadraoTotalCal',
  'primeiroLogin',
  'primeiroLoginCorrigido',
  'primeiroDesloc',
  'primeiroDespacho',
  'retornoBase',
  'qtdDeslocamentos',
  'horasExtras',
  'intervalo'
];

export function buildColumnMap(rows) {
  const columns = Object.keys(rows[0] || {});
  const map = Object.fromEntries(
    Object.entries(COLUMN_DEFINITIONS).map(([key, candidates]) => [key, resolveColumn(candidates, columns)])
  );
  const warnings = Object.entries(REQUIRED_FOR_KPI).flatMap(([kpi, fields]) =>
    fields
      .filter((field) => !map[field])
      .map((field) => ({
        kpi,
        field,
        fallback: fallbackText(kpi, field)
      }))
  );
  return { columns, map, warnings };
}

function fallbackText(kpi, field) {
  if (kpi === 'Task Time') return 'Sem Task Time Total TR o indicador Task Time pode ficar indisponível.';
  if (kpi === 'TMR Sec') return 'Sem a coluna de TR de ordens secundárias o TMR Sec pode ficar indisponível.';
  if (kpi === 'TMR Imp') return 'Será usada a alternativa disponível entre improdutivos por status e TR Ordem.';
  if (kpi === '1º Login') return 'Será usado Log In Corrigido - Início Calendário quando disponível.';
  if (kpi === '1º Despacho') return 'Será usada a diferença entre Hora 1º Despacho/Despachada e Início Calendário quando disponível.';
  if (kpi === '1º Desloc.') return 'Será usada a diferença entre Hora 1º Deslocamento/A Caminho e Início Calendário quando disponível.';
  if (kpi === 'Intervalo') return 'Será calculado por Início/Fim Intervalo; a coluna Intervalo só é usada quando representa minutos.';
  return `O KPI ${kpi} pode ficar indisponível ou parcial sem ${field}.`;
}

export function normalizeRows(rows, columnMap, typedRows = null) {
  return rows
    .map((row, index) => {
      const item = { id: index + 1, raw: row };
      const typedRow = typedRows?.[index];
      for (const [field, column] of Object.entries(columnMap)) {
        item[field] = column ? row[column] : null;
      }
      // Usa o valor cru (serial/Date/texto original) dos campos de data/hora,
      // exatamente como está na planilha, sem a formatação que perde o horário.
      if (typedRow) {
        for (const field of dateTimeFields) {
          const column = columnMap[field];
          if (!column) continue;
          const typedValue = typedRow[column];
          if (typedValue !== '' && typedValue != null) {
            item[field] = typedValue;
          }
        }
      }
      for (const field of numberFields) item[field] = parseNumber(item[field]);

      item.dataReferenciaKey = formatDateKey(item.dataReferencia);
      item.dataReferenciaDate = parseDateTimeBr(item.dataReferencia);
      item.equipe = String(item.equipe || '').trim() || 'Equipe não informada';
      item.nrOrdem = String(item.nrOrdem || '').trim();
      // Valores brutos do arquivo principal; a resolução final (auxiliar > prefixo)
      // é aplicada por enrichRows em teamResolver.js.
      item.baseArquivo = String(item.base || '').trim();
      item.tipoArquivo = String(item.tipoEquipe || '').trim();
      item.periodoArquivo = String(item.periodo || '').trim();
      return item;
    })
    .filter((row) => row.equipe && row.dataReferenciaKey);
}
