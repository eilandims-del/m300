import { useMemo, useState } from 'react';
import { ChartCard } from '../components/ChartCard.jsx';
import { MultiSelect } from '../components/MultiSelect.jsx';
import { getKpiHint } from '../config/kpiDisplay.js';
import { EVOLUTION_KPIS, getThreshold, isKpiOnTarget } from '../config/kpiThresholds.js';
import { buildEvolution } from '../services/kpiCalculator.js';
import { buildEvolutionTeamAnalysis } from '../services/evolutionAnalysis.js';
import { formatNumber } from '../utils/numberDate.js';

const palette = ['#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#7c3aed', '#0891b2', '#db2777', '#65a30d'];
const MAX_TEAMS = 8;

export function Evolutivo({ rows, analytics }) {
  const [kpiCards, setKpiCards] = useState([{ id: 1, kpi: 'OS Dia', selectedTeams: [], colorOffset: 0 }]);
  const [pendingKpi, setPendingKpi] = useState('Eficiência');
  const [nextCardId, setNextCardId] = useState(2);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [platformTeam, setPlatformTeam] = useState('');
  const dailyTrends = analytics.dailyTrends;

  const teamAnalysis = useMemo(() => buildEvolutionTeamAnalysis(rows, selectedTeam), [rows, selectedTeam]);
  const platformAnalysis = useMemo(() => buildEvolutionTeamAnalysis(rows, platformTeam), [rows, platformTeam]);
  const teamOptions = useMemo(
    () => [...new Set(dailyTrends.map((row) => row.equipe).filter(Boolean))].sort(),
    [dailyTrends]
  );
  const limitedTeams = useMemo(
    () => kpiCards.some((card) => chartHasLimitedTeams(dailyTrends, card)),
    [dailyTrends, kpiCards]
  );

  function addKpi() {
    if (!pendingKpi) return;
    setKpiCards((current) => [
      ...current,
      { id: nextCardId, kpi: pendingKpi, selectedTeams: [], colorOffset: current.length % palette.length },
    ]);
    setNextCardId((current) => current + 1);
  }

  function removeKpi(id) {
    setKpiCards((current) => current.filter((card) => card.id !== id));
  }

  function updateCardTeams(id, selectedTeams) {
    setKpiCards((current) => current.map((card) => (
      card.id === id ? { ...card, selectedTeams } : card
    )));
  }

  return (
    <>
      <section className="panel evo-controls">
        <div className="evo-tabs-block">
          <h3>Comparação de KPIs por equipe</h3>
          <p className="section-subtitle">
            Adicione os KPIs que deseja comparar. Cada gráfico mantém as linhas por equipe e a linha da meta.
          </p>
          <div className="kpi-add-controls">
            <select value={pendingKpi} onChange={(event) => setPendingKpi(event.target.value)}>
              {EVOLUTION_KPIS.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <button type="button" onClick={addKpi} disabled={!pendingKpi}>
              Adicionar KPI
            </button>
          </div>
        </div>
      </section>

      {kpiCards.length === 0 ? (
        <section className="panel"><p>Adicione pelo menos um KPI para comparar as equipes.</p></section>
      ) : dailyTrends.length === 0 ? (
        <section className="panel"><p>Sem dados de evolução para os filtros atuais.</p></section>
      ) : (
        <section className="charts-grid evolution-compare-grid">
          {kpiCards.map((card) => (
            <EvolutionChartCard
              key={card.id}
              card={card}
              dailyTrends={dailyTrends}
              teamOptions={teamOptions}
              onRemove={() => removeKpi(card.id)}
              onTeamsChange={(selectedTeams) => updateCardTeams(card.id, selectedTeams)}
            />
          ))}
        </section>
      )}

      {limitedTeams && (
        <p className="evo-note">Exibindo as primeiras {MAX_TEAMS} equipes. Refine o filtro de equipes para comparar grupos menores.</p>
      )}

      <EvolutionAnalysisPanel analysis={teamAnalysis} selectedTeam={teamAnalysis.selectedTeam} onTeamChange={setSelectedTeam} />
      <PlatformTimePanel
        analysis={platformAnalysis}
        selectedTeam={platformAnalysis.selectedTeam}
        onTeamChange={setPlatformTeam}
      />
    </>
  );
}

function EvolutionChartCard({ card, dailyTrends, teamOptions, onRemove, onTeamsChange }) {
  const { kpi, selectedTeams, colorOffset } = card;
  const evo = useMemo(() => buildEvolution(dailyTrends, kpi), [dailyTrends, kpi]);
  const threshold = getThreshold(kpi);
  const datasets = useMemo(
    () => buildEvolutionDatasets(evo, threshold, selectedTeams, colorOffset),
    [evo, threshold, selectedTeams, colorOffset]
  );

  return (
    <div className="evolution-chart-shell">
      <div className="evolution-card-controls">
        <div className="evolution-team-filter">
          <MultiSelect
            label="Equipes neste gráfico"
            options={teamOptions}
            selected={selectedTeams}
            onChange={onTeamsChange}
          />
        </div>
        <button type="button" className="remove-kpi-button" onClick={onRemove} aria-label={`Remover ${kpi}`}>
          Remover
        </button>
      </div>
      <ChartCard
        title={`Evolução diária — ${kpi}`}
        hint={getKpiHint(kpi)}
        type="line"
        labels={evo.dates}
        datasets={datasets}
        options={evolutionOptions(threshold, kpi)}
      />
    </div>
  );
}

function buildEvolutionDatasets(evo, threshold, selectedTeams, colorOffset = 0) {
  const filteredSeries = filterSeriesByTeams(evo.series, selectedTeams);
  const shownSeries = filteredSeries.slice(0, MAX_TEAMS);
  const datasets = shownSeries.map((serie, index) => {
    const color = palette[(index + colorOffset) % palette.length];
    return {
      label: serie.equipe,
      data: serie.values,
      causesByIndex: serie.causes,
      borderColor: color,
      backgroundColor: color,
      spanGaps: true,
      tension: 0.3,
      pointRadius: 4,
      pointBackgroundColor: serie.values.map((value) => pointColor(value, threshold, color))
    };
  });

  datasets.push({
    label: `Meta (${formatNumber(threshold?.meta)})`,
    data: evo.dates.map(() => threshold?.meta ?? null),
    borderColor: '#94a3b8',
    borderDash: [6, 6],
    pointRadius: 0,
    borderWidth: 2
  });

  return datasets;
}

function chartHasLimitedTeams(dailyTrends, card) {
  const evo = buildEvolution(dailyTrends, card.kpi);
  return filterSeriesByTeams(evo.series, card.selectedTeams).length > MAX_TEAMS;
}

function filterSeriesByTeams(series, selectedTeams) {
  if (!selectedTeams.length) return series;
  const selected = new Set(selectedTeams);
  return series.filter((serie) => selected.has(serie.equipe));
}

function pointColor(value, threshold, fallback) {
  if (value == null) return fallback;
  return isKpiOnTarget(value, threshold) ? fallback : '#dc2626';
}

function evolutionOptions(threshold, kpi) {
  return {
    plugins: {
      legend: { display: true, position: 'bottom' },
      tooltip: {
        callbacks: {
          title: (items) => `Data: ${items[0]?.label ?? ''}`,
          label: (item) => {
            if (item.dataset.label?.startsWith('Meta')) return `Meta: ${formatNumber(threshold?.meta)}`;
            const value = item.parsed.y;
            if (value == null) return `${item.dataset.label}: sem dado`;
            const status = isKpiOnTarget(value, threshold) ? 'Dentro da meta' : 'Fora da meta';
            const base = `${item.dataset.label}: ${formatNumber(value)} (${status})`;
            if (kpi !== 'OS Dia') return base;
            const causes = item.dataset.causesByIndex?.[item.dataIndex] || [];
            return causes.length ? [base, `Causas: ${causes.slice(0, 3).join('; ')}`] : base;
          }
        }
      }
    }
  };
}

function EvolutionAnalysisPanel({ analysis, selectedTeam, onTeamChange }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const maxCause = analysis.causeRanking.reduce((max, item) => Math.max(max, item.count), 0);

  return (
    <section className="panel">
      <div className="section-header collapsible-header">
        <div>
          <h3>Análise</h3>
          <p className="section-subtitle">Causas, incidências e diagnóstico rápido da equipe selecionada.</p>
        </div>
        <button type="button" className="collapse-toggle" onClick={() => setIsExpanded((current) => !current)}>
          {isExpanded ? 'Encurtar' : 'Desencurtar'}
        </button>
      </div>

      {!isExpanded ? (
        <p className="collapsed-note">Análise encurtada. Clique em "Desencurtar" para visualizar os detalhes.</p>
      ) : (
        <>
      <label className="analysis-team-select">
        <span className="filter-label">Equipe analisada</span>
        <select value={selectedTeam} onChange={(event) => onTeamChange(event.target.value)}>
          {analysis.teams.map((team) => <option key={team} value={team}>{team}</option>)}
        </select>
      </label>

      <div className="analysis-grid">
        <div className="analysis-block">
          <h4>Causas das incidências</h4>
          {analysis.causeRanking.length ? (
            <ul className="cause-rank-list">
              {analysis.causeRanking.map((item) => (
                <li key={item.cause}>
                  <span className="cause-rank-name" title={item.cause}>{item.cause}</span>
                  <span className="cause-rank-bar">
                    <span
                      className="cause-rank-fill"
                      style={{ width: `${maxCause > 0 ? (item.count / maxCause) * 100 : 0}%` }}
                    />
                  </span>
                  <span className="cause-rank-count">{item.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="report-empty">Nenhuma causa registrada para esta equipe.</p>
          )}
        </div>
        <div className="analysis-block">
          <h4>Diagnóstico rápido</h4>
          <div className="analysis-summary">
            <div className="analysis-summary-metric">
              <strong>{analysis.incidents.length}</strong>
              <span>incidências analisadas</span>
            </div>
            <p className="analysis-summary-text">
              O "Tempo desde anterior" é medido apenas dentro do mesmo turno da equipe —
              a 1ª OS de cada dia aparece marcada como início do turno. Valores fora da meta
              ficam destacados em vermelho.
            </p>
          </div>
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Data/Hora</th>
              <th>OS</th>
              <th>Causa</th>
              <th>Tempo desde anterior</th>
              <th>1º Login</th>
              <th>1º Despacho</th>
              <th>1º Deslocamento</th>
              <th>Intervalo</th>
              <th>Diagnóstico</th>
            </tr>
          </thead>
          <tbody>
            {analysis.incidents.slice(0, 200).map((incident) => (
              <tr key={incident.id} className={incident.isFirstOfDay ? 'incident-first-of-day' : ''}>
                <td className="date-cell">{incident.data}</td>
                <td>
                  {incident.os}
                  {incident.isFirstOfDay && <span className="incident-first-tag">1ª do dia</span>}
                </td>
                <td>{incident.causa}</td>
                <td>
                  {incident.isFirstOfDay
                    ? <span className="incident-shift-start">Início do turno</span>
                    : incident.minutosDesdeAnterior == null ? '-' : `${formatNumber(incident.minutosDesdeAnterior)} min`}
                </td>
                {incident.statuses.map((status) => (
                  <td key={status.kpi}>
                    {status.value == null ? (
                      <span className="platform-empty">—</span>
                    ) : (
                      <span className={`platform-pill ${status.ok ? 'is-ok' : 'is-bad'}`}>
                        {formatNumber(status.value)}
                      </span>
                    )}
                  </td>
                ))}
                <td className="analysis-diag-cell">{incident.diagnostic}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
        </>
      )}
    </section>
  );
}

const PLATFORM_LABELS = ['1º Login', '1º Despacho', '1º Deslocamento'];

function PlatformTimePanel({ analysis, selectedTeam, onTeamChange }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const daily = analysis.platformDaily || [];

  const averages = useMemo(() => PLATFORM_LABELS.map((label) => {
    const values = daily.map((day) => day.values[label]?.value).filter((value) => value != null);
    const meta = daily.find((day) => day.values[label]?.meta != null)?.values[label]?.meta ?? null;
    const avg = values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
    const threshold = getThreshold(label === '1º Deslocamento' ? '1º Desloc.' : label);
    return { label, avg, meta, ok: isKpiOnTarget(avg, threshold) };
  }), [daily]);

  return (
    <section className="panel">
      <div className="section-header collapsible-header">
        <div>
          <h3>Tempo de plataforma</h3>
          <p className="section-subtitle">Resumo por dia do 1º Login, 1º Despacho e 1º Deslocamento da equipe no período filtrado.</p>
        </div>
        <button type="button" className="collapse-toggle" onClick={() => setIsExpanded((current) => !current)}>
          {isExpanded ? 'Encurtar' : 'Desencurtar'}
        </button>
      </div>

      {!isExpanded ? (
        <p className="collapsed-note">Tempo de plataforma encurtado. Clique em "Desencurtar" para visualizar os detalhes.</p>
      ) : (
        <>
      <label className="analysis-team-select">
        <span className="filter-label">Equipe analisada</span>
        <select value={selectedTeam} onChange={(event) => onTeamChange(event.target.value)}>
          {analysis.teams.map((team) => <option key={team} value={team}>{team}</option>)}
        </select>
      </label>

      <div className="platform-card-grid">
        {averages.map(({ label, avg, meta, ok }) => (
          <article className={`stat-tile ${ok ? 'is-ok' : 'is-bad'}`} key={label}>
            <span className="stat-tile-label">{label}</span>
            <strong className="stat-tile-value">{avg == null ? '—' : `${formatNumber(avg)}`}<small>min</small></strong>
            <span className="stat-tile-meta">Média do período · meta {formatNumber(meta)}</span>
          </article>
        ))}
      </div>

      {daily.length === 0 ? (
        <p className="collapsed-note">Sem registros de plataforma para esta equipe.</p>
      ) : (
        <div className="table-wrap">
          <table className="data-table platform-daily-table">
            <thead>
              <tr>
                <th>Dia</th>
                <th>OS no dia</th>
                {PLATFORM_LABELS.map((label) => <th key={label}>{label}</th>)}
              </tr>
            </thead>
            <tbody>
              {daily.map((day) => (
                <tr key={`platform-day-${day.day}`}>
                  <td className="date-cell">{day.day}</td>
                  <td>{day.osCount}</td>
                  {PLATFORM_LABELS.map((label) => {
                    const item = day.values[label];
                    return (
                      <td key={label}>
                        {item?.value == null ? (
                          <span className="platform-empty">—</span>
                        ) : (
                          <span className={`platform-pill ${item.ok ? 'is-ok' : 'is-bad'}`}>
                            {formatNumber(item.value)} min
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
        </>
      )}
    </section>
  );
}
