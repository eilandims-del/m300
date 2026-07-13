import { resolvePrimeiroDesloc } from './platformKpis.js';
import { average, minutesBetween } from '../utils/numberDate.js';
import { groupBy } from './kpiCalculator.js';

const RECOMMENDATIONS = {
  login_tardio: 'A equipe iniciou o login depois do esperado. Reforce o login logo no começo do turno.',
  login_muito_tardio: 'A equipe demorou muito para fazer login. Combine o login como primeira ação do dia.',
  desloc_lento: 'A equipe demorou para sair após receber a OS. Oriente registrar "A Caminho" assim que iniciar o deslocamento.',
  desloc_muito_lento: 'A saída para atendimento demorou muito. Verifique se houve espera, atraso ou falta de registro.',
  despacho_tardio: 'A primeira OS demorou para ser despachada. Veja se a equipe ficou sem demanda no início do dia.',
  sem_desloc_registrado: 'A OS foi despachada, mas não teve "A Caminho". Reforce o registro correto do deslocamento.',
  retorno_alto: 'O retorno ou encerramento após a última OS levou mais tempo que o esperado. Confira rota e horário de fim.',
  retorno_muito_alto: 'O tempo após a última OS ficou muito alto. Confira se houve parada, deslocamento longo ou registro incorreto.',
  retorno_divergente: 'Os horários de intervalo, logoff e retorno não combinam bem. Confira se algum horário foi lançado errado.',
  sem_os_alto: 'A equipe teve pouca produção no dia. Verifique falta de demanda, ociosidade ou problema de despacho.',
  temp_prep_alto: 'A equipe demorou para iniciar o primeiro deslocamento. Reforce a preparação rápida no início da jornada.',
  ociosidade_entre_ordens: 'Houve muito tempo parado entre uma OS e outra. Verifique se faltou despacho ou se houve pausa não registrada.',
  antes_log_off_alto: 'Demorou muito entre a última OS e o logoff. Confira se a equipe encerrou a jornada no horário correto.',
  intervalo_em_deslocamento: 'O intervalo apareceu durante um deslocamento. Confira se o intervalo foi registrado no horário certo.',
  primeiro_desloc_alto: 'O primeiro deslocamento demorou acima da meta. Verifique atraso na saída ou rota inicial longa.',
  tr_excede_hd: 'O tempo executado ficou alto para a jornada disponível. Confira se a duração da OS foi lançada corretamente.',
  tl_excede_hd: 'O tempo de deslocamento ficou muito alto. Confira rota, distância e possíveis registros incorretos.',
  tme_muito_alto: 'O tempo improdutivo ficou alto. Verifique por que a equipe ficou parada ou sem execução.',
  sem_deslocamento: 'Existe tempo de deslocamento sem registro de saída. Reforce o preenchimento do "A Caminho".',
  sem_execucao: 'A OS não mostra execução válida. Confira se houve atendimento real ou lançamento incompleto.',
  eficiencia_mascarada: 'A execução ficou baixa demais perto do tempo padrão. Confira se o tempo realizado foi apontado corretamente.',
  tr_muito_baixo: 'O tempo realizado ficou muito baixo. Confira se a OS foi encerrada cedo demais ou lançada incompleta.',
  deslocamento_curto: 'O deslocamento ficou curto demais para o padrão. Confira se o horário de saída ou chegada foi registrado corretamente.',
  tempo_padrao_vazio: 'A OS está sem tempo padrão. Preencha esse campo para calcular a eficiência corretamente.'
};

const ALERT_DESCRIPTIONS = {
  login_tardio: 'Login feito depois da meta de início da jornada.',
  login_muito_tardio: 'Login feito muito depois da meta de início da jornada.',
  desloc_lento: 'Demora entre o despacho da OS e o registro de saída.',
  desloc_muito_lento: 'Demora alta entre despacho e saída para atendimento.',
  despacho_tardio: 'Primeira OS despachada tarde em relação ao início do dia.',
  sem_desloc_registrado: 'OS despachada sem registro de "A Caminho".',
  retorno_alto: 'Tempo alto após finalizar a última OS do dia.',
  retorno_muito_alto: 'Tempo muito alto após finalizar a última OS do dia.',
  retorno_divergente: 'Horários finais do dia parecem inconsistentes.',
  sem_os_alto: 'Baixa quantidade de OS no dia da equipe.',
  temp_prep_alto: 'Demora para começar o primeiro deslocamento do dia.',
  ociosidade_entre_ordens: 'Tempo parado elevado entre atendimentos.',
  antes_log_off_alto: 'Demora entre a última OS e o logoff.',
  intervalo_em_deslocamento: 'Intervalo registrado dentro de um período de deslocamento.',
  primeiro_desloc_alto: 'Primeiro deslocamento do dia acima da meta.',
  tr_excede_hd: 'Tempo realizado alto em relação às horas disponíveis.',
  tl_excede_hd: 'Tempo de deslocamento alto em relação à jornada.',
  tme_muito_alto: 'Tempo improdutivo acima do esperado.',
  sem_deslocamento: 'Falta registro de deslocamento na OS.',
  sem_execucao: 'OS sem tempo de execução válido.',
  eficiencia_mascarada: 'Eficiência pode estar distorcida por apontamento baixo.',
  tr_muito_baixo: 'Tempo realizado muito baixo para a OS.',
  deslocamento_curto: 'Deslocamento muito curto para o padrão esperado.',
  tempo_padrao_vazio: 'OS sem tempo padrão preenchido.'
};

export const ALERT_LABELS = {
  login_tardio: 'Login tardio',
  login_muito_tardio: 'Login muito tardio',
  desloc_lento: 'Deslocamento lento',
  desloc_muito_lento: 'Deslocamento muito lento',
  despacho_tardio: 'Despacho tardio',
  sem_desloc_registrado: 'Sem deslocamento registrado',
  retorno_alto: 'Retorno base alto',
  retorno_muito_alto: 'Retorno base muito alto',
  retorno_divergente: 'Retorno divergente',
  sem_os_alto: 'Dia com poucas OS',
  temp_prep_alto: 'Preparação inicial longa',
  ociosidade_entre_ordens: 'Ociosidade entre ordens',
  antes_log_off_alto: 'Tempo antes do logoff alto',
  intervalo_em_deslocamento: 'Intervalo em deslocamento',
  primeiro_desloc_alto: '1º deslocamento alto',
  tr_excede_hd: 'TR excede HD',
  tl_excede_hd: 'TL excede HD',
  tme_muito_alto: 'TME muito alto',
  sem_deslocamento: 'Sem deslocamento',
  sem_execucao: 'Sem execução',
  eficiencia_mascarada: 'Eficiência mascarada',
  tr_muito_baixo: 'TR muito baixo',
  deslocamento_curto: 'Deslocamento curto',
  tempo_padrao_vazio: 'Tempo padrão vazio'
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
  const tmeByTeam = new Map(teamSummaries.map((team) => [team.equipe, team.kpis['TME IMP']]));

  for (const row of evidence) {
    addRowAlerts(row, globalTr, globalTl, tmeByTeam.get(row.equipe));
  }

  for (const groupRows of groupBy(evidence, (row) => `${row.equipe}|${row.dataReferenciaKey}`).values()) {
    addDayAlerts(groupRows);
  }

  for (const row of evidence) {
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
  if (row.primeiroLoginCorrigido > 16) row.alerts.push('login_muito_tardio');
  else if (row.primeiroLoginCorrigido > 8) row.alerts.push('login_tardio');

  const primeiroDesloc = resolvePrimeiroDesloc(row);
  if (primeiroDesloc > 37.5) row.alerts.push('desloc_muito_lento');
  else if (primeiroDesloc > 25) row.alerts.push('desloc_lento');

  const despachoDelay = minutesBetween(row.horaPrimeiroDespacho || row.despachada, row.inicioCalendario);
  if (despachoDelay > 10) row.alerts.push('despacho_tardio');
  if ((row.despachada || row.primeiroDespacho) && !row.aCaminho) row.alerts.push('sem_desloc_registrado');

  if (row.retornoBase > 60) row.alerts.push('retorno_muito_alto');
  else if (row.retornoBase > 40) row.alerts.push('retorno_alto');
  const afterInterval = minutesBetween(row.logOffCorrigido || row.logOff, row.fimIntervalo);
  if (afterInterval != null && row.retornoBase && afterInterval < row.retornoBase) row.alerts.push('retorno_divergente');

  const tme = row.trOrdemImpSsEquipe || row.trOrdemImpSs;
  if (tme > 20 || (teamTme && tme >= 1.5 * teamTme)) row.alerts.push('tme_muito_alto');
  if (!row.aCaminho && row.tlOrdem) row.alerts.push('sem_deslocamento');
  if (!row.trOrdem && tme) row.alerts.push('sem_execucao');

  if (row.trOrdem > 0 && row.tempoPadrao > 0 && row.trOrdem < row.tempoPadrao * 0.2 && row.trOrdem < globalTr * 0.2) {
    row.alerts.push('eficiencia_mascarada');
    row.alerts.push('tr_muito_baixo');
  }
  if (globalTl && row.tlOrdem > 0 && row.tlOrdem <= globalTl * 0.25) row.alerts.push('deslocamento_curto');
  if (row.trOrdem > 0 && !row.tempoPadrao) row.alerts.push('tempo_padrao_vazio');
  if (row.hdTotal && row.trOrdem > row.hdTotal * 0.2 && row.trOrdem > row.tempoPadrao) row.alerts.push('tr_excede_hd');
  if (row.hdTotal && globalTl && row.tlOrdem > globalTl && row.tlOrdem > row.hdTotal * 0.3) row.alerts.push('tl_excede_hd');

  const intervalStartInMove = minutesBetween(row.inicioIntervalo, row.aCaminho);
  const intervalEndBeforeArrival = minutesBetween(row.noLocal, row.fimIntervalo);
  if (intervalStartInMove != null && intervalEndBeforeArrival != null && intervalStartInMove >= 0 && intervalEndBeforeArrival >= 0) {
    row.alerts.push('intervalo_em_deslocamento');
  }
}

function addDayAlerts(rows) {
  const ordered = [...rows].sort((a, b) => String(a.aCaminho || '').localeCompare(String(b.aCaminho || '')));
  const first = ordered[0];
  if (!first) return;
  const prep = minutesBetween(first.aCaminho, first.inicioCalendario);
  if (prep >= 15) first.alerts.push('temp_prep_alto');
  if (!rows.some((row) => row.nrOrdem)) first.alerts.push('sem_os_alto');
  const firstDesloc = resolvePrimeiroDesloc(first);
  if (firstDesloc >= 25) first.alerts.push('primeiro_desloc_alto');

  for (let index = 1; index < ordered.length; index += 1) {
    const idle = minutesBetween(ordered[index].aCaminho, ordered[index - 1].liberada);
    if (idle >= 15) ordered[index].alerts.push('ociosidade_entre_ordens');
  }

  const last = ordered.at(-1);
  const beforeLogoff = minutesBetween(last.logOffCorrigido || last.logOff, last.liberada);
  if (beforeLogoff > Math.max(last.retornoBase || 0, 40)) last.alerts.push('antes_log_off_alto');
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

function buildDiagnostic(alerts) {
  if (!alerts.length) return 'Sem alerta operacional relevante.';
  return [...new Set(alerts)].map((alert) => RECOMMENDATIONS[alert] || alert).join(' ');
}

export function recommendationsForTeam(team, alerts) {
  const teamAlerts = alerts.filter((alert) => alert.equipe === team.equipe).map((alert) => alert.alerta);
  const recs = new Set(teamAlerts.map((alert) => RECOMMENDATIONS[alert]).filter(Boolean));
  if ((team.kpis['Utilização'] ?? 100) < 85 && teamAlerts.includes('sem_os_alto')) {
    recs.add('Verificar despacho de incidências e ociosidade entre ordens.');
  }
  if ((team.kpis['Eficiência'] ?? 0) > 120 && teamAlerts.includes('tr_muito_baixo')) {
    recs.add('Auditar apontamento de TR e tempo padrão da OS.');
  }
  return [...recs];
}
