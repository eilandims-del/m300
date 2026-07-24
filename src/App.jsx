import { useCallback, useEffect, useMemo, useState } from 'react';
import { UploadArea } from './components/UploadArea.jsx';
import { FiltersPanel } from './components/FiltersPanel.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Evolutivo } from './pages/Evolutivo.jsx';
import { readInputFile } from './services/fileReader.js';
import { enrichRows } from './services/teamResolver.js';
import { applyFilters, createEmptyFilters, deriveChainedFilterOptions, sanitizeFilters } from './services/filterService.js';
import { buildAnalytics } from './services/kpiCalculator.js';
import { buildAlerts } from './services/alerts.js';
import { generateExecutivePdf } from './services/pdfService.js';
import { setPlatformKpiColumns } from './services/platformKpis.js';
import { clearAppCaches } from './utils/cacheGuard.js';

export default function App() {
  const [dataset, setDataset] = useState(null);
  const [mainName, setMainName] = useState('');
  const [filters, setFilters] = useState(createEmptyFilters());
  const [view, setView] = useState('dashboard');
  const [status, setStatus] = useState({ loading: false, error: '', message: '', percent: 0 });
  const [pdfBusy, setPdfBusy] = useState(false);

  const resolvedRows = useMemo(
    () => (dataset ? enrichRows(dataset.rows) : []),
    [dataset]
  );
  const optionFilters = useMemo(() => ({
    bases: filters.bases,
    equipes: [],
    tiposEquipe: filters.tiposEquipe,
    periodos: filters.periodos,
    dataInicio: null,
    dataFim: null
  }), [filters.bases, filters.tiposEquipe, filters.periodos]);
  const options = useMemo(() => deriveChainedFilterOptions(resolvedRows, optionFilters), [resolvedRows, optionFilters]);
  const filteredRows = useMemo(() => applyFilters(resolvedRows, filters), [resolvedRows, filters]);
  const result = useMemo(() => {
    if (!filteredRows.length) return null;
    const analytics = buildAnalytics(filteredRows, { columnMap: dataset?.columnMap });
    const alerts = buildAlerts(filteredRows, analytics.teamSummaries);
    return { analytics, alerts };
  }, [dataset?.columnMap, filteredRows]);

  useEffect(() => {
    setFilters((current) => sanitizeFilters(current, options));
  }, [options]);

  const handleMainFile = useCallback(async (file) => {
    setStatus({ loading: true, error: '', message: 'Preparando arquivo...', percent: 0 });
    try {
      const parsed = await readInputFile(file, (progress) => {
        setStatus({
          loading: true,
          error: '',
          message: progress.message || 'Processando arquivo...',
          percent: progress.percent ?? 0
        });
      });
      setDataset(parsed);
      setMainName(file.name);
      setFilters(createEmptyFilters());
      setPlatformKpiColumns(parsed.columnMap);
      setStatus({ loading: false, error: '', message: '', percent: 100 });
    } catch (error) {
      setStatus({ loading: false, error: error.message || 'Erro ao processar o arquivo.', message: '', percent: 0 });
    }
  }, []);

  const handleClearData = useCallback(async () => {
    setDataset(null);
    setMainName('');
    setFilters(createEmptyFilters());
    setView('dashboard');
    setStatus({ loading: false, error: '', message: '', percent: 0 });
    await clearAppCaches();
  }, []);

  const handleGeneratePdf = useCallback(async () => {
    if (!result) return;
    setPdfBusy(true);
    setView('dashboard');
    await new Promise((resolve) => setTimeout(resolve, 120));
    try {
      generateExecutivePdf({ ...result, filters, chartImages: collectChartImages() });
    } catch (error) {
      setStatus((current) => ({ ...current, error: `Falha ao gerar PDF: ${error.message}` }));
    } finally {
      setPdfBusy(false);
    }
  }, [filters, result]);

  return (
    <main>
      <header className="hero">
        <div className="hero-text">
          <h1>Dash M300 - Rounds</h1>
          {result && (
            <nav className="view-nav">
              <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')}>Dashboard</button>
              <button className={view === 'evolutivo' ? 'active' : ''} onClick={() => setView('evolutivo')}>Ver Evolutivo</button>
            </nav>
          )}
        </div>
        <UploadArea
          onMainFile={handleMainFile}
          loading={status.loading}
          mainName={mainName}
          onClear={handleClearData}
        />
      </header>

      {status.error && <div className="error">{status.error}</div>}

      {status.loading && (
        <div className="loading">
          <strong>{status.message || 'Processando planilha, aguarde...'}</strong>
          <span>{status.percent ? `${status.percent}%` : ''}</span>
        </div>
      )}

      {!dataset && !status.loading && (
        <section className="empty-state">
          <h2>Envie um arquivo para começar</h2>
          <p>O app valida colunas, cruza as equipes com o catálogo VTR interno e libera KPIs, rankings, alertas, evolutivo e PDF.</p>
        </section>
      )}

      {dataset && !result && !status.loading && (
        <section className="empty-state">
          <h2>Nenhum dado para os filtros atuais</h2>
          <p>Ajuste ou limpe os filtros para visualizar os indicadores.</p>
        </section>
      )}

      {dataset && (
        <>
          <FiltersPanel filters={filters} setFilters={setFilters} options={options} />
          {result && view === 'dashboard' && (
            <Dashboard dataset={dataset} analytics={result.analytics} alerts={result.alerts} onGeneratePdf={handleGeneratePdf} pdfBusy={pdfBusy} />
          )}
          {result && view === 'evolutivo' && <Evolutivo rows={filteredRows} analytics={result.analytics} alerts={result.alerts} />}
        </>
      )}
    </main>
  );
}

function collectChartImages() {
  return [...document.querySelectorAll('.chart-panel')]
    .map((panel) => ({
      title: panel.querySelector('h3')?.textContent || '',
      dataUrl: panel.querySelector('canvas')?.toDataURL('image/png') || ''
    }))
    .filter((chart) => chart.dataUrl);
}
