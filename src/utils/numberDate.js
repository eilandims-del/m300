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
  if (value == null || value === '') return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
  }

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;

    // Valores grandes são timestamps em milissegundos produzidos pela etapa
    // de normalização compacta. Seriais do Excel ficam na faixa de dezenas de
    // milhares, portanto não há ambiguidade prática entre os dois formatos.
    if (Math.abs(value) > 10_000_000_000) {
      const timestampDate = new Date(value);
      return Number.isNaN(timestampDate.getTime()) ? null : timestampDate;
    }

    // Serial do Excel -> hora de parede. O valor é desmontado em UTC e
    // remontado no horário local para impedir deslocamento por fuso horário.
    const utcMs = Date.UTC(1899, 11, 30) + Math.round(value * 86_400_000);
    const excelDate = new Date(utcMs);
    return buildLocalDate(
      excelDate.getUTCFullYear(),
      excelDate.getUTCMonth() + 1,
      excelDate.getUTCDate(),
      excelDate.getUTCHours(),
      excelDate.getUTCMinutes(),
      excelDate.getUTCSeconds(),
      excelDate.getUTCMilliseconds()
    );
  }

  const text = String(value)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}),\s*/, '$1 ');

  if (!text) return null;

  // Regra de negócio: datas com barras/pontos são sempre DIA/MÊS/ANO.
  // Aceita segundos, milissegundos, AM/PM e sufixo de fuso sem delegar a
  // interpretação ambígua ao construtor nativo Date.
  const brMatch = text.match(
    /^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,3}))?)?\s*(AM|PM)?)?(?:\s*(?:Z|[+-]\d{2}:?\d{2}))?$/i
  );
  if (brMatch) {
    const [, day, month, year, hour = '0', minute = '0', second = '0', fraction = '0', meridiem = ''] = brMatch;
    return dateFromParts({ day, month, year, hour, minute, second, fraction, meridiem });
  }

  // Formato ISO explícito: ANO-MÊS-DIA. Também é montado como hora de parede,
  // mantendo o horário visível na planilha e evitando mudança por timezone.
  const isoMatch = text.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,3}))?)?\s*(AM|PM)?)?(?:\s*(?:Z|[+-]\d{2}:?\d{2}))?$/i
  );
  if (isoMatch) {
    const [, year, month, day, hour = '0', minute = '0', second = '0', fraction = '0', meridiem = ''] = isoMatch;
    return dateFromParts({ day, month, year, hour, minute, second, fraction, meridiem });
  }

  // Não usar new Date(text) aqui: strings como 12/06/2026 podem ser
  // interpretadas como MM/DD/YYYY e inverter junho/dezembro silenciosamente.
  return null;
}

function dateFromParts({ day, month, year, hour, minute, second, fraction, meridiem }) {
  const fullYear = Number(String(year).length === 2 ? `20${year}` : year);
  let parsedHour = Number(hour);
  const normalizedMeridiem = String(meridiem || '').toUpperCase();

  if (normalizedMeridiem) {
    if (parsedHour < 1 || parsedHour > 12) return null;
    if (normalizedMeridiem === 'AM') parsedHour %= 12;
    if (normalizedMeridiem === 'PM') parsedHour = (parsedHour % 12) + 12;
  }

  const milliseconds = Number(String(fraction || '0').padEnd(3, '0').slice(0, 3));
  return buildLocalDate(
    fullYear,
    Number(month),
    Number(day),
    parsedHour,
    Number(minute),
    Number(second),
    milliseconds
  );
}

function buildLocalDate(year, month, day, hour = 0, minute = 0, second = 0, millisecond = 0) {
  const values = [year, month, day, hour, minute, second, millisecond];
  if (values.some((item) => !Number.isInteger(item))) return null;
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) return null;
  if (millisecond < 0 || millisecond > 999) return null;

  const date = new Date(year, month - 1, day, hour, minute, second, millisecond);
  const isExact =
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getHours() === hour &&
    date.getMinutes() === minute &&
    date.getSeconds() === second &&
    date.getMilliseconds() === millisecond;

  return isExact ? date : null;
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

export function formatDateTimeBr(value) {
  const date = parseDateTimeBr(value);
  if (!date) return '';
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
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
