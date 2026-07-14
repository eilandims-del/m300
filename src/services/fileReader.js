import * as XLSX from 'xlsx';
import { buildColumnMap, normalizeRows } from '../utils/normalization.js';

const textExtensions = ['csv', 'tsv'];

export async function readInputFile(file) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const buffer = await file.arrayBuffer();
  const workbook = textExtensions.includes(extension)
    ? XLSX.read(decodeTextFile(buffer), { type: 'string', raw: false, FS: extension === 'tsv' ? '\t' : undefined })
    : XLSX.read(buffer, { type: 'array', cellDates: true });

  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error('Nenhuma planilha foi encontrada no arquivo.');

  const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: false });
  if (!rows.length) throw new Error('A planilha está vazia ou não contém cabeçalho.');

  // Segunda leitura com valores crus (Date/serial) para preservar o horário real
  // dos campos de data/hora, que a formatação do Excel pode reduzir só à data.
  const typedRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: true });

  const { columns, map, warnings } = buildColumnMap(rows);
  const normalizedRows = normalizeRows(rows, map, typedRows);
  if (!normalizedRows.length) {
    throw new Error('Não foi possível identificar linhas válidas com equipe e data de referência.');
  }

  return { rows: normalizedRows, rawRows: rows, columns, columnMap: map, warnings };
}

// Lê a planilha auxiliar (cadastro de equipes) e devolve as linhas cruas.
export async function readAuxiliaryFile(file) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const buffer = await file.arrayBuffer();
  const workbook = textExtensions.includes(extension)
    ? XLSX.read(decodeTextFile(buffer), { type: 'string', raw: false, FS: extension === 'tsv' ? '\t' : undefined })
    : XLSX.read(buffer, { type: 'array', cellDates: true });

  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error('A planilha auxiliar não possui abas legíveis.');

  const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: false });
  if (!rows.length) throw new Error('A planilha auxiliar está vazia.');
  return rows;
}

export function decodeTextFile(buffer) {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(bytes.subarray(2));
  }
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(bytes.subarray(3));
  }

  const sample = bytes.subarray(0, Math.min(bytes.length, 2000));
  let zeroOdd = 0;
  for (let index = 1; index < sample.length; index += 2) {
    if (sample[index] === 0) zeroOdd += 1;
  }
  if (zeroOdd > sample.length / 8) {
    return new TextDecoder('utf-16le').decode(bytes);
  }

  return new TextDecoder('utf-8').decode(bytes);
}
