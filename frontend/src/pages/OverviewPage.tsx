import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  Cpu,
  HardDrive,
  LogIn,
  LogOut,
  MemoryStick,
  Network,
  RefreshCw,
  Server,
  Settings2,
  ShieldCheck,
  Users,
  Zap,
} from 'lucide-react';
import { useTelemetry } from '../lib/useTelemetry';
import {
  api,
  type AuditLog,
  type HistoricalPoint,
  type ManagedServer,
  type SecurityEvent,
  type SecurityStats,
  type SystemHistory,
} from '../lib/api';
import { CpuHistoryChart, type ChartPoint } from '../components/CpuHistoryChart';
import { HistoricalMetricsChart } from '../components/HistoricalMetricsChart';
import { apiV1 } from '../lib/apiV1';
import { t } from '../lib/i18n';

interface FleetAgent {
  id: string;
  name: string;
  status: string;
  last_seen_at: string | null;
  hostname?: string | null;
  os?: string | null;
  process_count?: number | null;
  linked_asset: { id: string; name: string; hostname: string } | null;
  collector_count: number;
  collectors: string[];
  last_collection_at: string | null;
}

interface FleetSummary {
  agents: FleetAgent[];
  totals: { agents: number; online: number; with_results: number };
}

interface FirewallStatus {
  ok: boolean;
  profiles?: Record<string, boolean>;
}

interface BackupRecord {
  filename: string;
  modified_at: string;
  size_mb: number;
}

const RANGE_KEY = 'asaas-overview-range';

function formatTimeLabel(value: string, range: '24h' | '7d'): string {
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value.slice(11, 16) || value;
  if (range === '7d') {
    return `${date.getDate()}/${date.getMonth() + 1}`;
  }
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatSpeed(kb: number): string {
  const safe = Number.isFinite(kb) ? Math.max(0, kb) : 0;
  if (safe >= 1024) return `${(safe / 1024).toFixed(1)} MB/s`;
  return `${safe.toFixed(1)} KB/s`;
}

function formatMbps(kb: number): string {
  const safe = Number.isFinite(kb) ? Math.max(0, kb) : 0;
  const mbps = (safe * 8) / 1024;
  if (mbps >= 100) return mbps.toFixed(0);
  if (mbps >= 10) return mbps.toFixed(1);
  return mbps.toFixed(2);
}

function formatGb(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '0';
  return value.toFixed(digits);
}

function relativeFrom(value: string): string {
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value;
  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 60) return `${t('منذ ')}${diffMinutes || 1}${t(' دقيقة')}`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `${t('منذ ')}${hours}${t(' ساعة')}`;
  const days = Math.floor(hours / 24);
  return `${t('منذ ')}${days}${t(' يوم')}`;
}

function clockOf(value: string): string {
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value.slice(11, 16);
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

const ACTION_META: Record<string, { title: string; icon: typeof Zap }> = {
  LOGIN_SUCCESS: { title: t('تسجيل دخول ناجح'), icon: LogIn },
  SESSION_LOGOFF: { title: t('إنهاء جلسة مستخدم'), icon: LogOut },
  RAM_TRIMMED: { title: t('تفريغ الذاكرة الخاملة'), icon: Zap },
  SERVICE_CONTROL: { title: t('تعديل حالة خدمة'), icon: Settings2 },
  USER_CREATED: { title: t('إنشاء مستخدم جديد'), icon: Users },
};

export function OverviewPage() {
  const { snapshot, health, refresh } = useTelemetry();
  const navigate = useNavigate();

  const [range, setRange] = useState<'24h' | '7d'>(() => {
    try {
      const saved = localStorage.getItem(RANGE_KEY);
      return saved === '7d' ? '7d' : '24h';
    } catch {
      return '24h';
    }
  });
  const [history, setHistory] = useState<HistoricalPoint[]>([]);
  const [systemHistory, setSystemHistory] = useState<SystemHistory | null>(null);
  const [servers, setServers] = useState<ManagedServer[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [securityStats, setSecurityStats] = useState<SecurityStats | null>(null);
  const [firewall, setFirewall] = useState<FirewallStatus | null>(null);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [fleet, setFleet] = useState<FleetSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const host = snapshot?.host;
  const sessions = snapshot?.sessions ?? [];
  const services = snapshot?.services ?? [];

  const loadHistory = useCallback(async (selectedRange: '24h' | '7d') => {
    try {
      const res = await api.getHistoricalMetrics(selectedRange);
      setHistory(Array.isArray(res.history) ? res.history : []);
    } catch {
      setHistory([]);
    }
  }, []);

  const loadLiveExtras = useCallback(async () => {
    const [serverRes, auditRes, securityRes, securityStatRes, firewallRes, backupRes, fleetRes] = await Promise.all([
      api.getServers().catch(() => null),
      api.getAuditLogs(8).catch(() => []),
      api.getSecurityEvents().catch(() => []),
      api.getSecurityStats().catch(() => null),
      api.getFirewallStatus().catch(() => null),
      api.getDatabaseBackups().catch(() => null),
      apiV1.fleetSummary().catch(() => null),
    ]);
    if (serverRes?.servers) setServers(serverRes.servers);
    if (Array.isArray(auditRes)) setAuditLogs(auditRes);
    if (Array.isArray(securityRes)) setSecurityEvents(securityRes);
    if (securityStatRes) setSecurityStats(securityStatRes);
    if (firewallRes) setFirewall(firewallRes as FirewallStatus);
    if (backupRes?.backups) setBackups(backupRes.backups as BackupRecord[]);
    if (fleetRes) setFleet(fleetRes);
  }, []);

  useEffect(() => {
    loadHistory(range);
    const timer = window.setInterval(() => loadHistory(range), 30000);
    return () => window.clearInterval(timer);
  }, [range, loadHistory]);

  useEffect(() => {
    const loadSystem = async () => {
      try {
        const res = await api.getSystemHistory();
        if (res?.history) setSystemHistory(res.history);
      } catch {
        /* keep the previous sample */
      }
    };
    loadSystem();
    const timer = window.setInterval(loadSystem, 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    loadLiveExtras();
    const timer = window.setInterval(loadLiveExtras, 30000);
    return () => window.clearInterval(timer);
  }, [loadLiveExtras]);

  const refreshAll = async () => {
    setLoading(true);
    try {
      await Promise.all([refresh(), loadHistory(range), loadLiveExtras()]);
    } finally {
      setLoading(false);
    }
  };

  const selectRange = (next: '24h' | '7d') => {
    setRange(next);
    try {
      localStorage.setItem(RANGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  };

  const cpuPoints: ChartPoint[] = useMemo(
    () => history.map((point) => ({ label: formatTimeLabel(point.timestamp, range), value: point.cpu })),
    [history, range],
  );
  const ramPoints: ChartPoint[] = useMemo(
    () => history.map((point) => ({ label: formatTimeLabel(point.timestamp, range), value: point.ram })),
    [history, range],
  );

  const lastCpu = cpuPoints.length ? Math.round(cpuPoints[cpuPoints.length - 1].value) : Math.round(host?.cpu ?? 0);
  const lastRam = ramPoints.length ? Math.round(ramPoints[ramPoints.length - 1].value) : Math.round(host?.ram ?? 0);

  const activeSessions = sessions.filter((session) => (session.state || session.status) === 'Active');
  const runningServices = services.filter((service) => service.status === 'Running');
  const criticalServices = services.filter((service) => service.critical);
  const criticalRunning = criticalServices.length > 0 && criticalServices.every((service) => service.status === 'Running');

  const securityAlerts = securityEvents.filter((event) => event.severity === 'danger' || event.severity === 'warning');
  const firewallActive = firewall?.profiles ? Object.values(firewall.profiles).every(Boolean) : Boolean(securityStats?.firewall_active);
  const lastBackup = backups[0];

  const networkRx = systemHistory?.network.rx_rate_kb ?? 0;
  const networkTx = systemHistory?.network.tx_rate_kb ?? 0;
  const networkTotal = networkRx + networkTx;

  const cpuValue = Math.round(host?.cpu ?? 0);
  const ramValue = Math.round(host?.ram ?? 0);
  const diskValue = Math.round(host?.disk?.percent ?? 0);
  const diskTotal = Number(host?.disk?.total ?? 0);
  const totalSessions = sessions.length;

  const recentActivity = auditLogs.slice(0, 5);
  const shellTop = host?.cpuCores ?? host?.cpuPerCore?.length ?? 0;

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head__title">
          <span className="page-head__bar" />
          <div>
            <h1>{t('لوحة القيادة')}</h1>
            <p>{t('نظرة شاملة على حالة السيرفر والموارد والخدمات الأمنية')}</p>
          </div>
        </div>
        <div className="page-head__actions">
          <div className="range-switch" role="group" aria-label={t('نطاق القياس الزمني')}>
            <button type="button" data-active={range === '24h'} onClick={() => selectRange('24h')}>{t('آخر 24 ساعة')}</button>
            <button type="button" data-active={range === '7d'} onClick={() => selectRange('7d')}>{t('آخر 7 أيام')}</button>
          </div>
          <span className="period-pill">
            <Clock3 size={14} />
            {new Date().toLocaleDateString('en-GB')}
          </span>
          <button
            type="button"
            className="icon-btn"
            onClick={refreshAll}
            disabled={loading}
            aria-label={t('تحديث بيانات اللوحة')}
            title={t('تحديث بيانات اللوحة')}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {fleet && (
        <section style={{ marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Bot size={18} style={{ color: 'var(--accent)' }} />
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>{t('أسطول أساس')}</h2>
              <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-telemetry)' }}>
                {fleet.totals.online}/{fleet.totals.agents} {t('متصل')} · {fleet.totals.with_results} {t('بقياسات')}
              </span>
            </div>
            <NavLink to="/agents" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>
              {t('إدارة الوكلاء')} ←
            </NavLink>
          </div>
          {fleet.agents.length === 0 ? (
            <div style={{ border: '1px dashed var(--accent-soft)', borderRadius: 14, padding: '18px 20px', color: 'var(--text-3)', fontSize: 13 }}>
              {t('لا يوجد وكلاء مسجلون بعد — ثبّت Asaas.Agent على خوادمك لتبدأ القياسات الحقيقية هنا.')}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
              {fleet.agents.map((ag) => (
                <NavLink
                  key={ag.id}
                  to="/agents"
                  style={{ textDecoration: 'none', border: '1px solid var(--accent-soft)', borderRadius: 14, padding: '14px 16px', background: 'var(--glass-rim-low)', display: 'block' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-1)' }}>{ag.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: ag.status === 'online' ? 'var(--status-safe-surface, rgba(34,197,94,.15))' : 'var(--surface-glass-tint)', color: ag.status === 'online' ? 'var(--status-safe, #22c55e)' : 'var(--text-3)' }}>
                      {ag.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-2)', fontFamily: 'var(--font-telemetry)', direction: 'ltr', textAlign: 'left' }}>
                    {ag.hostname || ag.id.slice(0, 8)}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                    {ag.os ? String(ag.os).slice(0, 48) : '—'}
                    {ag.linked_asset ? ` · ${ag.linked_asset.name}` : ''}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
                    {ag.collector_count > 0
                      ? `${ag.collector_count} ${t('قياس')} · ${ag.last_collection_at ? new Date(ag.last_collection_at).toLocaleString('ar-SA') : ''}`
                      : t('لا قياسات بعد')}
                  </div>
                </NavLink>
              ))}
            </div>
          )}
        </section>
      )}

      <div className="kpi-grid">
        <article className="kpi">
          <div className="kpi__top">
            <span className="kpi__label">{t('المعالج (CPU)')}</span>
            <span className="kpi__icon"><Cpu size={19} /></span>
          </div>
          <div className="kpi__value">{cpuValue}%</div>
          <div className="kpi__foot">{shellTop} {t('نواة')}</div>
          <div className="kpi__meter meter"><div className="meter__fill" style={{ width: `${Math.min(100, Math.max(2, cpuValue))}%` }} /></div>
        </article>

        <article className="kpi">
          <div className="kpi__top">
            <span className="kpi__label">{t('الذاكرة (RAM)')}</span>
            <span className="kpi__icon"><MemoryStick size={19} /></span>
          </div>
          <div className="kpi__value">{ramValue}%</div>
          <div className="kpi__foot">{t('من')} {formatGb(host?.totalRam ?? 0)} GB</div>
          <div className="kpi__meter meter"><div className="meter__fill" style={{ width: `${Math.min(100, Math.max(2, ramValue))}%` }} /></div>
        </article>

        <article className="kpi">
          <div className="kpi__top">
            <span className="kpi__label">{t('القرص (C:)')}</span>
            <span className="kpi__icon"><HardDrive size={19} /></span>
          </div>
          <div className="kpi__value">{diskValue}%</div>
          <div className="kpi__foot">{t('من')} {formatGb(diskTotal)} GB</div>
          <div className="kpi__meter meter"><div className="meter__fill" style={{ width: `${Math.min(100, Math.max(2, diskValue))}%` }} /></div>
        </article>

        <article className="kpi">
          <div className="kpi__top">
            <span className="kpi__label">{t('الشبكة')}</span>
            <span className="kpi__icon"><Network size={19} /></span>
          </div>
          <div className="kpi__value">{formatMbps(networkTotal)} <small>Mbps</small></div>
          <div className="kpi__foot">
            <span className="up">↑ {formatSpeed(networkTx)}</span>
            <span className="down">↓ {formatSpeed(networkRx)}</span>
          </div>
          <div className="kpi__meter meter"><div className="meter__fill meter__fill--blue" style={{ width: `${Math.min(100, Math.max(2, (networkTotal / 12800) * 100))}%` }} /></div>
        </article>

        <article className="kpi">
          <div className="kpi__top">
            <span className="kpi__label">{t('جلسات RDP النشطة')}</span>
            <span className="kpi__icon"><Users size={19} /></span>
          </div>
          <div className="kpi__value">{activeSessions.length}</div>
          <div className="kpi__foot">{t('من أصل')} {totalSessions} {t('جلسة مسجلة')}</div>
          <div className="kpi__meter meter"><div className="meter__fill meter__fill--green" style={{ width: `${totalSessions ? Math.max(3, (activeSessions.length / totalSessions) * 100) : 0}%` }} /></div>
        </article>

        <article className="kpi kpi--danger">
          <div className="kpi__top">
            <span className="kpi__label">{t('التنبيهات الأمنية')}</span>
            <span className="kpi__icon"><ShieldCheck size={19} /></span>
          </div>
          <div className="kpi__value">{securityAlerts.length}</div>
          <div className="kpi__foot">{securityAlerts.length ? t('بحاجة إلى مراجعة') : t('لا توجد تنبيهات معلقة')}</div>
          <div className="kpi__meter meter"><div className="meter__fill meter__fill--red" style={{ width: `${Math.min(100, securityAlerts.length * 8 + (securityAlerts.length ? 6 : 0))}%` }} /></div>
        </article>
      </div>

      <div className="overview-charts">
        <CpuHistoryChart points={cpuPoints} value={lastCpu} />
        <HistoricalMetricsChart
          points={ramPoints}
          value={lastRam}
          usedGb={host?.usedRam ?? 0}
          totalGb={host?.totalRam ?? 0}
        />

        <section className="panel chart-card server-rail-card" aria-label={t('حالة السيرفر')}>
          <header className="panel__head">
            <h2 className="panel__title">
              <Activity size={17} />
              {t('حالة السيرفر')}
            </h2>
            <span className={`badge ${health?.ok ? 'badge--success' : 'badge--warning'}`}>
              <span className="badge-dot" />
              {health?.ok ? t('متصل') : t('قيد الفحص')}
            </span>
          </header>
          <div className="panel__body">
            <div className="status-rows">
              <div className="status-row">
                <span>{t('النظام يعمل بشكل طبيعي')}</span>
                <span className={`status-${health?.ok ? 'ok' : 'warn'}`}>
                  {health?.ok ? <CheckCircle2 /> : <AlertTriangle />}
                </span>
              </div>
              <div className="status-row">
                <span>{t('الخدمات الأساسية')} ({runningServices.length}/{services.length})</span>
                <span className={`status-${criticalRunning ? 'ok' : 'warn'}`}>
                  {criticalRunning ? <CheckCircle2 /> : <AlertTriangle />}
                </span>
              </div>
              <div className="status-row">
                <span>{t('جدار الحماية')}</span>
                <span className={`status-${firewallActive ? 'ok' : 'warn'}`}>
                  {firewallActive ? <CheckCircle2 /> : <AlertTriangle />}
                </span>
              </div>
              <div className="status-row">
                <span>{t('حماية الحسابات والتصعيد')}</span>
                <span className={`status-${securityStats?.auto_ban_enabled ? 'ok' : 'warn'}`}>
                  {securityStats?.auto_ban_enabled ? <CheckCircle2 /> : <AlertTriangle />}
                </span>
              </div>
              <div className="status-row">
                <span>{t('النسخ الاحتياطي')}</span>
                <span className={`status-${lastBackup ? 'ok' : 'warn'}`}>
                  {lastBackup ? <CheckCircle2 /> : <Clock3 />}
                </span>
              </div>
            </div>
            <div className="status-backup">
              <span>{t('النسخ الاحتياطي التلقائي')}</span>
              <span>{lastBackup ? `${t('آخر نسخة ')}${relativeFrom(lastBackup.modified_at)}` : t('لا توجد نسخة مسجلة')}</span>
            </div>
          </div>
        </section>
      </div>

      <div className="overview-rail">
        <section className="panel" aria-label={t('السيرفرات والخدمات')}>
          <header className="panel__head">
            <h2 className="panel__title">
              <Server size={17} />
              {t('السيرفرات والخدمات')}
            </h2>
            <NavLink to="/servers" className="panel__action" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
              {t('عرض الكل')}
              <ChevronLeft size={13} />
            </NavLink>
          </header>
          <div className="panel__body panel__body--flush">
            <div className="table-shell">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t('اسم السيرفر / الخدمة')}</th>
                    <th>{t('الحالة')}</th>
                    <th>{t('المعالج')}</th>
                    <th>{t('الذاكرة')}</th>
                    <th>{t('القرص')}</th>
                    <th>{t('مدة التشغيل')}</th>
                  </tr>
                </thead>
                <tbody>
                  {servers.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--text-3)' }}>
                        {t('جارٍ تحميل سجل السيرفرات…')}
                      </td>
                    </tr>
                  )}
                  {servers.map((server) => {
                    const isLocal = Boolean(server.is_local);
                    const serverCpu = isLocal ? (host?.cpu ?? server.cpu) : server.cpu;
                    const serverRam = isLocal ? (host?.ram ?? server.ram) : server.ram;
                    const serverDisk = isLocal ? (host?.disk?.percent ?? server.storage) : server.storage;
                    const online = server.status === 'online';
                    return (
                      <tr key={server.id}>
                        <td>
                          <span className="cell-user">
                            <Server size={13} />
                            <span className="cell-strong" dir="ltr">{server.name}</span>
                          </span>
                        </td>
                        <td>
                          <span className={`pill-status ${online ? 'pill-status--on' : 'pill-status--off'}`}>
                            <span className="badge-dot" />
                            {online ? t('متصل') : t('غير متصل')}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'grid', gap: 3, minWidth: 66 }}>
                            <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{Math.round(serverCpu)}%</span>
                            <div className="meter"><div className="meter__fill" style={{ width: `${Math.min(100, Math.max(2, serverCpu))}%` }} /></div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'grid', gap: 3, minWidth: 66 }}>
                            <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{Math.round(serverRam)}%</span>
                            <div className="meter"><div className="meter__fill" style={{ width: `${Math.min(100, Math.max(2, serverRam))}%` }} /></div>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'grid', gap: 3, minWidth: 66 }}>
                            <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>{Math.round(serverDisk)}%</span>
                            <div className="meter"><div className="meter__fill" style={{ width: `${Math.min(100, Math.max(2, serverDisk))}%` }} /></div>
                          </div>
                        </td>
                        <td className="cell-muted" style={{ fontSize: 10.5 }}>
                          {isLocal ? (host?.uptime || '—') : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="panel activity-card" aria-label={t('النشاط الأخير')}>
          <header className="panel__head">
            <h2 className="panel__title">
              <Clock3 size={17} />
              {t('النشاط الأخير')}
            </h2>
          </header>
          <div className="panel__body" style={{ paddingTop: 6 }}>
            <div className="activity-list">
              {recentActivity.length === 0 && (
                <div style={{ padding: '18px 0', textAlign: 'center', color: 'var(--text-3)', fontSize: 11 }}>
                  {t('لا توجد أحداث تدقيق حديثة')}
                </div>
              )}
              {recentActivity.map((entry) => {
                const meta = ACTION_META[entry.action] || { title: entry.action, icon: Settings2 };
                const Icon = meta.icon;
                return (
                  <div className="activity-row" key={entry.id}>
                    <span className="activity-row__time">{clockOf(entry.timestamp)}</span>
                    <span className="activity-row__icon"><Icon /></span>
                    <span className="activity-row__main">
                      <span className="activity-row__title">{meta.title}</span>
                      <span className="activity-row__meta">{entry.user} · {entry.ip || '—'}</span>
                    </span>
                  </div>
                );
              })}
            </div>
            <button type="button" className="activity-more" onClick={() => navigate('/audit')}>
              {t('عرض جميع السجلات')}
              <ArrowLeft size={13} />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
