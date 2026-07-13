import { useMemo, useState } from 'react';
import { HEATMAP_KPIS, getThreshold, isKpiOnTarget } from '../config/kpiThresholds.js';
import { recommendationsForTeam } from '../services/alerts.js';
import { formatNumber } from '../utils/numberDate.js';

export function ReportPanel({ analytics, alerts }) {
  const { overview, rankings, teamSummaries } = analytics;
  const [isExpanded, setIsExpanded] = useState(false);

  const teamsByOpportunity = useMemo(
    () => [...teamSummaries].sort((a, b) => b.outOfTarget.length - a.outOfTarget.length).slice(0, 8),
    [teamSummaries]
  );

  const kpiInsights = useMemo(
    () => HEATMAP_KPIS.map(({ kpi }) => {
      const ranking = rankings[kpi];
      const threshold = getThreshold(kpi);
      const avg = ranking?.average;
      const onTarget = isKpiOnTarget(avg, threshold);
      return {
        kpi,
        avg,
        onTarget,
        meta: threshold?.meta,
        top: ranking?.top3?.[0],
        worst: ranking?.needsImprovement?.[0]
      };
    }),
    [rankings]
  );

  const alertSummary = useMemo(() => {
    const withAlerts = alerts.evidenceRows.filter((row) => row.alerts.length);
    const topAlerts = alerts.alertPareto.slice(0, 5);
    return { total: withAlerts.length, topAlerts };
  }, [alerts]);

  return (
    <section className="panel report-panel">
      <div className="section-header collapsible-header">
        <div>
          <h3>Relatório</h3>
          <p className="section-subtitle">Resumo dos principais desvios e oportunidades.</p>
        </div>
        <button type="button" className="collapse-toggle" onClick={() => setIsExpanded((current) => !current)}>
          {isExpanded ? 'Encurtar' : 'Desencurtar'}
        </button>
      </div>

      {!isExpanded ? (
        <p className="collapsed-note">Relatório encurtado. Clique em "Desencurtar" para visualizar os detalhes.</p>
      ) : (
        <>
      <div className="report-summary-strip">
        <div className="report-stat">
          <span className="report-stat-label">Equipes monitoradas</span>
          <strong>{overview.totalEquipes}</strong>
        </div>
        <div className="report-stat">
          <span className="report-stat-label">Com KPI fora da meta</span>
          <strong className={overview.equipesAbaixoMeta > 0 ? 'text-bad' : 'text-ok'}>{overview.equipesAbaixoMeta}</strong>
        </div>
        <div className="report-stat">
          <span className="report-stat-label">KPI mais crítico</span>
          <strong>{overview.kpiMaisCritico}</strong>
        </div>
        <div className="report-stat">
          <span className="report-stat-label">OS com alerta</span>
          <strong>{alertSummary.total}</strong>
        </div>
      </div>

      <div className="report-columns">
        <div className="report-block">
          <h4>Diagnóstico por KPI</h4>
          <div className="kpi-insight-list">
            {kpiInsights.map(({ kpi, avg, onTarget, meta, top, worst }) => (
              <article key={kpi} className={`kpi-insight ${onTarget ? 'ok' : 'bad'}`}>
                <header>
                  <span className="kpi-insight-name">{kpi}</span>
                  <span className={`kpi-insight-badge ${onTarget ? 'ok' : 'bad'}`}>
                    {onTarget ? 'Na meta' : 'Fora'}
                  </span>
                </header>
                <div className="kpi-insight-body">
                  <div>
                    <small>Média geral</small>
                    <strong>{formatNumber(avg)}</strong>
                    <span className="kpi-insight-meta">Meta {formatNumber(meta)}</span>
                  </div>
                  <div>
                    <small>Melhor</small>
                    <span>{top ? `${top.equipe} (${formatNumber(top.kpis[kpi])})` : '—'}</span>
                  </div>
                  <div>
                    <small>Precisa melhorar</small>
                    <span>{worst ? `${worst.equipe} (${formatNumber(worst.kpis[kpi])})` : 'Sem desvio'}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>

        <div className="report-block">
          <h4>Alertas prioritários</h4>
          {alertSummary.topAlerts.length ? (
            <ul className="alert-priority-list">
              {alertSummary.topAlerts.map((item) => (
                <li key={item.alerta}>
                  <span className="alert-name">{item.alerta}</span>
                  <span className="alert-count">{item.quantidade}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="report-empty">Nenhum alerta recorrente no recorte atual.</p>
          )}

          <h4 className="report-subheading">Equipes com maior gap</h4>
          <div className="team-gap-list">
            {teamsByOpportunity.map((team) => {
              const recs = recommendationsForTeam(team, alerts.teamAlerts);
              return (
                <article key={team.equipe} className="team-gap-card">
                  <header>
                    <strong>{team.equipe}</strong>
                    <span className="gap-badge">{team.outOfTarget.length} KPI{team.outOfTarget.length !== 1 ? 's' : ''} fora</span>
                  </header>
                  {team.outOfTarget.length > 0 && (
                    <div className="gap-tags">
                      {team.outOfTarget.map((kpi) => (
                        <span key={kpi} className="gap-tag">{kpi}</span>
                      ))}
                    </div>
                  )}
                  <p className="gap-rec">{recs.length ? recs[0] : 'Manter rotina de acompanhamento e qualidade.'}</p>
                </article>
              );
            })}
          </div>
        </div>
      </div>
        </>
      )}
    </section>
  );
}
