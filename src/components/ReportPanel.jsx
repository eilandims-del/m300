import { useMemo, useState } from 'react';
import { HEATMAP_KPIS, getThreshold, isKpiOnTarget } from '../config/kpiThresholds.js';
import { formatAlertLabel, recommendationsForTeam } from '../services/alerts.js';
import { formatNumber } from '../utils/numberDate.js';

export function ReportPanel({ analytics, alerts }) {
  const { rankings, teamSummaries } = analytics;
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
      const hasData = avg != null && !Number.isNaN(avg);
      const onTarget = hasData ? isKpiOnTarget(avg, threshold) : null;
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

  const topAlerts = useMemo(() => alerts.alertPareto.slice(0, 4), [alerts]);
  const offTargetKpis = useMemo(() => kpiInsights.filter((item) => item.onTarget === false), [kpiInsights]);
  const focusTeams = useMemo(
    () => teamsByOpportunity.filter((team) => team.outOfTarget.length > 0).slice(0, 4),
    [teamsByOpportunity]
  );

  return (
    <section className="panel report-panel">
      <div className="section-header collapsible-header">
        <div>
          <h3>Relatório</h3>
          <p className="section-subtitle">Leitura rápida do que está fora da meta e onde agir primeiro.</p>
        </div>
        <button type="button" className="collapse-toggle" onClick={() => setIsExpanded((current) => !current)}>
          {isExpanded ? 'Encurtar' : 'Desencurtar'}
        </button>
      </div>

      {!isExpanded ? (
        <p className="collapsed-note">Relatório encurtado. Clique em "Desencurtar" para visualizar os detalhes.</p>
      ) : (
        <>
      <div className="report-highlights">
        <div className={`report-highlight ${offTargetKpis.length ? 'tone-bad' : 'tone-ok'}`}>
          <span className="report-highlight-label">KPIs fora da meta</span>
          <strong className="report-highlight-value">{offTargetKpis.length}</strong>
          <span className="report-highlight-note">
            {offTargetKpis.length ? offTargetKpis.map((item) => item.kpi).join(', ') : 'Todos dentro da meta'}
          </span>
        </div>
        <div className="report-highlight tone-warn">
          <span className="report-highlight-label">Alerta mais comum</span>
          <strong className="report-highlight-value report-highlight-value-sm">
            {topAlerts.length ? formatAlertLabel(topAlerts[0].alerta) : 'Sem alertas'}
          </strong>
          <span className="report-highlight-note">
            {topAlerts.length ? `${topAlerts[0].quantidade} ocorrência${topAlerts[0].quantidade !== 1 ? 's' : ''}` : 'Nenhuma ocorrência no recorte'}
          </span>
        </div>
        <div className="report-highlight tone-neutral">
          <span className="report-highlight-label">Equipe foco</span>
          <strong className="report-highlight-value report-highlight-value-sm">
            {focusTeams.length ? focusTeams[0].equipe : '—'}
          </strong>
          <span className="report-highlight-note">
            {focusTeams.length ? `${focusTeams[0].outOfTarget.length} KPI${focusTeams[0].outOfTarget.length !== 1 ? 's' : ''} fora da meta` : 'Sem equipe crítica'}
          </span>
        </div>
      </div>

      <div className="report-columns">
        <div className="report-block">
          <h4>KPIs que precisam de atenção</h4>
          {offTargetKpis.length ? (
            <div className="kpi-insight-list">
              {offTargetKpis.map(({ kpi, avg, meta, worst }) => (
                <article key={kpi} className="kpi-insight bad">
                  <header>
                    <span className="kpi-insight-name">{kpi}</span>
                    <span className="kpi-insight-badge bad">Fora</span>
                  </header>
                  <div className="kpi-insight-line">
                    <span>Média <strong>{formatNumber(avg)}</strong></span>
                    <span className="kpi-insight-meta">Meta {formatNumber(meta)}</span>
                  </div>
                  {worst && (
                    <p className="kpi-insight-worst">Puxando para baixo: <strong>{worst.equipe}</strong> ({formatNumber(worst.kpis[kpi])})</p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <p className="report-positive">Todos os KPIs do recorte estão dentro da meta. Manter a rotina de acompanhamento.</p>
          )}
        </div>

        <div className="report-block">
          <h4>Onde agir primeiro</h4>
          {topAlerts.length > 0 && (
            <ul className="alert-priority-list">
              {topAlerts.map((item) => (
                <li key={item.alerta}>
                  <span className="alert-name">{formatAlertLabel(item.alerta)}</span>
                  <span className="alert-count">{item.quantidade}</span>
                </li>
              ))}
            </ul>
          )}

          {focusTeams.length > 0 ? (
            <div className="team-gap-list">
              {focusTeams.map((team) => {
                const recs = recommendationsForTeam(team, alerts.teamAlerts);
                return (
                  <article key={team.equipe} className="team-gap-card">
                    <header>
                      <strong>{team.equipe}</strong>
                      <span className="gap-badge">{team.outOfTarget.length} fora</span>
                    </header>
                    <p className="gap-rec">{recs.length ? recs[0] : 'Manter rotina de acompanhamento e qualidade.'}</p>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="report-positive">Nenhuma equipe com KPI fora da meta no recorte atual.</p>
          )}
        </div>
      </div>
        </>
      )}
    </section>
  );
}
