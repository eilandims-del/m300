import * as XLSX from 'xlsx';
import { buildColumnMap, normalizeRows } from '../utils/normalization.js';

const textExtensions = ['csv', 'tsv'];

export async function readInputFile(file, onProgress = null) {
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (textExtensions.includes(extension)) {
    return readLargeDelimitedFile(file, extension, onProgress);
  }

  onProgress?.({ phase: 'reading', percent: 5, message: 'Lendo arquivo Excel...' });
  const buffer = await file.arrayBuffer();
  onProgress?.({ phase: 'parsing', percent: 25, message: 'Interpretando planilha Excel...' });

  // dense:true evita que planilhas grandes sejam representadas como um único
  // objeto com milhões de propriedades (A1, B1, C1...), que pode gerar
  // "Too many properties to enumerate" no Chrome/V8.
  const workbook = XLSX.read(buffer, { type: 'array', dense: true });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!firstSheet) throw new Error('Nenhuma planilha foi encontrada no arquivo.');

  const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: false });
  if (!rows.length) throw new Error('A planilha está vazia ou não contém cabeçalho.');

  onProgress?.({ phase: 'normalizing', percent: 65, message: 'Normalizando dados...' });
  const typedRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: true });
  const { columns, map, warnings } = buildColumnMap(rows);
  const normalizedRows = normalizeRows(rows, map, typedRows);

  if (!normalizedRows.length) {
    throw new Error('Não foi possível identificar linhas válidas com equipe e data de referência.');
  }

  onProgress?.({ phase: 'complete', percent: 100, message: `${normalizedRows.length.toLocaleString('pt-BR')} linhas carregadas.` });

  // Não devolvemos rawRows: manter a planilha original junto com a versão
  // normalizada duplicava desnecessariamente o consumo de memória.
  return { rows: normalizedRows, columns, columnMap: map, warnings };
}

function readLargeDelimitedFile(file, extension, onProgress) {
  return new Promise((resolve, reject) => {
    if (typeof Worker === 'undefined') {
      reject(new Error('Este navegador não oferece o processamento em segundo plano necessário para arquivos CSV grandes.'));
      return;
    }

    const worker = new Worker(new URL('../workers/delimitedFile.worker.js', import.meta.url), { type: 'module' });
    const rows = [];
    const stringPools = createStringPools();
    let metadata = null;
    let settled = false;

    const finishWithError = (message) => {
      if (settled) return;
      settled = true;
      worker.terminate();
      reject(new Error(message || 'Erro ao processar CSV/TSV.'));
    };

    worker.onerror = (event) => {
      finishWithError(event.message || 'Falha no processador de CSV/TSV.');
    };

    worker.onmessage = (event) => {
      const message = event.data || {};

      if (message.type === 'metadata') {
        metadata = message;
        onProgress?.({
          phase: 'parsing',
          percent: 1,
          message: `Arquivo ${message.encoding.toUpperCase()} · separador ${message.delimiter}.`
        });
        return;
      }

      if (message.type === 'rows') {
        // Lotes pequenos evitam uma cópia gigantesca entre o Web Worker e a
        // tela principal. Cada linha já chega normalizada e sem 64 colunas brutas.
        for (const row of message.rows) {
          internRowStrings(row, stringPools);
          rows.push(row);
        }
        return;
      }

      if (message.type === 'progress') {
        const percent = message.totalBytes
          ? Math.min(99, Math.max(1, Math.round((message.processedBytes / message.totalBytes) * 100)))
          : 0;
        onProgress?.({
          phase: 'parsing',
          percent,
          processedRows: message.validCount,
          message: `Processando ${message.validCount.toLocaleString('pt-BR')} linhas... ${percent}%`
        });
        return;
      }

      if (message.type === 'error') {
        finishWithError(message.message);
        return;
      }

      if (message.type === 'complete') {
        if (settled) return;
        settled = true;
        worker.terminate();

        const finalMetadata = metadata || message;
        onProgress?.({
          phase: 'complete',
          percent: 100,
          processedRows: message.validCount,
          message: `${message.validCount.toLocaleString('pt-BR')} linhas carregadas.`
        });

        resolve({
          rows,
          columns: finalMetadata.columns || message.columns || [],
          columnMap: finalMetadata.columnMap || message.columnMap || {},
          warnings: finalMetadata.warnings || message.warnings || []
        });
      }
    };

    onProgress?.({ phase: 'reading', percent: 0, message: 'Preparando leitura do CSV/TSV em blocos...' });
    worker.postMessage({ file, extension });
  });
}


function createStringPools() {
  return new Map([
    ['equipe', new Map()],
    ['dataReferenciaKey', new Map()],
    ['status', new Map()],
    ['classe', new Map()],
    ['causa', new Map()],
    ['baseArquivo', new Map()],
    ['tipoArquivo', new Map()],
    ['periodoArquivo', new Map()]
  ]);
}

function internRowStrings(row, pools) {
  for (const [field, pool] of pools) {
    const value = row[field];
    if (typeof value !== 'string' || !value) continue;
    const interned = pool.get(value);
    if (interned !== undefined) row[field] = interned;
    else pool.set(value, value);
  }
}

// Lê a planilha auxiliar (cadastro de equipes) e devolve as linhas cruas.
export async function readAuxiliaryFile(file) {
  const extension = file.name.split('.').pop()?.toLowerCase();
  const buffer = await file.arrayBuffer();
  const workbook = textExtensions.includes(extension)
    ? XLSX.read(decodeTextFile(buffer), { type: 'string', raw: false, FS: extension === 'tsv' ? '\t' : undefined, dense: true })
    : XLSX.read(buffer, { type: 'array', cellDates: true, dense: true });

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
