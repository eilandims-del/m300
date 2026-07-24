import { useEffect, useRef } from 'react';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  ScatterController,
  Title,
  Tooltip
} from 'chart.js';

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  ScatterController,
  Title,
  Tooltip
);

export function ChartCard({ title, hint, type = 'bar', labels, datasets, options, className = '' }) {
  const legend = hint ?? '';
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return undefined;
    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      type,
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: datasets.length > 1 }, title: { display: false } },
        scales: type === 'scatter' ? { x: { type: 'linear', title: { display: true, text: 'Eficiência' } }, y: { title: { display: true, text: 'Utilização' } } } : undefined,
        ...options
      }
    });
    return () => chartRef.current?.destroy();
  }, [type, labels, datasets, options]);

  return (
    <section className={`panel chart-panel ${className}`.trim()}>
      <div className="chart-heading">
        <h3>{title}</h3>
        {legend && <span className="chart-hint">({legend})</span>}
      </div>
      <div className="chart-wrap">
        <canvas ref={canvasRef} />
      </div>
    </section>
  );
}
