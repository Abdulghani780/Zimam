/**
 * ASAAS v2.5 - Screen _1
 * مركز التحكم وحاكم الموارد الذكي (Resource Governor)
 * Strict implementation of Stitch Prototype _1
 */

import { useState, useEffect } from 'react';
import { Card, Button, Glass, useToast } from '../asaas-ui';
import { api, type GovernorStatus, type ServiceItem, type ProcessItem } from '../lib/api';
import {
  Cpu,
  Zap,
  Play,
  Square,
  RotateCw,
  Search,
  Activity,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { t } from '../lib/i18n';

export function GovernorPage() {
  const toast = useToast();
  const [governor, setGovernor] = useState<GovernorStatus | null>(null);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [processes, setProcesses] = useState<ProcessItem[]>([]);
  const [procSearch, setProcSearch] = useState('');
  const [serviceAction, setServiceAction] = useState<string | null>(null);
  const [idleSlider, setIdleSlider] = useState<number>(15);
  const [autoTrimChecked, setAutoTrimChecked] = useState<boolean>(true);
  const [autoDiscChecked, setAutoDiscChecked] = useState<boolean>(true);
  const [dailyLogoffChecked, setDailyLogoffChecked] = useState<boolean>(false);
  const [trimmingTarget, setTrimmingTarget] = useState<string | null>(null);
  const [showAllServices, setShowAllServices] = useState(false);

  const fetchControlData = async (silent = false) => {
    try {
      const [g, s, snap] = await Promise.all([
        api.getGovernorStatus(),
        api.getServices(),
        api.getSnapshot(),
      ]);
      setGovernor(g);
      setAutoTrimChecked(g?.auto_trim ?? true);
      setIdleSlider(g?.idle_threshold_mins ?? 15);
      setAutoDiscChecked(g?.auto_disconnect_enabled ?? true);
      setDailyLogoffChecked(g?.auto_logoff_enabled ?? false);
      setServices(Array.isArray(s) ? s : (s as any)?.services || []);
      setProcesses(snap?.processes || []);
    } catch (err: any) {
      if (!silent) toast(err.message || t('فشل جلب بيانات الحاكم'), 'error');
    }
  };

  useEffect(() => {
    fetchControlData();
    // Keep processes/services and governor counters live from the real
    // `/api/snapshot` inventory instead of freezing the first page load.
    const timer = setInterval(() => fetchControlData(true), 10_000);
    return () => clearInterval(timer);
  }, []);

  const handleToggleAutoTrim = async (val: boolean) => {
    setAutoTrimChecked(val);
    try {
      const updated = await api.updateGovernor({ auto_trim: val });
      setGovernor((prev) => (prev ? { ...prev, ...updated } : (updated as any)));
      toast(val ? t('تم تفعيل التفريغ التلقائي للذاكرة الخاملة.') : t('تم تحويل الحاكم إلى الوضع اليدوي.'), 'success');
    } catch (err: any) {
      toast(err.message || t('خطأ في حفظ السياسة'), 'error');
      setAutoTrimChecked(!val);
    }
  };

  const handleToggleAutoDisconnect = async (val: boolean) => {
    setAutoDiscChecked(val);
    try {
      const updated = await api.updateGovernor({ auto_disconnect_enabled: val });
      setGovernor((prev) => (prev ? { ...prev, ...updated } : (updated as any)));
      toast(val ? t('تم تفعيل الفصل التلقائي للجلسات المنسية.') : t('تم تعطيل الفصل التلقائي للجلسات.'), 'success');
    } catch (err: any) {
      toast(err.message || t('خطأ في حفظ سياسة فصل الجلسات'), 'error');
      setAutoDiscChecked(!val);
    }
  };

  const handleToggleDailyLogoff = async (val: boolean) => {
    setDailyLogoffChecked(val);
    try {
      const updated = await api.updateGovernor({ auto_logoff_enabled: val });
      setGovernor((prev) => (prev ? { ...prev, ...updated } : (updated as any)));
      toast(val ? t('تم تفعيل تسجيل الخروج الإجباري بنهاية العمل.') : t('تم تعطيل تسجيل الخروج الإجباري.'), 'success');
    } catch (err: any) {
      toast(err.message || t('خطأ في حفظ سياسة تسجيل الخروج'), 'error');
      setDailyLogoffChecked(!val);
    }
  };

  const handleIdleSliderChange = async (val: number) => {
    setIdleSlider(val);
    try {
      await api.updateGovernor({ idle_threshold_mins: val });
      setGovernor((prev) => (prev ? { ...prev, idle_threshold_mins: val } : prev));
    } catch {
      // ignore
    }
  };

  const handleSpecificTrim = async (targetLabel: string, pid?: number) => {
    setTrimmingTarget(targetLabel);
    try {
      const res = await api.trimGovernor(undefined, targetLabel, pid);
      if (res && res.ok) {
        const rec = res.reclaimed_mb ?? (res as any)?.result?.reclaimed_mb ?? 0;
        if (rec > 0) {
          toast(`${t('تم تفريغ مساحة العمل لـ [')}${targetLabel}${t('] بنجاح â€” تم استرداد ')}${rec} MB.`, 'success');
        } else {
          toast(res.message || `${t('ذاكرة [')}${targetLabel}${t('] محسنة مسبقاً ولا توجد صفحات خاملة لتحريرها.')}`, 'success');
        }
        fetchControlData();
      } else {
        toast((res as any)?.error || t('فشل تفريغ الذاكرة للهدف المحدد.'), 'error');
      }
    } catch (err: any) {
      toast(err.message || t('تعذر استدعاء تفريغ الذاكرة'), 'error');
    } finally {
      setTrimmingTarget(null);
    }
  };

  const handleServiceControl = async (name: string, action: 'start' | 'stop' | 'restart') => {
    setServiceAction(`${name}-${action}`);
    try {
      const res = await api.controlService(name, action);
      if (res.ok) {
        toast(`${t('تم تنفيذ أمر (')}${action}${t(') للخدمة [')}${name}${t('] بنجاح.')}`, 'success');
        const fresh = await api.getServices();
        setServices(fresh);
      } else {
        toast(res.error || t('فشل تنفيذ الأمر'), 'error');
      }
    } catch (err: any) {
      toast(err.message || t('خطأ في معالجة الخدمة'), 'error');
    } finally {
      setServiceAction(null);
    }
  };

  const handleTerminateProcess = async (pid: number, name: string) => {
    if (!window.confirm(`${t('هل أنت متأكد من رغبتك في إنهاء العملية ')}${name} (PID: ${pid}${t(')؟')}`)) return;
    try {
      const res = await api.terminateProcess(pid);
      if (res.ok) {
        toast(`${t('تم إنهاء العملية [')}${name}${t('] بنجاح.')}`, 'success');
        setProcesses((prev) => prev.filter((p) => p.pid !== pid));
      } else {
        toast(res.error || t('تعذر إنهاء العملية'), 'error');
      }
    } catch (err: any) {
      toast(err.message || t('خطأ'), 'error');
    }
  };

  const filteredProcesses = processes.filter(
    (p) =>
      p.name.toLowerCase().includes(procSearch.toLowerCase()) ||
      p.user.toLowerCase().includes(procSearch.toLowerCase()) ||
      String(p.pid).includes(procSearch)
  );

  const topConsumers = [...processes]
    .sort((a, b) => (b.ram_mb ?? b.ram ?? 0) - (a.ram_mb ?? a.ram ?? 0))
    .slice(0, 4);

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
        <div
          style={{
            position: 'absolute',
            top: -60,
            left: -40,
            width: 280,
            height: 280,
            borderRadius: '50%',
            background: 'radial-gradient(circle, var(--accent-soft) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -60,
            right: '20%',
            width: 240,
            height: 240,
            borderRadius: '50%',
            background: 'radial-gradient(circle, var(--accent-soft) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
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
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: 'var(--paid)',
                  boxShadow: '0 0 8px var(--paid)',
                }}
              />
              {t('نظام الحاكم الذكي في وضع الحماية التلقائية Active Autonomous Governor')}
            </span>
            <span
              style={{
                padding: '3px 10px',
                borderRadius: 9999,
                background: 'var(--glass-rim-low)',
                color: 'var(--text-3)',
                fontFamily: 'var(--font)',
                fontSize: 11,
              }}
            >
              POL-KERNEL-TRIM-V3
            </span>
          </div>

          <h1
            style={{
              fontSize: 24,
              fontWeight: 800,
              color: 'var(--text-1)',
              letterSpacing: -0.3,
              margin: 0,
            }}
          >
            {t('مركز التحكم وحاكم الموارد الذكي (Resource Governor)')}
          </h1>

          <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0, maxWidth: 900, lineHeight: 1.6 }}>
            {t('إدارة حيوية لمساحة العمل المادية (Working Set Trim)، جدولة الأولويات، وتفريغ خمول الجلسات والتطبيقات الثقيلة للحفاظ على استقرار أداء ويندوز سيرفر بدون التأثير على سلاسة جلسات المستخدمين.')}
          </p>
        </div>
      </div>

      {/* 2. Top Grid: Policies on Right (5 cols) & Memory Watchlist on Left (7 cols) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 20 }}>
        {/* Column 1: Governor Policies (5 cols) */}
        <div style={{ gridColumn: 'span 5', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Glass style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
                  {t('سياسات الحاكم التلقائي')}
                </h2>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Working Set Governor Policies</span>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--paid)',
                  background: 'var(--paid-bg)',
                  padding: '2px 8px',
                  borderRadius: 4,
                  letterSpacing: 0.5,
                }}
              >
                ENFORCED
              </span>
            </div>

            {/* Switch 1: Auto Trim */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 10,
                background: 'var(--glass-rim-low)',
                border: '1px solid var(--glass-rim-low)',
              }}
            >
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', display: 'block' }}>
                  {t('تفعيل التفريغ التلقائي للذاكرة')}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {t('Auto Trim Working Set للأعباء غير النشطة')}
                </span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={autoTrimChecked}
                  onChange={(e) => handleToggleAutoTrim(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {/* Slider: Idle Threshold */}
            <div
              style={{
                padding: '14px',
                borderRadius: 10,
                background: 'var(--glass-rim-low)',
                border: '1px solid var(--glass-rim-low)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', display: 'block' }}>
                    {t('حد الخمول للتفريغ التلقائي')}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    Idle Tolerance Before Set Paging
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    background: 'var(--shadow-soft)',
                    padding: '2px 8px',
                    borderRadius: 6,
                    color: 'var(--accent)',
                    fontWeight: 800,
                    fontSize: 13,
                  }}
                >
                  <span>{idleSlider}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-3)' }}>{t('دقيقة')}</span>
                </div>
              </div>

              <input
                type="range"
                min="5"
                max="60"
                step="5"
                value={idleSlider}
                aria-label={t('عتبة خمول الجلسات المستهدفة:')}
                onChange={(e) => handleIdleSliderChange(Number(e.target.value))}
                style={{
                  width: '100%',
                  accentColor: 'var(--accent)',
                  cursor: 'pointer',
                }}
              />

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 10,
                  color: 'var(--text-3)',
                }}
              >
                <span>{t('5 د (عدواني)')}</span>
                <span>{t('30 دقيقة')}</span>
                <span>{t('60 د (متساهل)')}</span>
              </div>
            </div>

            {/* Switch 2: Auto Disconnect */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 10,
                background: 'var(--glass-rim-low)',
                border: '1px solid var(--glass-rim-low)',
              }}
            >
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', display: 'block' }}>
                  {t('فصل الجلسات المنسية تلقائياً')}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  Auto Disconnect after Inactivity
                </span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={autoDiscChecked}
                  onChange={(e) => handleToggleAutoDisconnect(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {/* Switch 3: Mandatory Daily Logoff */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 14px',
                borderRadius: 10,
                background: 'var(--glass-rim-low)',
                border: '1px solid var(--glass-rim-low)',
              }}
            >
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', display: 'block' }}>
                  {t('تسجيل الخروج الإجباري بنهاية العمل')}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  Purge session handles at 18:00 AST
                </span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={dailyLogoffChecked}
                  onChange={(e) => handleToggleDailyLogoff(e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            {/* Efficiency Circular Gauge */}
            <div
              style={{
                marginTop: 6,
                padding: '14px 16px',
                borderRadius: 12,
                background: 'var(--shadow-soft)',
                border: '1px solid var(--accent-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('كفاءة تشغيل الذاكرة الحية')}</span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)' }}>—</span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700 }}>{t('لا تتوفر بيانات')}</span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-3)', margin: 0, lineHeight: 1.4 }}>
                  {t('لا يُحتسب مؤشر كفاءة الذاكرة بعد — سيظهر عند توفر قياسات حقيقية من الوكلاء.')}
                </p>
              </div>

              {/* Gauge SVG — no real metric, render empty ring */}
              <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
                <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="var(--glass-rim-low)"
                    strokeWidth="3.5"
                  />
                </svg>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Activity size={14} color="var(--text-3)" />
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-3)', fontFamily: 'var(--font)' }}>
                    —
                  </span>
                </div>
              </div>
            </div>
          </Glass>
        </div>

        {/* Column 2: Heavy Consumer Watchlist & Quick Trim (7 cols) */}
        <div style={{ gridColumn: 'span 7', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Glass style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'var(--partial-bg)',
                    border: '1px solid color-mix(in srgb, var(--partial) 34%, transparent)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--partial)',
                  }}
                >
                  <Cpu size={20} />
                </div>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
                    {t('مصفوفة المستهلكين الأثقل (Heavy Consumer Watchlist)')}
                  </h2>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    {t('التطبيقات الأكثر استنزافاً لمساحة العمل المادية مع خيار التفريغ الفوري')}
                  </span>
                </div>
              </div>
              <Button
                size="sm"
                variant="glass"
                loading={trimmingTarget === 'GLOBAL'}
                onClick={() => handleSpecificTrim(t('تفريغ شامل لجميع العمليات'))}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Zap size={13} color="var(--accent)" />
                <span>{t('تفريغ شامل فوري')}</span>
              </Button>
            </div>

            {/* Top memory consumers — live process telemetry */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              {topConsumers.length === 0 ? (
                <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--text-3)', padding: '8px 4px' }}>
                  {t('لا تتوفر بيانات عمليات بعد — ستظهر هنا أعلى العمليات استهلاكاً للذاكرة فور وصولها.')}
                </div>
              ) : (
                topConsumers.map((p) => {
                  const ramLabel = p.ram_mb ? `${Number(p.ram_mb).toLocaleString()} MB` : `${p.ram} GB`;
                  return (
                    <div
                      key={p.pid}
                      style={{
                        padding: '14px',
                        borderRadius: 10,
                        background: 'var(--glass-rim-low)',
                        border: '1px solid var(--accent-soft)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.name}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            fontFamily: 'var(--font)',
                            color: 'var(--accent)',
                            background: 'var(--accent-soft)',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontWeight: 700,
                            flexShrink: 0,
                          }}
                        >
                          <span dir="ltr">{ramLabel}</span>
                        </span>
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        PID {p.pid} · {p.user || '—'} · {t('جلسة')} #{p.session}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4, gap: 6 }}>
                        <span style={{ fontSize: 10, color: 'var(--paid)' }}>● {t('قيد التشغيل')}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={trimmingTarget === p.name}
                          onClick={() => handleSpecificTrim(p.name, p.pid)}
                          style={{ padding: '3px 8px', fontSize: 11 }}
                        >
                          {t('تفريغ فوري')}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Total Reclaimed Summary */}
            <div
              style={{
                marginTop: 'auto',
                padding: '12px 16px',
                borderRadius: 10,
                background: 'var(--accent-soft)',
                border: '1px solid var(--accent-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={16} color="var(--accent)" />
                <span style={{ fontSize: 12, color: 'var(--text-1)' }}>
                  {t('إجمالي الذاكرة المستعادة والمتاحة للنظام حالياً:')}
                </span>
              </div>
              <span
                style={{
                  fontSize: 18,
                  fontWeight: 900,
                  color: 'var(--accent)',
                  fontFamily: 'var(--font)',
                }}
              >
                <span dir="ltr">{governor?.reclaimed_mb != null ? `${Number(governor.reclaimed_mb).toLocaleString(undefined, { maximumFractionDigits: 1 })} MB` : '—'}</span>
              </span>
            </div>
          </Glass>
        </div>
      </div>

      {/* 3. Windows Core Services Management Table Section (Stitch _1 L283) */}
      <Card
        title={t('جدول خدمات ويندوز الحيوية (Windows Core Services Management)')}
        icon="dashboard"
        actions={
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {t('إجمالي الخدمات الأساسية')}: {services.length} {t('خدمة')}
          </span>
        }
      >
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t('اسم الخدمة (Service Name)')}</th>
                <th>{t('الوصف والوظيفة بالنظام')}</th>
                <th>{t('الحالة الحالية')}</th>
                <th>{t('نوع بدء التشغيل')}</th>
                <th>{t('التصنيف')}</th>
                <th style={{ textAlign: 'end' }}>{t('التحكم بالخدمة')}</th>
              </tr>
            </thead>
            <tbody>
              {(showAllServices ? services : services.slice(0, 50)).map((svc) => (
                <tr key={svc.name}>
                  <td style={{ fontWeight: 700, fontFamily: 'var(--font)', color: 'var(--text-1)' }}>
                    {svc.name}
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: 'var(--text-1)', display: 'block' }}>
                      {svc.display}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '3px 8px',
                        borderRadius: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        background:
                          svc.status === 'Running' ? 'var(--paid-bg)' : 'var(--unpaid-bg)',
                        color: svc.status === 'Running' ? 'var(--paid)' : 'var(--unpaid)',
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: svc.status === 'Running' ? 'var(--paid)' : 'var(--unpaid)',
                        }}
                      />
                      {svc.status === 'Running' ? t('تعمل (Running)') : t('متوقفة (Stopped)')}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: 11,
                        background: 'var(--glass-rim-low)',
                        padding: '2px 8px',
                        borderRadius: 4,
                        color: 'var(--text-2)',
                      }}
                    >
                      {svc.startup}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        fontSize: 11,
                        color: 'var(--accent)',
                        background: 'var(--accent-soft)',
                        padding: '2px 8px',
                        borderRadius: 4,
                      }}
                    >
                      {svc.category}
                    </span>
                  </td>
                  <td style={{ textAlign: 'end' }}>
                    <div className="cluster" style={{ justifyContent: 'flex-end', gap: 6 }}>
                      {svc.status !== 'Running' ? (
                        <Button
                          size="sm"
                          variant="glass"
                          loading={serviceAction === `${svc.name}-start`}
                          onClick={() => handleServiceControl(svc.name, 'start')}
                          style={{ padding: '4px 10px', fontSize: 11 }}
                        >
                          <Play size={12} color="var(--paid)" />
                          <span>{t('تشغيل')}</span>
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={serviceAction === `${svc.name}-stop`}
                          onClick={() => handleServiceControl(svc.name, 'stop')}
                          style={{ padding: '4px 10px', fontSize: 11, color: 'var(--unpaid)' }}
                        >
                          <Square size={12} />
                          <span>{t('إيقاف')}</span>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        loading={serviceAction === `${svc.name}-restart`}
                        onClick={() => handleServiceControl(svc.name, 'restart')}
                        style={{ padding: '4px 10px', fontSize: 11 }}
                      >
                        <RotateCw size={12} />
                        <span>{t('إعادة تشغيل')}</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {services.length > 50 && (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
            <Button variant="ghost" onClick={() => setShowAllServices((v) => !v)}>
              {showAllServices ? t('عرض أول 50 خدمة فقط') : `${t('عرض كل الخدمات (')}${services.length})`}
            </Button>
          </div>
        )}
      </Card>

      {/* 4. Process Telemetry & Explorer (Stitch _1 L156) */}
      <Card
        title={t('قائمة مراقبة استهلاك العمليات والخدمات (Top Processes Telemetry)')}
        icon="list"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
            <Search size={15} color="var(--text-3)" style={{ position: 'absolute', insetInlineEnd: 10 }} />
            <input
              type="text"
              placeholder={t('ابحث باسم العملية، PID، أو المستخدم...')}
              value={procSearch}
              onChange={(e) => setProcSearch(e.target.value)}
              className="text-input"
              style={{ width: 280, paddingInlineEnd: 32 }}
            />
          </div>
        }
      >
        <div className="table-wrap" style={{ maxHeight: 460 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>PID</th>
                <th>{t('اسم العملية')}</th>
                <th>{t('المالك / المستخدم')}</th>
                <th>{t('الجلسة')}</th>
                <th>{t('مساحة العمل (RAM MB)')}</th>
                <th style={{ textAlign: 'end' }}>{t('إجراءات الحاكم')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredProcesses.slice(0, 50).map((p) => (
                <tr key={p.pid}>
                  <td style={{ fontFamily: 'var(--font)', color: 'var(--text-3)' }}>{p.pid}</td>
                  <td style={{ fontWeight: 700, color: 'var(--text-1)' }}>{p.name}</td>
                  <td>{p.user}</td>
                  <td>#{p.session}</td>
                  <td style={{ fontFamily: 'var(--font)', fontWeight: 800, color: 'var(--accent)' }}>
                    {p.ram_mb ? `${p.ram_mb} MB` : `${p.ram} GB`}
                  </td>
                  <td style={{ textAlign: 'end' }}>
                    <div className="cluster" style={{ justifyContent: 'flex-end', gap: 6 }}>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleSpecificTrim(p.name, p.pid)}
                        style={{ padding: '4px 8px', fontSize: 11 }}
                        title={t('تفريغ Working Set')}
                      >
                        <span>{t('تفريغ Trim')}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleTerminateProcess(p.pid, p.name)}
                        style={{ padding: '4px 8px', fontSize: 11, color: 'var(--unpaid)' }}
                        title={t('إنهاء العملية')}
                      >
                        <Trash2 size={12} />
                        <span>{t('إنهاء')}</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

