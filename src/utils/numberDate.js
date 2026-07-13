export function parseNumber(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;

  let text = String(value).trim();
  if (!text) return null;
  text = text.replace(/\s/g, '').replace('%', '');

  const hasComma = text.includes(',');
  const hasDot = text.includes('.');
  if (hasComma && hasDot) {
    const lastComma = text.lastIndexOf(',');
    const lastDot = text.lastIndexOf('.');
    text = lastComma > lastDot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  } else if (hasComma) {
    text = text.replace(',', '.');
  }

  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export function parseDateTimeBr(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number') {
    const excelEpoch = Date.UTC(1899, 11, 30);
    return new Date(excelEpoch + value * 86400000);
  }

  const text = String(value).trim();
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) {
    const parsed = new Date(text);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const [, dd, mm, yyyy, hh = '0', min = '0', ss = '0'] = match;
  const fullYear = yyyy.length === 2 ? `20${yyyy}` : yyyy;
  return new Date(Number(fullYear), Number(mm) - 1, Number(dd), Number(hh), Number(min), Number(ss));
}

export function minutesBetween(later, earlier) {
  const laterDate = parseDateTimeBr(later);
  const earlierDate = parseDateTimeBr(earlier);
  if (!laterDate || !earlierDate) return null;
  return (laterDate.getTime() - earlierDate.getTime()) / 60000;
}

export function formatDateKey(value) {
  const date = parseDateTimeBr(value);
  if (!date) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${date.getFullYear()}`;
}

export function formatNumber(value, decimals = 1) {
  if (value == null || Number.isNaN(value)) return '-';
  return Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export function average(values) {
  const valid = values.filter((value) => value != null && !Number.isNaN(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

export function sum(values) {
  return values.reduce((total, value) => total + (value || 0), 0);
}
