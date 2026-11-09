import { useState, useEffect, useMemo } from 'react';
import { Card, Button } from '../asaas-ui';
import { api, type HistoricalPoint } from '../lib/api';

export function HistoricalMetricsChart() {
  const [range, setRange] = useState<'24h' | '7d'>('24h');
  const [points, setPoints] = useState<HistoricalPoint[]>([]);

  const fetchHistory = async (r: '24h' | '7d') => {
    try {
      const res = await api.getHistoricalMetrics(r);
      if (res.ok && Array.isArray(res.history)) {
        setPoints(res.history);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchHistory(range);
    const interval = setInterval(() => fetchHistory(range), 30000);
    return () => clearInterval(interval);
  }, [range]);

  // Chart dimensions
  const width = 800;
  const height = 160;
  const paddingL = 30;
  const paddingR = 15;
  const paddingT = 15;
  const paddingB = 25;
  const plotW = width - paddingL - paddingR;
  const plotH = height - paddingT - paddingB;

  const { cpuPath, ramPath, cpuArea, ramArea } = useMemo(() => {
    if (points.length < 2) return { cpuPath: '', ramPath: '', cpuArea: '', ramArea: '' };

    const n = points.length;
    const stepX = plotW / (n - 1);

    const cpuCoords = points.map((p, i) => ({
      x: paddingL + i * stepX,
      y: paddingT + plotH - (Math.min(100, Math.max(0, p.cpu)) / 100) * plotH,
    }));

    const ramCoords = points.map((p, i) => ({
      x: paddingL + i * stepX,
      y: paddingT + plotH - (Math.min(100, Math.max(0, p.ram)) / 100) * plotH,
    }));

    let cPath = `M ${cpuCoords[0].x.toFixed(1)} ${cpuCoords[0].y.toFixed(1)}`;
    for (let i = 1; i < cpuCoords.length; i++) {
      cPath += ` L ${cpuCoords[i].x.toFixed(1)} ${cpuCoords[i].y.toFixed(1)}`;
    }

    let rPath = `M ${ramCoords[0].x.toFixed(1)} ${ramCoords[0].y.toFixed(1)}`;
    for (let i = 1; i < ramCoords.length; i++) {
      rPath += ` L ${ramCoords[i].x.toFixed(1)} ${ramCoords[i].y.toFixed(1)}`;
    }

    const cArea = `${cPath} L ${cpuCoords[cpuCoords.length - 1].x.toFixed(1)} ${paddingT + plotH} L ${cpuCoords[0].x.toFixed(1)} ${paddingT + plotH} Z`;
    const rArea = `${rPath} L ${ramCoords[ramCoords.length - 1].x.toFixed(1)} ${paddingT + plotH} L ${ramCoords[0].x.toFixed(1)} ${paddingT + plotH} Z`;

    return { cpuPath: cPath, ramPath: rPath, cpuArea: cArea, ramArea: rArea };
  }, [points, plotW, plotH, paddingL, paddingT]);

  const avgCpu = points.length ? Math.round(points.reduce((acc, p) => acc + p.cpu, 0) / points.length) : 0;
  const avgRam = points.length ? Math.round(points.reduce((acc, p) => acc + p.ram, 0) / points.length) : 0;

  return (
    <Card
      title="سجل الأداء التراكمي في قاعدة البيانات (Historical Telemetry Persistence - SQLite)"
      icon="vault"
      actions={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginInlineEnd: 10, fontSize: 12 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#facc15' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#facc15', display: 'inline-block' }} />
              متوسط المعالج: <strong dir="ltr">{avgCpu}%</strong>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#38bdf8' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#38bdf8', display: 'inline-block' }} />
              متوسط الرام: <strong dir="ltr">{avgRam}%</strong>
            </span>
          </div>

          <Button
            size="sm"
            variant={range === '24h' ? 'primary' : 'ghost'}
            onClick={() => setRange('24h')}
            style={{ padding: '4px 10px', fontSize: 11 }}
          >
            آخر 24 ساعة
          </Button>
          <Button
            size="sm"
            variant={range === '7d' ? 'primary' : 'ghost'}
            onClick={() => setRange('7d')}
            style={{ padding: '4px 10px', fontSize: 11 }}
          >
            آخر 7 أيام
          </Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div
          style={{
            position: 'relative',
            width: '100%',
            background: 'rgba(0, 0, 0, 0.45)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid rgba(212, 160, 23, 0.18)',
            padding: '10px 14px',
            overflow: 'hidden',
          }}
        >
          {points.length < 2 ? (
            <div style={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 13 }}>
              جارٍ جمع وحفظ قراءات الأداء في SQLite... (يتم التحديث كل 30 ثانية)
            </div>
          ) : (
            <svg
              viewBox={`0 0 ${width} ${height}`}
              style={{ width: '100%', height: 'auto', display: 'block' }}
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#facc15" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#facc15" stopOpacity="0.0" />
                </linearGradient>
                <linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 25, 50, 75, 100].map((pct) => {
                const y = paddingT + plotH - (pct / 100) * plotH;
                return (
                  <g key={pct}>
                    <line
                      x1={paddingL}
                      y1={y}
                      x2={width - paddingR}
                      y2={y}
                      stroke="rgba(255, 255, 255, 0.07)"
                      strokeDasharray={pct === 0 || pct === 100 ? undefined : '3,3'}
                    />
                    <text
                      x={paddingL - 6}
                      y={y + 3}
                      fill="rgba(255, 255, 255, 0.4)"
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="end"
                      direction="ltr"
                    >
                      {pct}%
                    </text>
                  </g>
                );
              })}

              {/* Area Fills */}
              <path d={ramArea} fill="url(#ramGrad)" />
              <path d={cpuArea} fill="url(#cpuGrad)" />

              {/* Strokes */}
              <path d={ramPath} fill="none" stroke="#38bdf8" strokeWidth="1.8" />
              <path d={cpuPath} fill="none" stroke="#facc15" strokeWidth="2" />
            </svg>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)' }}>
          <span>سياسة الاحتفاظ: تنظيف تلقائي للبيانات الأقدم من 7 أيام دورياً.</span>
          <span>إجمالي النقاط المسجلة: <strong style={{ color: 'var(--accent)' }}>{points.length}</strong> نقطة قياس</span>
        </div>
      </div>
    </Card>
  );
}
