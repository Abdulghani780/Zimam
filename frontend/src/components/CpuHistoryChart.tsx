import { useState, useEffect, useRef, useMemo } from 'react';
import { Card } from '../asaas-ui';
import { Activity, Cpu } from 'lucide-react';
import { api } from '../lib/api';

interface CpuHistoryChartProps {
  cpuPerCore?: number[];
  cpuTotal?: number;
  cpuModel?: string;
}

// 8 distinct, vibrant, accessible core signals
const CORE_COLORS = [
  '#f87171', // Core 1 - Red / Coral
  '#fb923c', // Core 2 - Orange
  '#fbbf24', // Core 3 - Amber
  '#34d399', // Core 4 - Emerald
  '#38bdf8', // Core 5 - Sky
  '#818cf8', // Core 6 - Indigo
  '#c084fc', // Core 7 - Purple
  '#f472b6', // Core 8 - Rose
];

const MAX_POINTS = 60; // 60 seconds of continuous telemetry

export function CpuHistoryChart({ cpuPerCore, cpuTotal = 0, cpuModel }: CpuHistoryChartProps) {
  const historyRef = useRef<number[][]>([]);
  const [tick, setTick] = useState(0);
  const [hiddenCores, setHiddenCores] = useState<Record<number, boolean>>({});

  // Fetch initial history
  useEffect(() => {
    let isMounted = true;
    api.getCpuHistory()
      .then((res: any) => {
        if (!isMounted) return;
        const coresObj = res?.history?.cores || res?.cores;
        if (coresObj && typeof coresObj === 'object') {
          const keys = Object.keys(coresObj).map(Number).sort((a, b) => a - b);
          if (keys.length > 0) {
            historyRef.current = keys.map((k, idx) => {
              const raw = coresObj[k] || [];
              const padded = [...raw];
              const fallbackBase = (cpuPerCore && cpuPerCore[idx]) ?? raw.at(-1) ?? 0;
              while (padded.length < MAX_POINTS) {
                padded.unshift(Math.max(0, Math.min(100, Number(fallbackBase))));
              }
              return padded.slice(-MAX_POINTS);
            });
            setTick((t) => t + 1);
          }
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  // Update live stream
  useEffect(() => {
    const currentCores = cpuPerCore && cpuPerCore.length > 0 ? cpuPerCore : [];
    const n = currentCores.length;

    if (n === 0) {
      historyRef.current = [];
      setTick((t) => t + 1);
      return;
    }

    if (historyRef.current.length !== n) {
      historyRef.current = Array.from({ length: n }, (_, c) => {
        const base = Math.min(100, Math.max(0, currentCores[c] ?? 0));
        return Array.from({ length: MAX_POINTS }, () => base);
      });
    }

    for (let c = 0; c < n; c++) {
      const val = Math.min(100, Math.max(0, currentCores[c] ?? 0));
      historyRef.current[c].push(val);
      if (historyRef.current[c].length > MAX_POINTS) {
        historyRef.current[c].shift();
      }
    }

    setTick((t) => t + 1);
  }, [cpuPerCore]);

  const activeCores = cpuPerCore && cpuPerCore.length > 0 ? cpuPerCore : [];

  const toggleCore = (idx: number) => {
    setHiddenCores((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  // Dimensions
  const width = 800;
  const height = 190;
  const paddingLeft = 14;
  const paddingRight = 50;
  const paddingTop = 20;
  const paddingBottom = 30;
  const plotW = width - paddingLeft - paddingRight;
  const plotH = height - paddingTop - paddingBottom;

  // Build smooth bezier curves
  const paths = useMemo(() => {
    return historyRef.current.map((points, coreIdx) => {
      if (hiddenCores[coreIdx]) return '';
      if (!points || points.length === 0) return '';
      const totalPoints = points.length;
      const stepX = plotW / (MAX_POINTS - 1);

      const coords = points.map((val, idx) => {
        const x = paddingLeft + (idx + (MAX_POINTS - totalPoints)) * stepX;
        const y = paddingTop + plotH - (val / 100) * plotH;
        return { x, y };
      });

      if (coords.length < 2) return '';

      let d = `M ${coords[0].x.toFixed(1)} ${coords[0].y.toFixed(1)}`;
      for (let i = 0; i < coords.length - 1; i++) {
        const p0 = coords[Math.max(0, i - 1)];
        const p1 = coords[i];
        const p2 = coords[i + 1];
        const p3 = coords[Math.min(coords.length - 1, i + 2)];

        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;

        d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
      }
      return d;
    });
  }, [tick, hiddenCores, plotW, plotH, paddingLeft, paddingTop]);

  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)' }}>
            مصفوفة الأنوية والموجات البيانية
          </span>
          <bdi
            dir="ltr"
            style={{
              fontSize: 12,
              color: 'var(--accent)',
              fontWeight: 700,
              fontFamily: 'monospace',
              background: 'var(--accent-soft)',
              padding: '2px 8px',
              borderRadius: 6,
            }}
          >
            CPU Oscilloscope (60s)
          </bdi>
        </div>
      }
      icon="dashboard"
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            className="badge badge--accent"
            style={{
              fontFamily: 'var(--font)',
              padding: '4px 10px',
              borderRadius: 20,
              fontWeight: 700,
            }}
          >
            {activeCores.length} أنوية نشطة
          </span>
          <span
            className="badge badge--success"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 20,
              fontWeight: 700,
            }}
          >
            <Activity size={12} className="animate-pulse" />
            <span>بث مباشر (1Hz)</span>
          </span>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Description & Overview Metric */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12,
            padding: '10px 14px',
            background: 'var(--glass-tint)',
            border: '1px solid var(--glass-rim-low)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Cpu size={18} style={{ color: 'var(--accent)' }} />
            <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
              رسم تخطيطي لحظي لنبض الأنوية عبر Windows Performance Telemetry
            </span>
            {cpuModel && (
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace' }}>
                ({cpuModel})
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>الحمل العام:</span>
            <span
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: cpuTotal > 80 ? 'var(--status-danger)' : 'var(--accent)',
                fontFamily: 'var(--font)',
              }}
            >
              {cpuTotal.toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Liquid Glass Oscilloscope Canvas */}
        <div
          style={{
            position: 'relative',
            background: 'var(--glass-tint-strong)',
            border: '1px solid var(--glass-rim)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            boxShadow: 'var(--glass-shadow), inset 0 1px 0 var(--glass-rim)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {activeCores.length === 0 && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-3)',
                fontSize: 13,
                gap: 8,
              }}
            >
              <Activity size={16} className="animate-spin" />
              <span>جاري استدعاء قياسات الأنوية من النواة السيادية...</span>
            </div>
          )}

          <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{ width: '100%', height: 'auto', display: 'block' }}
            preserveAspectRatio="none"
          >
            <defs>
              <filter id="coreGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Horizontal Grid lines & Percentage labels */}
            {[0, 25, 50, 75, 100].map((pct) => {
              const y = paddingTop + plotH - (pct / 100) * plotH;
              return (
                <g key={pct}>
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={width - paddingRight}
                    y2={y}
                    stroke="var(--hairline)"
                    strokeDasharray={pct === 0 || pct === 100 ? undefined : '3,3'}
                    strokeWidth={pct === 0 || pct === 100 ? 1 : 0.75}
                  />
                  <text
                    x={width - paddingRight + 8}
                    y={y + 3.5}
                    fill="var(--text-3)"
                    fontSize="10"
                    fontWeight="600"
                    fontFamily="monospace"
                    direction="ltr"
                    textAnchor="start"
                  >
                    {pct}%
                  </text>
                </g>
              );
            })}

            {/* Vertical Time Grid lines & Seconds labels */}
            {[0, 15, 30, 45, 60].map((sec) => {
              const x = paddingLeft + ((60 - sec) / 60) * plotW;
              return (
                <g key={sec}>
                  <line
                    x1={x}
                    y1={paddingTop}
                    x2={x}
                    y2={paddingTop + plotH}
                    stroke="var(--hairline)"
                    strokeDasharray="2,4"
                    strokeWidth="0.75"
                  />
                  <text
                    x={x}
                    y={height - 8}
                    fill="var(--text-3)"
                    fontSize="9"
                    fontWeight="600"
                    fontFamily="monospace"
                    textAnchor="middle"
                    direction="ltr"
                  >
                    {sec === 0 ? '0s' : `-${sec}s`}
                  </text>
                </g>
              );
            })}

            {/* Core Bezier Wave Curves */}
            {paths.map((d, idx) => {
              if (!d) return null;
              const color = CORE_COLORS[idx % CORE_COLORS.length];
              return (
                <path
                  key={idx}
                  d={d}
                  fill="none"
                  stroke={color}
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#coreGlow)"
                  opacity="0.95"
                />
              );
            })}
          </svg>
        </div>

        {/* Core Selector Pill Badges */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
            gap: 10,
          }}
        >
          {activeCores.map((load, index) => {
            const color = CORE_COLORS[index % CORE_COLORS.length];
            const isHidden = !!hiddenCores[index];

            return (
              <button
                key={index}
                type="button"
                onClick={() => toggleCore(index)}
                title={`انقر للتبديل بين إظهار وإخفاء موجة نواة ${index + 1}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: isHidden ? 'transparent' : 'var(--glass-tint)',
                  border: isHidden
                    ? '1px dashed var(--hairline)'
                    : `1px solid ${color}88`,
                  borderRadius: 12,
                  cursor: 'pointer',
                  opacity: isHidden ? 0.4 : 1,
                  transition: 'all 0.2s cubic-bezier(0.22, 1, 0.36, 1)',
                  boxShadow: isHidden
                    ? 'none'
                    : `0 2px 10px -2px ${color}33, inset 0 1px 0 rgba(255,255,255,0.2)`,
                  outline: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: color,
                      boxShadow: isHidden ? 'none' : `0 0 8px ${color}`,
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: isHidden ? 'var(--text-3)' : 'var(--text)',
                    }}
                  >
                    نواة {String(index + 1).padStart(2, '0')}
                  </span>
                </div>

                <span
                  dir="ltr"
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    fontFamily: 'var(--font)',
                    color: isHidden ? 'var(--text-3)' : (load > 85 ? 'var(--status-danger)' : color),
                  }}
                >
                  {load.toFixed(1)}%
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
