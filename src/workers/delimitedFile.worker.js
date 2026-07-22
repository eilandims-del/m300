import { buildColumnMap, normalizeRow } from '../utils/normalization.js';
import { createDelimitedParser, detectDelimiter, detectTextEncoding } from '../utils/delimitedParser.js';

const PROBE_SIZE = 64 * 1024;
const OUTPUT_BATCH_SIZE = 1000;

self.onmessage = async (event) => {
  const { file, extension = '' } = event.data || {};
  if (!(file instanceof Blob)) {
    self.postMessage({ type: 'error', message: 'Arquivo inválido para processamento.' });
    return;
  }

  try {
    const probeBytes = new Uint8Array(await file.slice(0, PROBE_SIZE).arrayBuffer());
    const encoding = detectTextEncoding(probeBytes);
    const sampleText = new TextDecoder(encoding).decode(probeBytes);
    const delimiter = detectDelimiter(sampleText, extension);

    let columns = null;
    let columnMap = null;
    let warnings = [];
    let selectedColumns = [];
    let selectedIndexes = [];
    let outputBatch = [];
    let validCount = 0;
    let sourceRowCount = 0;

    const flushBatch = () => {
      if (!outputBatch.length) return;
      self.postMessage({ type: 'rows', rows: outputBatch });
      outputBatch = [];
    };

    const parser = createDelimitedParser({
      delimiter,
      onRow(values) {
        // Ignora linhas totalmente vazias, comuns no fim de exportações.
        if (!values.some((value) => String(value || '').trim() !== '')) return;

        if (!columns) {
          columns = makeUniqueColumns(values.map((value) => String(value || '').replace(/^\uFEFF/, '').trim()));
          const headerObject = Object.fromEntries(columns.map((column) => [column, '']));
          const mapped = buildColumnMap([headerObject]);
          columnMap = mapped.map;
          warnings = mapped.warnings;

          selectedColumns = [...new Set(Object.values(columnMap).filter(Boolean))];
          selectedIndexes = selectedColumns.map((column) => columns.indexOf(column));

          self.postMessage({
            type: 'metadata',
            columns,
            columnMap,
            warnings,
            delimiter: delimiter === '\t' ? 'TAB' : delimiter,
            encoding
          });
          return;
        }

        sourceRowCount += 1;
        const row = {};
        for (let index = 0; index < selectedColumns.length; index += 1) {
          row[selectedColumns[index]] = values[selectedIndexes[index]] ?? '';
        }

        const normalized = normalizeRow(row, columnMap, sourceRowCount);
        if (!normalized) return;

        validCount += 1;
        outputBatch.push(normalized);
        if (outputBatch.length >= OUTPUT_BATCH_SIZE) flushBatch();
      }
    });

    const reader = file.stream().getReader();
    const decoder = new TextDecoder(encoding);
    let processedBytes = 0;
    let lastProgressBytes = 0;
    let lastProgressAt = 0;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      processedBytes += value.byteLength;
      parser.feed(decoder.decode(value, { stream: true }));

      const now = Date.now();
      if (processedBytes - lastProgressBytes >= 2 * 1024 * 1024 || now - lastProgressAt >= 250) {
        lastProgressBytes = processedBytes;
        lastProgressAt = now;
        self.postMessage({
          type: 'progress',
          processedBytes,
          totalBytes: file.size,
          sourceRowCount,
          validCount
        });
      }
    }

    parser.feed(decoder.decode(), true);
    flushBatch();

    if (!columns) throw new Error('O arquivo está vazio ou não contém cabeçalho.');
    if (!validCount) throw new Error('Não foi possível identificar linhas válidas com equipe e data de referência.');

    self.postMessage({
      type: 'complete',
      sourceRowCount,
      validCount,
      columns,
      columnMap,
      warnings
    });
  } catch (error) {
    self.postMessage({ type: 'error', message: error?.message || 'Erro ao processar CSV/TSV.' });
  }
};

function makeUniqueColumns(values) {
  const counts = new Map();
  return values.map((value, index) => {
    const base = value || `COLUNA_${index + 1}`;
    const count = (counts.get(base) || 0) + 1;
    counts.set(base, count);
    return count === 1 ? base : `${base}_${count}`;
  });
}
