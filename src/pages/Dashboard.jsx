import { useMemo, useState } from 'react';
import { ChartCard } from '../components/ChartCard.jsx';
import { KpiCard } from '../components/KpiCard.jsx';
import { MultiSelect } from '../components/MultiSelect.jsx';
import { EvidenceTable, TeamSummaryTable } from '../components/Tables.jsx';
import { ReportPanel } from '../components/ReportPanel.jsx';
import { getChartHint } from '../config/kpiDisplay.js';
import { HEATMAP_KPIS, PRIMARY_KPIS, getKpiStatus, getThreshold } from '../config/kpiThresholds.js';
import { describeAlert, formatAlertLabel } from '../services/alerts.js';
import { formatNumber } from '../utils/numberDate.js';

const palette = ['#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#7c3aed', '#0891b2'];

export function Dashboard({ dataset, analytics, alerts, onGeneratePdf, pdfBusy }) {
  const { overview } = analytics;
  const allTeams = useMemo(
    () => analytics.teamSummaries.map((team) => team.equipe),
    [analytics.teamSummaries]
  );
  const [heatmapTeams, setHeatmapTeams] = useState([]);

  const filteredHeatmapTeams = useMemo(() => {
    if (!heatmapTeams.length) return analytics.teamSummaries;
    const selected = new Set(heatmapTeams);
    return analytics.teamSummaries.filter((team) => selected.has(team.equipe));
  }, [analytics.teamSummaries, heatmapTeams]);

  const sortedPrimaryKpis = useMemo(() => {
    return [...PRIMARY_KPIS].sort((a, b) => {
      const aStatus = getKpiStatus(analytics.rankings[a]?.average, getThreshold(a));
      const bStatus = getKpiStatus(analytics.rankings[b]?.average, getThreshold(b));
      const aRank = aStatus.onTarget ? 0 : 1;
      const bRank = bStatus.onTarget ? 0 : 1;
      if (aRank !== bRank) return aRank - bRank;
      return PRIMARY_KPIS.indexOf(a) - PRIMARY_KPIS.indexOf(b);
    });
  }, [analytics.rankings]);

  const overviewCards = [
    ['KPI crítico', overview.kpiMaisCritico, '🚨', 'warn'],
    ['Pior utilização', overview.piorUtilizacao, '⏱️', 'bad'],
    ['Pior 1º login', overview.piorPrimeiroLogin, '🔑', 'bad']
  ];

  return (
    <div className="dashboard">
      {dataset?.warnings?.length > 0 && (
        <section className="panel warning-panel">
          <h3>Validação de colunas</h3>
          <div className="warning-list">
            {dataset.warnings.map((warning) => (
              <span key={`${warning.kpi}-${warning.field}`}>
                KPI {warning.kpi}: coluna ausente "{warning.field}". Fallback: {warning.fallback}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="dashboard-section">
        <div className="section-header">
          <h3 className="section-title">Resumo</h3>
        </div>
        <div className="metric-grid-4">
          <article className="overview-card tone-neutral overview-card-combined">
            <span className="overview-icon">📊</span>
            <div>
              <span className="overview-label">Equipes e OS</span>
              <strong className="overview-value">{overview.totalEquipes} equipes</strong>
              <strong className="overview-value overview-value-secondary">{formatNumber(overview.totalOs, 0)} OS</strong>
            </div>
          </article>
          {overviewCards.map(([label, value, icon, tone]) => (
            <article className={`overview-card tone-${tone}`} key={label}>
              <span className="overview-icon">{icon}</span>
              <div>
                <span className="overview-label">{label}</span>
                <strong className="overview-value">{value}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-header">
          <h3 className="section-title">KPIs principais</h3>
          <p className="section-subtitle">Média geral do recorte filtrado, com status em relação à meta operacional.</p>
        </div>
        <div className="metric-grid-4 kpi-grid">
          {sortedPrimaryKpis.map((kpi) => (
            <KpiCard key={kpi} kpi={kpi} value={analytics.rankings[kpi]?.average} />
          ))}
        </div>
      </section>

      {/* Onde agir: leitura executiva antes dos detalhes. */}
      <ReportPanel analytics={analytics} alerts={alerts} />

      {/* Por quê: análise gráfica com prioridade clara. */}
      <Charts analytics={analytics} alerts={alerts} />

      {/* Detalhe: evidências por OS. */}
      <EvidenceTable rows={alerts.evidenceRows} />

      {/* Ferramentas de aprofundamento (drill-down), recolhidas por padrão. */}
      <section className="dashboard-section">
        <div className="section-header">
          <h3 className="section-title">Ferramentas de análise</h3>
          <p className="section-subtitle">Visões detalhadas para investigar equipe por equipe. Abra quando precisar.</p>
        </div>
        <Heatmap
          teams={filteredHeatmapTeams}
          allTeams={allTeams}
          selectedTeams={heatmapTeams}
          onTeamsChange={setHeatmapTeams}
        />
        <TeamSummaryTable teams={analytics.teamSummaries} />
      </section>

      <section className="panel actions actions-single">
        <span className="actions-label">Gerar PDF</span>
        <button className="btn-primary" disabled={pdfBusy} onClick={onGeneratePdf}>
          {pdfBusy ? 'Gerando PDF...' : 'Gerar PDF'}
        </button>
      </section>
    </div>
  );
}

function Charts({ analytics, alerts }) {
  const teams = analytics.teamSummaries;
  const byOsDia = [...teams].sort((a, b) => (b.kpis['OS Dia'] || 0) - (a.kpis['OS Dia'] || 0)).slice(0, 12);
  const byIntervalo = [...teams].sort((a, b) => (b.kpis['Intervalo'] || 0) - (a.kpis['Intervalo'] || 0)).slice(0, 12);
  const paretoAlerts = alerts.alertPareto;
  const [showRankings, setShowRankings] = useState(false);
  const paretoOptions = useMemo(() => ({
    plugins: {
      tooltip: {
        callbacks: {
          title: (items) => {
            const code = paretoAlerts[items[0]?.dataIndex]?.alerta;
            return code ? formatAlertLabel(code) : '';
          },
          label: (item) => `Ocorrências: ${formatNumber(item.parsed.y)}`,
          afterBody: (items) => {
            const code = paretoAlerts[items[0]?.dataIndex]?.alerta;
            return code ? [describeAlert(code)] : [];
          }
        }
      }
    }
  }), [paretoAlerts]);

  return (
    <section className="dashboard-section">
      <div className="section-header">
        <h3 className="section-title">Análise gráfica</h3>
        <p className="section-subtitle">Comece pelo Pareto (o que mais pesa) e pelo OS × Utilização (produtividade). Os rankings por equipe ficam abaixo.</p>
      </div>

      <div className="charts-grid">
        <ChartCard
          className="chart-span-2"
          title="Alertas mais recorrentes (Pareto)"
          hint={getChartHint('Alertas mais recorrentes (Pareto)')}
          labels={paretoAlerts.map((item) => formatAlertLabel(item.alerta))}
          datasets={[bar('Alertas', paretoAlerts.map((item) => item.quantidade), 3)]}
          options={paretoOptions}
        />
        <ChartCard
          className="chart-span-2"
          title="OS x Utilização"
          hint={getChartHint('OS x Utilização')}
          type="scatter"
          labels={teams.map((t) => t.equipe)}
          datasets={[{ label: 'Equipes', backgroundColor: '#2563eb', data: teams.map((t) => ({ x: t.kpis['OS Dia'] || 0, y: t.kpis['Utilização'] || 0, equipe: t.equipe })) }]}
          options={{
            scales: {
              x: { type: 'linear', title: { display: true, text: 'OS Dia' } },
              y: { title: { display: true, text: 'Utilização (%)' } }
            },
            plugins: {
              tooltip: {
                callbacks: {
                  label: (item) => {
                    const point = item.raw || {};
                    return `${point.equipe || 'Equipe'}: OS Dia ${formatNumber(point.x)}, Utilização ${formatNumber(point.y)}%`;
                  }
                }
              }
            }
          }}
        />
      </div>

      <div className="section-subheader collapsible-header">
        <div>
          <h4 className="section-subtitle-strong">Rankings por equipe</h4>
          <p className="section-subtitle">Comparação de cada equipe em OS Dia, Utilização, Retorno Base e Intervalo.</p>
        </div>
        <button type="button" className="collapse-toggle" onClick={() => setShowRankings((current) => !current)}>
          {showRankings ? 'Encurtar' : 'Desencurtar'}
        </button>
      </div>
      {showRankings ? (
        <div className="charts-grid">
          <ChartCard title="Ranking OS Dia" hint={getChartHint('Ranking OS Dia')} labels={byOsDia.map((t) => t.equipe)} datasets={[bar('OS Dia', byOsDia.map((t) => t.kpis['OS Dia']), 0)]} />
          <ChartCard title="Ranking Utilização" hint={getChartHint('Ranking Utilização')} labels={teams.map((t) => t.equipe)} datasets={[bar('Utilização', teams.map((t) => t.kpis['Utilização']), 1)]} />
          <ChartCard title="Ranking Retorno Base" hint={getChartHint('Ranking Retorno Base')} labels={teams.map((t) => t.equipe)} datasets={[bar('Retorno Base', teams.map((t) => t.kpis['Retorno Base']), 2)]} />
          <ChartCard title="Ranking Intervalo" hint={getChartHint('Ranking Intervalo')} labels={byIntervalo.map((t) => t.equipe)} datasets={[bar('Intervalo', byIntervalo.map((t) => t.kpis['Intervalo']), 5)]} />
        </div>
      ) : (
        <p className="collapsed-note">Rankings por equipe recolhidos. Clique em "Desencurtar" para comparar as equipes em cada KPI.</p>
      )}
    </section>
  );
}

function Heatmap({ teams, allTeams, selectedTeams, onTeamsChange }) {
  const kpiCount = HEATMAP_KPIS.length;
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <section className="panel heatmap-panel">
      <div className="section-header collapsible-header">
        <div>
          <h3>Mapa de Calor da Equipe × KPI</h3>
          <p className="section-subtitle heatmap-legend">
            Visão matricial do desempenho de cada equipe nos KPIs.
            <span className="legend-chip ok">Verde</span> dentro da meta ·
            <span className="legend-chip bad">Vermelho</span> fora da meta.
          </p>
        </div>
        <button type="button" className="collapse-toggle" onClick={() => setIsExpanded((current) => !current)}>
          {isExpanded ? 'Encurtar' : 'Desencurtar'}
        </button>
      </div>

      {!isExpanded ? (
        <p className="collapsed-note">Mapa de calor recolhido. Clique em "Desencurtar" para comparar todas as equipes por KPI.</p>
      ) : (
        <>
          <div className="panel-filter heatmap-filter">
            <MultiSelect
              label="Equipes"
              options={allTeams}
              selected={selectedTeams}
              onChange={onTeamsChange}
            />
          </div>
          <div className="heatmap-scroll">
            <div className="heatmap" style={{ gridTemplateColumns: `minmax(160px, 1.4fr) repeat(${kpiCount}, minmax(88px, 1fr))` }}>
              <span className="heatmap-corner">Equipe</span>
              {HEATMAP_KPIS.map(({ kpi, meta, direction }) => (
                <span key={kpi} className="heatmap-header">
                  <strong>{kpi}</strong>
                  <small>Meta {formatNumber(meta)}{direction === 'higher-is-better' ? '+' : ''}</small>
                </span>
              ))}
              {teams.map((team) => (
                <HeatmapRow key={team.equipe} team={team} />
              ))}
            </div>
          </div>
        </>
      )}
    </section>
  );
}

function HeatmapRow({ team }) {
  return (
    <>
      <strong className="heatmap-team">{team.equipe}</strong>
      {HEATMAP_KPIS.map(({ kpi }) => {
        const status = getKpiStatus(team.kpis[kpi], getThreshold(kpi));
        const toneClass = status.tone === 'ok' ? 'ok' : status.tone === 'bad' ? 'bad' : 'neutral';
        return (
          <span key={kpi} className={toneClass} title={status.statusText}>
            {formatNumber(team.kpis[kpi])}
          </span>
        );
      })}
    </>
  );
}

function bar(label, data, colorIndex) {
  return {
    label,
    data,
    borderColor: palette[colorIndex % palette.length],
    backgroundColor: `${palette[colorIndex % palette.length]}aa`,
    tension: 0.3
  };
}
