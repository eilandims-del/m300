import { useEffect, useMemo, useState } from 'react';

import { KPI_THRESHOLDS } from '../config/kpiThresholds.js';

import { describeAlert, formatAlertLabel, groupAlertCounts } from '../services/alerts.js';

import { groupBy } from '../services/kpiCalculator.js';

import { MultiSelect } from './MultiSelect.jsx';

import { formatNumber, parseDateTimeBr } from '../utils/numberDate.js';



const SUMMARY_KPIS = KPI_THRESHOLDS.filter(({ kpi }) => kpi !== 'TME IMP');

const MAX_TEAM_SCORE = KPI_THRESHOLDS.reduce((sum, item) => sum + item.maxScore, 0);



const EVIDENCE_METRIC_HEADERS = [

  { label: 'Início cal.', hint: 'Horário de abertura da jornada da equipe (hora)' },

  { label: 'Despachada', hint: 'Momento em que a OS foi despachada (hora)' },

  { label: 'A Caminho', hint: 'Registro de saída para atendimento (hora)' },

  { label: 'No Local', hint: 'Chegada do técnico no endereço (hora)' },

  { label: 'Liberada', hint: 'Encerramento/liberação da OS (hora)' },

  { label: 'TR', hint: 'Tempo Real de execução da ordem (minutos)' },

  { label: 'TL', hint: 'Tempo de Locomoção/deslocamento (minutos)' },

  { label: 'HD', hint: 'Horas Disponíveis do dia da equipe (minutos)' },

  { label: 'T. Padrão', hint: 'Tempo padrão previsto para a OS (minutos)' }

];



export function TeamSummaryTable({ teams }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const rankedTeams = useMemo(

    () => [...teams].sort((a, b) => (b.scoreGeral ?? 0) - (a.scoreGeral ?? 0)),

    [teams]

  );



  return (

    <section className="panel team-summary-panel">

      <div className="section-header collapsible-header">

        <div>

          <h3>Tabela resumo por equipe</h3>

          <p className="section-subtitle">Ranking ordenado pelo score geral, do maior para o menor.</p>

        </div>

        <button type="button" className="collapse-toggle" onClick={() => setIsExpanded((current) => !current)}>

          {isExpanded ? 'Encurtar' : 'Desencurtar'}

        </button>

      </div>

      {!isExpanded ? (

        <p className="collapsed-note">Tabela encurtada. Clique em "Desencurtar" para visualizar o ranking completo.</p>

      ) : (

      <div className="table-wrap">

        <table className="data-table team-summary-table">

          <thead>

            <tr>

              <th>#</th>

              <th>Equipe</th>

              <th>Polo</th>

              <th>Base</th>

              <th>Tipo</th>

              {SUMMARY_KPIS.map(({ kpi }) => <th key={kpi}>{kpi}</th>)}

              <th>KPIs fora</th>

              <th>Score geral</th>

            </tr>

          </thead>

          <tbody>

            {rankedTeams.map((team, index) => (

              <tr key={team.equipe}>

                <td className="rank-cell">{index + 1}</td>

                <td className="team-cell">{team.equipe}</td>

                <td>{team.polo}</td>

                <td>{team.base}</td>

                <td>{team.tipo}</td>

                {SUMMARY_KPIS.map(({ kpi }) => <td key={kpi}>{formatNumber(team.kpis[kpi])}</td>)}

                <td>{team.outOfTarget.filter((kpi) => kpi !== 'TME IMP').length}</td>

                <td className="score-cell" style={scoreCellStyle(team.scoreGeral)}>

                  {formatNumber(team.scoreGeral)}

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

      )}

    </section>

  );

}



export function EvidenceTable({ rows }) {

  const teamOptions = useMemo(

    () => [...new Set(rows.map((row) => row.equipe).filter(Boolean))].sort(),

    [rows]

  );

  const [selectedTeams, setSelectedTeams] = useState([]);

  const [activeRow, setActiveRow] = useState(null);

  const [dateSort, setDateSort] = useState('desc');



  const firstOsIds = useMemo(() => buildFirstOsOfDayIds(rows), [rows]);



  const filteredRows = useMemo(() => {

    if (!selectedTeams.length) return rows;

    const selected = new Set(selectedTeams);

    return rows.filter((row) => selected.has(row.equipe));

  }, [rows, selectedTeams]);



  const displayRows = useMemo(() => {

    const sorted = [...filteredRows].sort((a, b) => compareEvidenceDates(a, b, dateSort));

    return sorted.slice(0, 400);

  }, [filteredRows, dateSort]);



  function toggleDateSort() {

    setDateSort((current) => (current === 'asc' ? 'desc' : 'asc'));

  }



  useEffect(() => {

    if (!activeRow) return undefined;

    const previousOverflow = document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    function onKeyDown(event) {

      if (event.key === 'Escape') setActiveRow(null);

    }

    document.addEventListener('keydown', onKeyDown);

    return () => {

      document.body.style.overflow = previousOverflow;

      document.removeEventListener('keydown', onKeyDown);

    };

  }, [activeRow]);



  return (

    <>

      <section className="panel evidence-panel">

        <div className="panel-toolbar">

          <div>

            <h3>Tabela de evidências por OS</h3>

            <p className="section-subtitle">

              Linha do tempo por equipe: cada dia começa pela 1ª OS (em destaque). Clique numa linha com alerta para ver detalhes.

            </p>

          </div>

          <div className="panel-filter">

            <MultiSelect

              label="Equipes"

              options={teamOptions}

              selected={selectedTeams}

              onChange={setSelectedTeams}

            />

          </div>

        </div>

        <div className="table-wrap evidence-table-wrap">

          <table className="data-table evidence-table">

            <thead>

              <tr className="evidence-group-row">

                <th colSpan={4}>Identificação</th>

                <th colSpan={5} className="evidence-group-timeline">Linha do tempo da OS</th>

                <th colSpan={4} className="evidence-group-tempos">Tempos (min)</th>

                <th aria-hidden="true"></th>

              </tr>

              <tr>

                <th>

                  <button type="button" className="sortable-th" onClick={toggleDateSort}>

                    Data

                    <span className="sort-indicator">{dateSort === 'asc' ? '↑' : '↓'}</span>

                  </button>

                </th>

                <th>Equipe</th>

                <th>OS</th>

                <th>Causa</th>

                {EVIDENCE_METRIC_HEADERS.map(({ label, hint }) => (

                  <HintTh key={label} label={label} hint={hint} />

                ))}

                <th></th>

              </tr>

            </thead>

            <tbody>

              {displayRows.map((row) => {

                const hasDetails = row.alerts.length > 0 || Boolean(row.diagnostic);

                const isFirstOs = firstOsIds.has(row.id);

                const rowClass = [

                  hasDetails ? 'evidence-row-clickable' : 'evidence-row-muted',

                  isFirstOs ? 'evidence-row-first-os' : ''

                ].filter(Boolean).join(' ');

                return (

                  <tr

                    key={row.id}

                    className={rowClass}

                    onClick={hasDetails ? () => setActiveRow(row) : undefined}

                    tabIndex={hasDetails ? 0 : -1}

                    onKeyDown={hasDetails ? (event) => {

                      if (event.key === 'Enter' || event.key === ' ') {

                        event.preventDefault();

                        setActiveRow(row);

                      }

                    } : undefined}

                  >

                    <td className="date-cell">{row.dataReferenciaKey}</td>

                    <td className="team-cell">{row.equipe}</td>

                    <td className={`os-cell${isFirstOs ? ' os-cell-first' : ''}`}>

                      {row.nrOrdem}

                      {isFirstOs && <span className="os-first-tag">1ª do dia</span>}

                    </td>

                    <td className="cause-cell">{row.causa}</td>

                    <td className="time-cell time-cell-start">{formatTime(row.inicioCalendario)}</td>

                    <td className="time-cell">{formatTime(row.despachada)}</td>

                    <td className="time-cell">{formatTime(row.aCaminho)}</td>

                    <td className="time-cell">{formatTime(row.noLocal)}</td>

                    <td className="time-cell">{formatTime(row.liberada)}</td>

                    <td className="num-cell num-cell-start">{formatNumber(row.trOrdem)}</td>

                    <td className="num-cell">{formatNumber(row.tlOrdem)}</td>

                    <td className="num-cell">{formatNumber(row.hdTotal)}</td>

                    <td className="num-cell">{formatNumber(row.tempoPadrao)}</td>

                    <td className="evidence-action-cell">

                      {hasDetails ? (

                        <span className="evidence-badge" title="Ver alertas e diagnóstico">

                          {row.alerts.length || '•'}

                        </span>

                      ) : (

                        <span className="evidence-badge empty">—</span>

                      )}

                    </td>

                  </tr>

                );

              })}

            </tbody>

          </table>

        </div>

      </section>



      {activeRow && (

        <EvidenceDetailModal row={activeRow} onClose={() => setActiveRow(null)} />

      )}

    </>

  );

}



function HintTh({ label, hint }) {

  return (

    <th className="hint-th" title={hint}>

      <span>{label}</span>

    </th>

  );

}



function EvidenceDetailModal({ row, onClose }) {

  const alertTags = useMemo(() => [...new Set(row.alerts)], [row.alerts]);

  const diagnosticItems = useMemo(() => groupAlertCounts(row.alerts), [row.alerts]);



  return (

    <div className="modal-backdrop" onClick={onClose} role="presentation">

      <div

        className="modal-card evidence-modal"

        role="dialog"

        aria-modal="true"

        aria-labelledby="evidence-modal-title"

        onClick={(event) => event.stopPropagation()}

      >

        <header className="modal-header">

          <div>

            <p className="modal-eyebrow">Evidência operacional</p>

            <h3 id="evidence-modal-title">OS {row.nrOrdem || '—'}</h3>

            <p className="modal-subtitle">{row.equipe} · {row.dataReferenciaKey}</p>

          </div>

          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">×</button>

        </header>



        <div className="modal-body">

          <section className="modal-section">

            <h4>Alertas</h4>

            {alertTags.length ? (

              <ul className="alert-tag-list">

                {alertTags.map((alert) => (

                  <li key={alert} title={describeAlert(alert)}>{formatAlertLabel(alert)}</li>

                ))}

              </ul>

            ) : (

              <p className="modal-empty">Nenhum alerta registrado para esta OS.</p>

            )}

          </section>



          <section className="modal-section">

            <h4>Diagnóstico textual</h4>

            {diagnosticItems.length ? (

              <ul className="diagnostic-list">

                {diagnosticItems.map(({ code, label, recommendation }) => (

                  <li key={code} className="diagnostic-item">

                    <strong>{label}</strong>

                    <p>{recommendation}</p>

                  </li>

                ))}

              </ul>

            ) : (

              <p className="diagnostic-text diagnostic-ok">Operação dentro do esperado — nenhuma ação requerida.</p>

            )}

          </section>



          <section className="modal-section modal-meta-grid modal-meta-compact">

            <div><span>Classe</span><strong>{row.classe || '—'}</strong></div>

            <div><span>Causa</span><strong>{row.causa || '—'}</strong></div>

          </section>

        </div>

      </div>

    </div>

  );

}



export function AlertTable({ alerts }) {

  const teamOptions = useMemo(

    () => [...new Set(alerts.map((alert) => alert.equipe).filter(Boolean))].sort(),

    [alerts]

  );

  const [selectedTeams, setSelectedTeams] = useState([]);



  const filteredAlerts = useMemo(() => {

    if (!selectedTeams.length) return alerts;

    const selected = new Set(selectedTeams);

    return alerts.filter((alert) => selected.has(alert.equipe));

  }, [alerts, selectedTeams]);



  return (

    <section className="panel">

      <div className="panel-toolbar">

        <div>

          <h3>Tabela de alertas por equipe</h3>

        </div>

        <div className="panel-filter">

          <MultiSelect

            label="Equipes"

            options={teamOptions}

            selected={selectedTeams}

            onChange={setSelectedTeams}

          />

        </div>

      </div>

      <div className="table-wrap">

        <table className="data-table">

          <thead>

            <tr>

              <th>Equipe</th>

              <th>Alerta</th>

              <th>Quantidade</th>

              <th>Pior ocorrência</th>

              <th>Recomendação operacional</th>

            </tr>

          </thead>

          <tbody>

            {filteredAlerts.slice(0, 300).map((alert) => (

              <tr key={`${alert.equipe}-${alert.alerta}`}>

                <td>{alert.equipe}</td>

                <td>{alert.alerta}</td>

                <td>{alert.quantidade}</td>

                <td>{alert.piorOcorrencia}</td>

                <td>{alert.recomendacao}</td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

    </section>

  );

}



function scoreCellStyle(score) {

  const ratio = Math.min(1, Math.max(0, (score ?? 0) / MAX_TEAM_SCORE));

  const r = Math.round(254 - ratio * (254 - 34));

  const g = Math.round(226 - ratio * (226 - 197));

  const b = Math.round(226 - ratio * (226 - 94));

  const text = ratio > 0.55 ? '#14532d' : ratio > 0.3 ? '#713f12' : '#991b1b';

  return {

    backgroundColor: `rgb(${r}, ${g}, ${b})`,

    color: text,

    fontWeight: 800

  };

}



function compareEvidenceDates(a, b, direction) {

  const dayDiff = evidenceDateTimestamp(a) - evidenceDateTimestamp(b);

  if (dayDiff !== 0) return direction === 'asc' ? dayDiff : -dayDiff;

  // Mesmo dia: agrupa por equipe e segue a linha do tempo do turno,

  // sempre começando pela 1ª OS do dia (ordem cronológica crescente).

  const teamDiff = String(a.equipe || '').localeCompare(String(b.equipe || ''));

  if (teamDiff !== 0) return teamDiff;

  return orderTimestamp(a) - orderTimestamp(b);

}



function evidenceDateTimestamp(row) {

  if (row.dataReferenciaDate instanceof Date && !Number.isNaN(row.dataReferenciaDate.getTime())) {

    return row.dataReferenciaDate.getTime();

  }

  const parsed = parseDateKey(row.dataReferenciaKey);

  return parsed ? parsed.getTime() : 0;

}



function parseDateKey(key) {

  if (!key) return null;

  const [day, month, year] = String(key).split('/').map(Number);

  if (!day || !month || !year) return null;

  return new Date(year, month - 1, day);

}



function buildFirstOsOfDayIds(rows) {

  const firstIds = new Set();



  for (const groupRows of groupBy(rows, (row) => `${row.equipe}|${row.dataReferenciaKey}`).values()) {

    const ordered = [...groupRows].sort((a, b) => orderTimestamp(a) - orderTimestamp(b));

    const first = ordered.find((row) => row.nrOrdem) || ordered[0];

    if (first?.id) firstIds.add(first.id);

  }



  return firstIds;

}



function orderTimestamp(row) {

  const candidates = [row.despachada, row.aCaminho, row.noLocal, row.liberada];

  for (const value of candidates) {

    const date = parseDateTimeBr(value);

    if (date) return date.getTime();

  }

  return Number.MAX_SAFE_INTEGER;

}



function formatTime(value) {

  if (value == null || value === '') return '—';

  const date = parseDateTimeBr(value);

  if (date) {

    const hh = String(date.getHours()).padStart(2, '0');

    const mm = String(date.getMinutes()).padStart(2, '0');

    return `${hh}:${mm}`;

  }

  const text = String(value).trim();

  const match = text.match(/(\d{1,2}:\d{2})/);

  return match ? match[1] : '—';

}


