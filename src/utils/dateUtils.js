export { parseDateTimeBr, minutesBetween, formatDateKey } from './numberDate.js';
import { parseDateTimeBr } from './numberDate.js';

// Converte Date -> 'YYYY-MM-DD' (para <input type="date">).
export function toISODate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// 'YYYY-MM-DD' -> Date (meia-noite local). endOfDay=true leva ao fim do dia.
export function fromISODate(value, endOfDay = false) {
  if (!value) return null;
  const [yyyy, mm, dd] = value.split('-').map(Number);
  if (!yyyy || !mm || !dd) return null;
  return endOfDay ? new Date(yyyy, mm - 1, dd, 23, 59, 59, 999) : new Date(yyyy, mm - 1, dd, 0, 0, 0, 0);
}

// Normaliza qualquer valor de data para o início do dia (comparações inclusivas).
export function startOfDay(value) {
  const date = value instanceof Date ? value : parseDateTimeBr(value);
  if (!date) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}
