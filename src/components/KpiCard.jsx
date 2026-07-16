import { formatKpiDisplayValue, getKpiHint } from '../config/kpiDisplay.js';
import { getKpiStatus, getThreshold } from '../config/kpiThresholds.js';

const ICONS = {
  'OS Dia': '📋',
  Produtividade: '📈',
  'Eficiência': '⚙️',
  'Utilização': '⏱️',
  'Task Time': '🎯',
  'TMR Sec': '📞',
  'TMR Imp': '🛠️',
  '1º Login': '🔑',
  '1º Despacho': '📨',
  '1º Desloc.': '🚚',
  'Retorno Base': '🏁',
  Intervalo: '☕'
};

function KpiValueInline({ kpi, value }) {
  const { main, unit } = formatKpiDisplayValue(kpi, value);
  return (
    <>
      {main}
      {unit && <span className="kpi-unit">{unit}</span>}
    </>
  );
}

function KpiValue({ kpi, value }) {
  const { main, unit } = formatKpiDisplayValue(kpi, value);
  return (
    <strong className="kpi-value">
      {main}
      {unit && <span className="kpi-unit">{unit}</span>}
    </strong>
  );
}

export function KpiCard({ kpi, value }) {
  const threshold = getThreshold(kpi);
  const status = getKpiStatus(value, threshold);
  const hint = getKpiHint(kpi);
  const arrow = status.arrow === 'up' ? '▲' : status.arrow === 'down' ? '▼' : '—';

  return (
    <article className={`kpi-card tone-${status.tone}`}>
      <header>
        <span className="kpi-icon">{ICONS[kpi] || '📊'}</span>
        <div className="kpi-heading">
          <span className="kpi-name">{kpi}</span>
          {hint && <span className="kpi-hint">({hint})</span>}
        </div>
      </header>
      <KpiValue kpi={kpi} value={value} />
      <footer className="kpi-footer">
        <div className={`kpi-status status-${status.tone}`}>
          <span className="kpi-arrow">{arrow}</span>
          <span>{status.statusText}</span>
        </div>
        <small className="kpi-meta">
          Meta <KpiValueInline kpi={kpi} value={threshold?.meta} />
        </small>
      </footer>
    </article>
  );
}
