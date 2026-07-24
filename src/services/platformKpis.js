import { average, minutesBetween, parseDateTimeBr } from '../utils/numberDate.js';

// Flags do schema da planilha carregada. Quando a coluna oficial do Spotfire
// existe no arquivo, células vazias devem ficar de fora da média (como no
// Spotfire) — não inventar o valor a partir de timestamps por OS.
const defaultColumnFlags = {
  hasPrimeiroLoginCorrigido: false,
  hasPrimeiroLogin: false,
  hasPrimeiroDespacho: false,
  hasPrimeiroDesloc: false
};

let columnFlags = { ...defaultColumnFlags };

export function setPlatformKpiColumns(columnMap = {}) {
  columnFlags = {
    hasPrimeiroLoginCorrigido: Boolean(columnMap?.primeiroLoginCorrigido),
    hasPrimeiroLogin: Boolean(columnMap?.primeiroLogin),
    hasPrimeiroDespacho: Boolean(columnMap?.primeiroDespacho),
    hasPrimeiroDesloc: Boolean(columnMap?.primeiroDesloc)
  };
}

export function resetPlatformKpiColumns() {
  columnFlags = { ...defaultColumnFlags };
}

export function getPlatformKpiColumns() {
  return { ...columnFlags };
}

export function loginHourOfDay(row) {
  const date = parseDateTimeBr(row.logInCorrigido || row.logIn);
  if (!date) return null;
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
}

export function averageLoginHour(rows) {
  return averageKpi(rows, loginHourOfDay);
}

/**
 * 1º Login (min): atraso do login em relação ao início do calendário.
 * Preferência: coluna "1º Login Corrigido" (oficial Spotfire; 0 = login antecipado).
 */
export function resolvePrimeiroLogin(row) {
  if (row.primeiroLoginCorrigido != null && !Number.isNaN(row.primeiroLoginCorrigido)) {
    return row.primeiroLoginCorrigido;
  }
  if (columnFlags.hasPrimeiroLoginCorrigido || columnFlags.hasPrimeiroLogin) {
    if (row.primeiroLogin != null && !Number.isNaN(row.primeiroLogin)) return row.primeiroLogin;
    return null;
  }
  if (row.primeiroLogin != null && !Number.isNaN(row.primeiroLogin)) return row.primeiroLogin;

  // Arquivos legados sem a coluna: reconstrói e espelha a regra do Spotfire (mínimo 0).
  const delay = minutesBetween(row.logInCorrigido || row.logIn, row.inicioCalendario);
  if (delay == null || Number.isNaN(delay)) return null;
  return Math.max(0, delay);
}

/**
 * 1º Despacho (min): tempo até o primeiro despacho do dia (equipe×data).
 * Preferência: coluna "1º Despacho". Nunca usa "Despachada" (evento por OS).
 */
export function resolvePrimeiroDespacho(row) {
  if (row.primeiroDespacho != null && !Number.isNaN(row.primeiroDespacho)) {
    return row.primeiroDespacho;
  }
  if (columnFlags.hasPrimeiroDespacho) return null;

  const delay = minutesBetween(row.horaPrimeiroDespacho, row.inicioCalendario);
  if (delay == null || Number.isNaN(delay) || delay < 0) return null;
  return delay;
}

/**
 * 1º Desloc. (min): tempo até o primeiro deslocamento do dia (equipe×data).
 * Preferência: coluna "1º Desloc". Nunca usa "A_Caminho" (evento por OS).
 */
export function resolvePrimeiroDesloc(row) {
  if (row.primeiroDesloc != null && !Number.isNaN(row.primeiroDesloc)) {
    return row.primeiroDesloc;
  }
  if (columnFlags.hasPrimeiroDesloc) return null;

  const delay = minutesBetween(row.horaPrimeiroDeslocamento, row.inicioCalendario);
  if (delay == null || Number.isNaN(delay) || delay < 0) return null;
  return delay;
}

export function averagePrimeiroLogin(rows) {
  return averageKpi(rows, resolvePrimeiroLogin);
}

export function averagePrimeiroDespacho(rows) {
  return averageKpi(rows, resolvePrimeiroDespacho);
}

export function averagePrimeiroDesloc(rows) {
  return averageKpi(rows, resolvePrimeiroDesloc);
}

function averageKpi(rows, resolver) {
  const values = rows.map(resolver).filter((value) => value != null && !Number.isNaN(value));
  return values.length ? average(values) : null;
}
