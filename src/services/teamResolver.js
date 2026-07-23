import { normalizeToken, resolveColumn } from '../utils/normalization.js';
import { BASES_CONFIG, resolveTeam } from '../config/basesConfig.js';
import { VTR_TEAM_CATALOG, VTR_TEAM_INDEX, resolveTeamPeriod } from '../config/teamCatalog.js';

const AUX_COLUMNS = {
  equipe: ['Equipe', 'Nome Equipe', 'Codigo Equipe', 'Código Equipe', 'Cod Equipe', 'Time'],
  propria: ['Enel', 'Propria', 'Própria', 'Equipe Propria', 'Equipe Própria', 'Equipe Enel'],
  parceira: ['Parceira', 'Equipe Parceira', 'Terceirizada'],
  base: ['Base', 'Localidade', 'Unidade'],
  periodo: ['Periodo', 'Período', 'Turno'],
  tipo: ['Tipo Equipe', 'Tipo'],
  polo: ['Polo', 'Polo', 'Regional', 'Regiao', 'Região']
};

// Lê o cadastro auxiliar aceitando formato "largo" (colunas Própria/Enel + Parceira,
// como o vtr.xlsx) ou formato "longo" (uma equipe por linha).
export function parseAuxiliaryTeams(rows) {
  if (!rows || !rows.length) return { entries: [], index: new Map(), stats: emptyStats() };
  const columns = Object.keys(rows[0]);
  const col = Object.fromEntries(
    Object.entries(AUX_COLUMNS).map(([key, candidates]) => [key, resolveColumn(candidates, columns)])
  );

  const entries = [];
  const isWide = col.propria && col.parceira;

  for (const row of rows) {
    const base = clean(col.base ? row[col.base] : '');
    const periodo = clean(col.periodo ? row[col.periodo] : '');
    const polo = clean(col.polo ? row[col.polo] : '');

    if (isWide) {
      pushEntry(entries, row[col.propria], { base, periodo, tipoEquipe: 'Própria', polo });
      pushEntry(entries, row[col.parceira], { base, periodo, tipoEquipe: 'Parceira', polo });
    } else if (col.equipe) {
      const tipo = clean(col.tipo ? row[col.tipo] : '') || null;
      pushEntry(entries, row[col.equipe], { base, periodo, tipoEquipe: tipo, polo });
    } else if (col.propria) {
      pushEntry(entries, row[col.propria], { base, periodo, tipoEquipe: 'Própria', polo });
    } else if (col.parceira) {
      pushEntry(entries, row[col.parceira], { base, periodo, tipoEquipe: 'Parceira', polo });
    }
  }

  const index = new Map();
  for (const entry of entries) {
    const key = normalizeToken(entry.equipe);
    if (key && !index.has(key)) index.set(key, entry);
  }

  return {
    entries,
    index,
    columnsUsed: col,
    stats: {
      totalEntradas: entries.length,
      totalEquipes: index.size,
      bases: unique(entries.map((entry) => entry.base)),
      periodos: unique(entries.map((entry) => entry.periodo))
    }
  };
}

// Prioridade: catálogo VTR estático > prefixo (basesConfig) > não identificado.
export function resolveTeamMetadata(teamName, auxiliaryTeamTable, fallbackConfig = BASES_CONFIG) {
  const key = normalizeToken(teamName);

  if (VTR_TEAM_INDEX.has(key)) {
    const found = VTR_TEAM_INDEX.get(key);
    return {
      equipe: teamName,
      base: found.base || 'Não identificado',
      periodo: resolveTeamPeriod(teamName, found.periodo),
      tipoEquipe: found.tipoEquipe || 'Não identificado',
      polo: found.polo || byPrefixPolo(teamName, fallbackConfig),
      origem: 'catalogo_vtr'
    };
  }

  const byPrefix = resolveTeam(teamName);
  if (byPrefix && byPrefix.base && byPrefix.base !== 'Não identificada') {
    return {
      equipe: teamName,
      base: byPrefix.base,
      periodo: resolveTeamPeriod(teamName),
      tipoEquipe: byPrefix.tipo,
      polo: byPrefix.polo,
      origem: 'prefixo'
    };
  }

  return {
    equipe: teamName,
    base: 'Não identificado',
    periodo: resolveTeamPeriod(teamName),
    tipoEquipe: 'Não identificado',
    polo: byPrefix?.polo || 'Não identificado',
    origem: 'nao_identificado'
  };
}

// Aplica a resolução de metadados nas linhas normalizadas, respeitando valores do
// próprio arquivo principal quando o cadastro/prefixo não identifica a equipe.
export function enrichRows(rows, auxIndex) {
  // Enriquecimento in-place: evita criar uma segunda cópia completa de todas
  // as incidências após o upload. O array é derivado do arquivo recém-lido e
  // não é compartilhado com outra fonte mutável.
  for (const row of rows) {
    const meta = resolveTeamMetadata(row.equipe, auxIndex, BASES_CONFIG);
    const identified = meta.origem !== 'nao_identificado';
    row.polo = meta.polo;
    row.baseResolvida = identified ? meta.base : row.baseArquivo || 'Não identificado';
    row.tipoResolvido = identified ? meta.tipoEquipe : row.tipoArquivo || 'Não identificado';
    row.periodoResolvido = meta.periodo || row.periodoArquivo || '';
    row.origemMetadata = meta.origem;
  }
  return rows;
}

export function getStaticCatalogStats(rows = []) {
  const teams = unique(rows.map((row) => row.equipe));
  const recognized = teams.filter((team) => VTR_TEAM_INDEX.has(normalizeToken(team)));
  return {
    totalPrincipais: teams.length,
    totalReconhecidas: recognized.length,
    naoEncontradas: teams.filter((team) => !VTR_TEAM_INDEX.has(normalizeToken(team))),
    bases: unique(VTR_TEAM_CATALOG.map((entry) => entry.base)),
    periodos: unique(VTR_TEAM_CATALOG.map((entry) => entry.periodo))
  };
}

// Estatísticas de reconhecimento para a validação visual do cadastro auxiliar.
export function buildRecognitionStats(rows, auxParsed) {
  const teams = unique(rows.map((row) => row.equipe));
  const index = auxParsed?.index;
  const recognized = [];
  const notFound = [];
  for (const team of teams) {
    if (index && index.has(normalizeToken(team))) recognized.push(team);
    else notFound.push(team);
  }
  return {
    totalPrincipais: teams.length,
    totalReconhecidas: recognized.length,
    naoEncontradas: notFound,
    bases: auxParsed?.stats?.bases || [],
    periodos: auxParsed?.stats?.periodos || []
  };
}

function byPrefixPolo(teamName, fallbackConfig) {
  const byPrefix = resolveTeam(teamName);
  return byPrefix?.polo && byPrefix.polo !== 'Não identificado' ? byPrefix.polo : 'Não identificado';
}

function pushEntry(entries, rawName, meta) {
  const equipe = clean(rawName);
  if (!equipe) return;
  entries.push({ equipe, ...meta });
}

function clean(value) {
  return String(value ?? '').trim();
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort();
}

function emptyStats() {
  return { totalEntradas: 0, totalEquipes: 0, bases: [], periodos: [] };
}
