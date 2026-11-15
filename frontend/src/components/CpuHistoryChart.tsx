import { useId } from 'react';

export interface ChartPoint {
  label: string;
  value: number;
}

interface CpuHistoryChartProps {
  points: ChartPoint[];
  value: number;
}

function buildPath(points: ChartPoint[], closeArea: boolean): string {
  if (points.length === 0) return '';
  const step = points.length > 1 ? 99 / (points.length - 1) : 0;
  const coords = points.map((point, index) => {
    const x = points.length > 1 ? 0.5 + index * step : 50;
    const value = Number.isFinite(point.value) ? Math.max(0, Math.min(100, point.value)) : 0;
    const y = 100 - value;
    return [x, y] as const;
  });

  let path = `M ${coords[0][0].toFixed(2)} ${coords[0][1].toFixed(2)}`;
  for (let index = 1; index < coords.length; index += 1) {
    const previous = coords[index - 1];
    const current = coords[index];
    const midX = (previous[0] + current[0]) / 2;
    path += ` C ${midX.toFixed(2)} ${previous[1].toFixed(2)}, ${midX.toFixed(2)} ${current[1].toFixed(2)}, ${current[0].toFixed(2)} ${current[1].toFixed(2)}`;
  }
  if (closeArea) {
    path += ' L 99.5 100 L 0.5 100 Z';
  }
  return path;
}

function axisLabels(points: ChartPoint[]): string[] {
  if (points.length === 0) return [];
  const count = Math.min(6, points.length);
  const labels: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const pointIndex = Math.round((index / Math.max(1, count - 1)) * (points.length - 1));
    labels.push(points[pointIndex]?.label || '');
  }
  return labels;
}

export function CpuHistoryChart({ points, value }: CpuHistoryChartProps) {
  const gradientId = `cpu-line-${useId().replace(/:/g, '')}`;
  const linePath = buildPath(points, false);
  const labels = axisLabels(points);
  const last = points[points.length - 1];
  const lastY = last ? 100 - Math.max(0, Math.min(100, last.value)) : 0;

  return (
    <section className="panel chart-card" aria-label="استهلاك المعالج">
      <header className="panel__head">
        <h2 className="panel__title">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="4" y="4" width="16" height="16" rx="2" />
            <rect x="9" y="9" width="6" height="6" rx="1" />
            <path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3" />
          </svg>
          استهلاك المعالج (CPU)
        </h2>
        <span className="chart-pill" dir="ltr">{value}%</span>
      </header>
      <div className="panel__body">
        {points.length < 2 ? (
          <div className="chart-empty">جارٍ تجميع نقاط القياس الحية…</div>
        ) : (
          <>
            <div className="chart">
              <div className="chart__plot">
                <svg className="chart__svg" viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label={`متوسط استهلاك المعالج ${value}%`}>
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#e8c47b" stopOpacity="0.16" />
                      <stop offset="100%" stopColor="#e8c47b" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={buildPath(points, true)} fill={`url(#${gradientId})`} stroke="none" />
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#e8c47b"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                <span className="chart__dot" style={{ left: '99.5%', top: `${lastY}%` }} />
                <span className="chart__value" style={{ top: `calc(${lastY}% - 16px)` }}>{value}%</span>
              </div>
              <div className="chart__axis-y" aria-hidden="true">
                <span>100%</span><span>80%</span><span>60%</span><span>40%</span><span>20%</span><span>0%</span>
              </div>
            </div>
            <div className="chart__axis-x" aria-hidden="true">
              {labels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
