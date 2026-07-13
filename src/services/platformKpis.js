import { average, minutesBetween } from '../utils/numberDate.js';

export function resolvePrimeiroLogin(row) {
  if (row.primeiroLoginCorrigido != null && !Number.isNaN(row.primeiroLoginCorrigido)) {
    return row.primeiroLoginCorrigido;
  }
  return minutesBetween(row.logInCorrigido, row.inicioCalendario);
}

export function resolvePrimeiroDespacho(row) {
  if (row.primeiroDespacho != null && !Number.isNaN(row.primeiroDespacho)) {
    return row.primeiroDespacho;
  }
  return minutesBetween(row.horaPrimeiroDespacho || row.despachada, row.inicioCalendario);
}

export function resolvePrimeiroDesloc(row) {
  if (row.primeiroDesloc != null && !Number.isNaN(row.primeiroDesloc)) {
    return row.primeiroDesloc;
  }
  return minutesBetween(row.horaPrimeiroDeslocamento || row.aCaminho, row.inicioCalendario);
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
