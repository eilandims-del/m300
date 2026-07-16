import { resolvePrimeiroDesloc } from './platformKpis.js';
import { average, minutesBetween, parseDateTimeBr } from '../utils/numberDate.js';
import { groupBy } from './kpiCalculator.js';

// Ordem canônica dos alertas — segue o fluxo do dia da equipe:
// início → deslocamento → despacho → execução → retorno → encerramento → ociosidade → volume.
export const ALERT_ORDER = [
  'inicio_ruim',
  'deslocamento_ruim',
  'despacho_ruim',
  'execucao_ruim',
  'retorno_ruim',
  'encerramento_ruim',
  'ociosidade',
  'pouca_ordem'
];

const RECOMMENDATIONS = {
  inicio_ruim: 'Oriente a equipe a realizar o login e iniciar o primeiro deslocamento logo no começo do turno.',
  deslocamento_ruim: 'Valide com a equipe o motivo da demora ou da falta de registro de deslocamento e reforce o uso de "A Caminho".',
  despacho_ruim: 'Verifique a disponibilidade de demanda e o fluxo de despacho no início do dia.',
  execucao_ruim: 'Confirme com a equipe se os horários de deslocamento e atendimento foram registrados corretamente.',
  retorno_ruim: 'Verifique com a equipe a rota utilizada e o horário de encerramento após a última OS.',
  encerramento_ruim: 'Alinhe com a equipe o encerramento da jornada e o registro do logoff após a última OS.',
  ociosidade: 'Avalie se houve falta de despacho, pausa não registrada ou oportunidade de redistribuir as ordens.',
  pouca_ordem: 'Avalie a disponibilidade de demanda e a distribuição de OS para a equipe no dia.'
};

const ALERT_DESCRIPTIONS = {
  inicio_ruim: 'A equipe iniciou a jornada após o horário esperado ou demorou para sair para a primeira OS.',
  deslocamento_ruim: 'O deslocamento até a OS teve demora, registro incompleto ou duração fora do padrão.',
  despacho_ruim: 'A primeira OS do dia foi enviada à equipe depois do tempo esperado.',
  execucao_ruim: 'Há divergência nos registros de execução, deslocamento ou duração do atendimento.',
  retorno_ruim: 'O retorno à base após a última OS ficou acima do tempo esperado.',
  encerramento_ruim: 'Houve demora entre a conclusão da última OS e o logoff da equipe.',
  ociosidade: 'Muito tempo parado entre um atendimento e outro.',
  pouca_ordem: 'O volume de OS atendidas no dia ficou abaixo do esperado.'
};

export const ALERT_LABELS = {
  inicio_ruim: 'Início tardio',
  deslocamento_ruim: 'Desvio no deslocamento',
  despacho_ruim: 'Despacho tardio',
  execucao_ruim: 'Execução inconsistente',
  retorno_ruim: 'Retorno alto',
  encerramento_ruim: 'Encerramento tardio',
  ociosidade: 'Ociosidade alta',
  pouca_ordem: 'Baixo volume de OS'
};

export function formatAlertLabel(code) {
  return ALERT_LABELS[code] || String(code || '').replace(/_/g, ' ');
}

export function describeAlert(code) {
  return ALERT_DESCRIPTIONS[code] || 'Alerta operacional que precisa ser conferido.';
}

export function groupAlertCounts(alerts) {
  const counts = new Map();
  for (const alert of alerts) {
    counts.set(alert, (counts.get(alert) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([code, count]) => ({
      code,
      count,
      label: formatAlertLabel(code),
      recommendation: RECOMMENDATIONS[code] || 'Investigar ocorrência com a equipe operacional.'
    }))
    .sort((a, b) => b.count - a.count);
}

export { RECOMMENDATIONS };

export function buildAlerts(rows, teamSummaries) {
  const globalTr = average(rows.map((row) => row.trOrdem).filter((value) => value > 0)) || 0;
  const globalTl = average(rows.map((row) => row.tlOrdem).filter((value) => value > 0)) || 0;
  const evidence = rows.map((row) => ({ ...row, alerts: [], diagnostic: '' }));
  const byId = new Map(evidence.map((row) => [row.id, row]));
  const tmeByTeam = new Map(teamSummaries.map((team) => [team.equipe, team.kpis['TMR Imp']]));

  for (const row of evidence) {
    addRowAlerts(row, globalTr, globalTl, tmeByTeam.get(row.equipe));
  }

  for (const groupRows of groupBy(evidence, (row) => `${row.equipe}|${row.dataReferenciaKey}`).values()) {
    addDayAlerts(groupRows);
  }

  for (const row of evidence) {
    // Cada alerta consolidado aparece só uma vez por OS, mesmo que vários
    // gatilhos internos tenham disparado o mesmo código.
    row.alerts = ALERT_ORDER.filter((code) => row.alerts.includes(code));
    row.diagnostic = buildDiagnostic(row.alerts);
    byId.set(row.id, row);
  }

  return {
    evidenceRows: evidence,
    teamAlerts: summarizeTeamAlerts(evidence),
    alertPareto: summarizePareto(evidence)
  };
}

function addRowAlerts(row, globalTr, globalTl, teamTme) {
  // Início ruim: login tardio em relação à meta de começo da jornada.
  if (row.primeiroLoginCorrigido > 8) row.alerts.push('inicio_ruim');

  // Deslocamento ruim: saída lenta, deslocamento curto demais ou sem registro de "A Caminho".
  const primeiroDesloc = resolvePrimeiroDesloc(row);
  if (primeiroDesloc > 25) row.alerts.push('deslocamento_ruim');
  if ((row.despachada || row.primeiroDespacho) && !row.aCaminho) row.alerts.push('deslocamento_ruim');
  if (globalTl && row.tlOrdem > 0 && row.tlOrdem <= globalTl * 0.25) row.alerts.push('deslocamento_ruim');

  // Despacho ruim: primeira OS despachada tarde em relação ao início do dia.
  const despachoDelay = minutesBetween(row.horaPrimeiroDespacho || row.despachada, row.inicioCalendario);
  if (despachoDelay > 10) row.alerts.push('despacho_ruim');

  // Retorno ruim: tempo alto após finalizar a última OS.
  if (row.retornoBase > 40) row.alerts.push('retorno_ruim');

  // Execução ruim: improdutivo alto, sem registro válido, apontamento baixo demais ou tempo acima da jornada.
  const tme = row.trOrdemImpSsEquipe || row.trOrdemImpSs;
  const eficienciaMascarada = row.trOrdem > 0 && row.tempoPadrao > 0 && row.trOrdem < row.tempoPadrao * 0.2 && row.trOrdem < globalTr * 0.2;
  const trExcedeHd = row.hdTotal && row.trOrdem > row.hdTotal * 0.2 && row.trOrdem > row.tempoPadrao;
  const tlExcedeHd = row.hdTotal && globalTl && row.tlOrdem > globalTl && row.tlOrdem > row.hdTotal * 0.3;
  if (
    tme > 20 ||
    (teamTme && tme >= 1.5 * teamTme) ||
    (!row.aCaminho && row.tlOrdem) ||
    (!row.trOrdem && tme) ||
    eficienciaMascarada ||
    trExcedeHd ||
    tlExcedeHd
  ) {
    row.alerts.push('execucao_ruim');
  }
}

function addDayAlerts(rows) {
  const ordered = [...rows].sort((a, b) => timeValue(a.aCaminho) - timeValue(b.aCaminho));
  const first = ordered[0];
  if (!first) return;

  // Início ruim: preparação inicial longa (demora para o primeiro deslocamento).
  const prep = minutesBetween(first.aCaminho, first.inicioCalendario);
  if (prep >= 15) first.alerts.push('inicio_ruim');

  // Deslocamento ruim: primeiro deslocamento do dia acima da meta.
  const firstDesloc = resolvePrimeiroDesloc(first);
  if (firstDesloc >= 25) first.alerts.push('deslocamento_ruim');

  // Pouca ordem: o dia não registrou nenhuma OS válida.
  if (!rows.some((row) => row.nrOrdem)) first.alerts.push('pouca_ordem');

  // Ociosidade: tempo parado alto entre o fim de uma OS e a saída para a próxima.
  for (let index = 1; index < ordered.length; index += 1) {
    const idle = minutesBetween(ordered[index].aCaminho, ordered[index - 1].liberada);
    if (idle >= 15) ordered[index].alerts.push('ociosidade');
  }

  // Encerramento ruim: demora entre a última OS e o logoff.
  const last = ordered.at(-1);
  const beforeLogoff = minutesBetween(last.logOffCorrigido || last.logOff, last.liberada);
  if (beforeLogoff > Math.max(last.retornoBase || 0, 40)) last.alerts.push('encerramento_ruim');
}

function timeValue(value) {
  const date = parseDateTimeBr(value);
  return date ? date.getTime() : Number.MAX_SAFE_INTEGER;
}

function summarizeTeamAlerts(rows) {
  const pairs = [];
  for (const [key, grouped] of groupBy(rows.flatMap((row) => row.alerts.map((alert) => ({ row, alert }))), (item) => `${item.row.equipe}|${item.alert}`)) {
    const [equipe, alert] = key.split('|');
    pairs.push({
      equipe,
      alerta: alert,
      quantidade: grouped.length,
      piorOcorrencia: grouped[0]?.row.nrOrdem || grouped[0]?.row.dataReferenciaKey || '-',
      recomendacao: RECOMMENDATIONS[alert] || 'Investigar a ocorrência com a equipe operacional.'
    });
  }
  return pairs.sort((a, b) => b.quantidade - a.quantidade);
}

function summarizePareto(rows) {
  const counts = new Map();
  rows.flatMap((row) => row.alerts).forEach((alert) => counts.set(alert, (counts.get(alert) || 0) + 1));
  return [...counts.entries()].map(([alerta, quantidade]) => ({ alerta, quantidade })).sort((a, b) => b.quantidade - a.quantidade);
}

const DIAGNOSTIC_LINES = {
  inicio_ruim: 'o início da jornada ocorreu depois do esperado',
  deslocamento_ruim: 'o deslocamento apresentou demora, registro incompleto ou duração fora do padrão',
  despacho_ruim: 'a primeira OS foi despachada depois do esperado',
  execucao_ruim: 'foram identificadas divergências nos registros de execução da OS',
  retorno_ruim: 'o retorno à base após a última OS ficou acima do esperado',
  encerramento_ruim: 'houve demora entre a última OS e o logoff',
  ociosidade: 'houve tempo elevado sem atendimento entre as OS',
  pouca_ordem: 'o volume de OS atendidas ficou abaixo do esperado'
};

function buildDiagnostic(alerts) {
  const unique = ALERT_ORDER.filter((code) => alerts.includes(code));
  if (!unique.length) return 'Dia dentro do esperado — sem pontos de atenção relevantes.';

  const causes = unique.map((code) => DIAGNOSTIC_LINES[code]).filter(Boolean);
  const cause = joinPtBr(causes);
  const mainRec = RECOMMENDATIONS[unique[0]];
  const intro = unique.length === 1
    ? 'Para acompanhamento do supervisor, foi identificado o seguinte ponto de atenção nesta OS:'
    : `Para acompanhamento do supervisor, foram identificados ${unique.length} pontos de atenção nesta OS:`;

  return `${intro} ${capitalize(cause)}. Ação sugerida: ${mainRec}`;
}

function joinPtBr(items) {
  if (items.length <= 1) return items[0] || '';
  return `${items.slice(0, -1).join(', ')} e ${items.at(-1)}`;
}

function capitalize(text) {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export function recommendationsForTeam(team, alerts) {
  const teamAlerts = alerts.filter((alert) => alert.equipe === team.equipe).map((alert) => alert.alerta);
  const recs = new Set(teamAlerts.map((alert) => RECOMMENDATIONS[alert]).filter(Boolean));
  if ((team.kpis['Utilização'] ?? 100) < 85 && teamAlerts.includes('pouca_ordem')) {
    recs.add('Verificar despacho de incidências e ociosidade entre ordens.');
  }
  if ((team.kpis['Eficiência'] ?? 0) > 120 && teamAlerts.includes('execucao_ruim')) {
    recs.add('Auditar apontamento de tempo realizado e tempo padrão da OS.');
  }
  return [...recs];
}
