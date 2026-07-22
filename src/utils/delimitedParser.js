export function detectTextEncoding(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return 'utf-16le';
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return 'utf-16be';
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return 'utf-8';

  const sampleSize = Math.min(bytes.length, 4096);
  let zeroOdd = 0;
  let zeroEven = 0;
  for (let index = 0; index < sampleSize; index += 1) {
    if (bytes[index] !== 0) continue;
    if (index % 2 === 0) zeroEven += 1;
    else zeroOdd += 1;
  }

  if (zeroOdd > sampleSize / 8) return 'utf-16le';
  if (zeroEven > sampleSize / 8) return 'utf-16be';
  return 'utf-8';
}

export function detectDelimiter(sampleText, extension = '') {
  const firstLine = firstLogicalLine(String(sampleText || '').replace(/^\uFEFF/, ''));
  const candidates = extension === 'tsv' ? ['\t', ';', ','] : ['\t', ';', ','];
  let best = candidates[0];
  let bestCount = -1;

  for (const delimiter of candidates) {
    const count = countDelimiterOutsideQuotes(firstLine, delimiter);
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }

  return bestCount > 0 ? best : extension === 'tsv' ? '\t' : ',';
}

export function createDelimitedParser({ delimiter, onRow }) {
  if (!delimiter || delimiter.length !== 1) throw new Error('Delimitador inválido.');
  if (typeof onRow !== 'function') throw new Error('onRow precisa ser uma função.');

  let field = '';
  let row = [];
  let inQuotes = false;
  let quotePending = false;
  let skipNextLf = false;

  function emitRow() {
    row.push(field);
    field = '';
    onRow(row);
    row = [];
  }

  function feed(text, final = false) {
    const input = String(text || '');
    let index = 0;

    if (quotePending) {
      quotePending = false;
      if (input[0] === '"') {
        field += '"';
        index = 1;
      } else {
        inQuotes = false;
      }
    }

    for (; index < input.length; index += 1) {
      const char = input[index];

      if (skipNextLf) {
        skipNextLf = false;
        if (char === '\n') continue;
      }

      if (inQuotes) {
        if (char !== '"') {
          field += char;
          continue;
        }

        if (index + 1 >= input.length) {
          quotePending = true;
          continue;
        }

        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
        continue;
      }

      if (char === '"' && field.length === 0) {
        inQuotes = true;
      } else if (char === delimiter) {
        row.push(field);
        field = '';
      } else if (char === '\n') {
        emitRow();
      } else if (char === '\r') {
        emitRow();
        skipNextLf = true;
      } else {
        field += char;
      }
    }

    if (!final) return;

    if (quotePending) {
      quotePending = false;
      inQuotes = false;
    }
    if (inQuotes) throw new Error('O arquivo possui um campo entre aspas que não foi fechado.');

    if (field.length > 0 || row.length > 0) emitRow();
  }

  return { feed };
}

function firstLogicalLine(text) {
  let inQuotes = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (inQuotes && text[index + 1] === '"') index += 1;
      else inQuotes = !inQuotes;
    } else if (!inQuotes && (char === '\n' || char === '\r')) {
      return text.slice(0, index);
    }
  }
  return text;
}

function countDelimiterOutsideQuotes(line, delimiter) {
  let count = 0;
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') index += 1;
      else inQuotes = !inQuotes;
    } else if (!inQuotes && char === delimiter) {
      count += 1;
    }
  }
  return count;
}
