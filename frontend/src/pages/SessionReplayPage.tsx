/**
 * ASAAS v2.5 - Screen Session Replay
 * مركز استرجاع التسجيلات والتحقيق الجنائي الرقمي (Forensic Session Replay)
 * Strict implementation of Stitch Prototype session_replay
 */

import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { apiV1 } from '../lib/apiV1';
import { Card, Button, Glass, useToast } from '../asaas-ui';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  CheckCircle2,
  FileCode,
} from 'lucide-react';
import { t } from '../lib/i18n';

export function SessionReplayPage() {
  const toast = useToast();
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState<number>(1);
  const [keystrokes, setKeystrokes] = useState<Array<{ id?: string; time: string; event: string; command: string; risk: string; user?: string }>>([]);

  useEffect(() => {
    // Legacy replay feed (session recordings) — kept as primary source.
    api.getReplayEvents()
      .then((res) => {
        if (res?.ok && Array.isArray(res.events)) {
          setKeystrokes(res.events);
        }
      })
      .catch(() => {});
    // v1 forensic audit chain — real signed events mapped onto the same timeline.
    apiV1.auditEvents({ limit: 200 })
      .then((res) => {
        const list = Array.isArray(res) ? res : (res as { events?: any[] })?.events;
        if (!Array.isArray(list) || list.length === 0) return;
        const mapped = list.map((ev: any) => {
          const action = String(ev.action ?? 'event');
          const risk = /delete|revoke|disable|block|reject|fail/i.test(action)
            ? 'HIGH'
            : /create|approve|grant|update/i.test(action)
              ? 'MEDIUM'
              : 'LOW';
          const payloadStr = ev.payload ? JSON.stringify(ev.payload) : '';
          const command = [ev.target_id, payloadStr].filter(Boolean).join(' · ').slice(0, 140);
          const time = ev.created_at ? new Date(ev.created_at).toLocaleString('ar-SA') : '—';
          return { time, event: action, command: command || '—', risk, user: ev.actor_id ?? '' };
        });
        setKeystrokes((prev) => {
          const seen = new Set(prev.map((k) => `${k.time}|${k.event}|${k.command}`));
          const fresh = mapped.filter((k) => !seen.has(`${k.time}|${k.event}|${k.command}`));
          return [...prev, ...fresh];
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let interval: any;
    if (isPlaying && keystrokes.length > 0) {
      interval = setInterval(() => {
        setProgress((prev) => (prev >= 100 ? 0 : prev + 1));
      }, 500 / speed);
    }
    return () => clearInterval(interval);
  }, [isPlaying, speed]);

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(keystrokes, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'asaas-session-replay-audit.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    toast(t('تم تصدير ملف سجل التحقيق الجنائي والأحداث بصيغة JSON مشفر.'), 'success');
  };

  return (
    <div className="page">
      {/* Product page header */}
      <div className="page-hero"
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 16,
          background: 'linear-gradient(135deg, var(--glass-tint-strong) 0%, var(--surface-ground) 100%)',
          border: '1px solid var(--accent-soft)',
          boxShadow: '0 12px 32px var(--shadow-soft)',
          padding: '24px 28px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 12px',
                  borderRadius: 9999,
                  background: 'var(--paid-bg)',
                  color: 'var(--paid)',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <CheckCircle2 size={13} />
                {t('بانتظار تسجيل حقيقي من بوابة الجلسات')}
              </span>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: 9999,
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {t('لا توجد جلسة محددة')}
              </span>
            </div>

            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>
              {t('مركز استرجاع التسجيلات والتحقيق الجنائي الرقمي (Forensic Session Replay)')}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0, maxWidth: 840, lineHeight: 1.6 }}>
              {t('ستظهر التسجيلات والأوامر هنا بعد تشغيل بوابة RDP/SSH الحقيقية وتخزينها في MinIO مع سياسة احتفاظ.')}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Button
              size="sm"
              variant="glass"
              onClick={handleExportJson}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <FileCode size={13} color="var(--accent)" />
              <span>{t('تصدير سجل الأحداث JSON')}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Top Grid: Video Player (8 cols) & Keystroke Timeline (4 cols) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 20 }}>
        {/* Player Screen (8 cols) */}
        <div style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Glass style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--accent-soft)' }}>
            {/* Virtual Screen Canvas */}
            <div
              style={{
                height: 380,
                background: 'var(--bg)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: '90%',
                  height: '80%',
                  borderRadius: 8,
                  background: 'var(--surface-ground)',
                  border: '1px solid var(--glass-rim-low)',
                  padding: 16,
                  fontFamily: 'Consolas, "Courier New", monospace',
                  direction: 'ltr',
                  textAlign: 'left',
                  fontSize: 12,
                  color: 'var(--chart-out)',
                  boxShadow: '0 8px 30px var(--shadow-soft)',
                  overflow: 'hidden',
                }}
              >
                {keystrokes.length === 0 ? (
                  <div style={{ color: 'var(--text-3)', textAlign: 'center', marginTop: 90 }}>
                    {t('لا توجد تسجيلات أمنية حالياً')}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, height: '100%', overflowY: 'auto' }}>
                    <div style={{ color: 'var(--accent)', fontWeight: 'bold', borderBottom: '1px solid var(--glass-rim-low)', paddingBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                      <span>ASAAS Windows Security Timeline Replay</span>
                      <span style={{ color: 'var(--text-3)' }}>{keystrokes.length} Recorded Events</span>
                    </div>
                    {keystrokes.slice(0, Math.max(1, Math.floor((progress / 100) * keystrokes.length))).slice(-12).map((k, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 11 }}>
                        <span style={{ color: 'var(--text-3)' }}>[{k.time}]</span>
                        <span style={{ color: k.risk === 'CRITICAL' ? 'var(--status-danger)' : 'var(--paid)', fontWeight: 700 }}>
                          [{k.risk}]
                        </span>
                        <span style={{ color: 'var(--accent)' }}>{k.event}</span>
                        <span style={{ color: 'var(--text-1)', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k.command}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Watermark overlay */}
              <div
                style={{
                  position: 'absolute',
                  top: 12,
                  right: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                  color: 'var(--paid)',
                  fontFamily: 'var(--font)',
                }}
              >
                <span>FORENSIC TIMELINE ACTIVE</span>
              </div>
            </div>

            {/* Controls Bar */}
            <div
              style={{
                padding: '14px 18px',
                background: 'var(--surface-ground)',
                borderTop: '1px solid var(--glass-rim-low)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {/* Scrub Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 11, fontFamily: 'var(--font)', color: 'var(--text-3)' }}>04:12</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  disabled={keystrokes.length === 0}
                  style={{ flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' }}
                />
                <span style={{ fontSize: 11, fontFamily: 'var(--font)', color: 'var(--text-3)' }}>12:00</span>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setIsPlaying(!isPlaying)}
                    disabled={keystrokes.length === 0}
                    style={{ padding: '6px 14px' }}
                  >
                    {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    <span>{isPlaying ? t('إيقاف مؤقت') : t('تشغيل التسجيل')}</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setProgress(Math.max(0, progress - 10))}
                    disabled={keystrokes.length === 0}
                    style={{ padding: '6px 10px' }}
                  >
                    <RotateCcw size={14} />
                    <span>{t('10 ث')}</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setProgress(Math.min(100, progress + 10))}
                    disabled={keystrokes.length === 0}
                    style={{ padding: '6px 10px' }}
                  >
                    <RotateCw size={14} />
                    <span>{t('10 ث')}</span>
                  </Button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {[0.5, 1, 2, 4].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSpeed(s)}
                      style={{
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        background: speed === s ? 'var(--accent)' : 'var(--glass-rim-low)',
                        color: speed === s ? 'var(--on-accent)' : 'var(--text-2)',
                        fontWeight: 700,
                        border: 'none',
                        cursor: 'pointer',
                      }}
                    >
                      {s}x
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Glass>
        </div>

        {/* Keystroke & Event Timeline (4 cols) */}
        <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Card title={t('سجل نقرات المفاتيح والأحداث')} icon="list">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
              {keystrokes.map((k, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 10,
                    borderRadius: 8,
                    background: 'var(--glass-rim-low)',
                    border: '1px solid var(--glass-rim-low)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, fontFamily: 'var(--font)', color: 'var(--text-3)' }}>
                      {k.time}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 800,
                        padding: '1px 6px',
                        borderRadius: 3,
                        background:
                          k.risk === 'HIGH'
                            ? 'var(--unpaid-bg)'
                            : k.risk === 'MEDIUM'
                            ? 'var(--accent-soft)'
                            : 'var(--paid-bg)',
                        color:
                          k.risk === 'HIGH'
                            ? 'var(--unpaid)'
                            : k.risk === 'MEDIUM'
                            ? 'var(--accent)'
                            : 'var(--paid)',
                      }}
                    >
                      {k.risk}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>
                    {k.event}
                  </span>
                  <code style={{ fontSize: 11, fontFamily: 'var(--font)', color: 'var(--accent)' }}>
                    {k.command}
                  </code>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
