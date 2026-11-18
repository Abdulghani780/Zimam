import { useEffect, useMemo, useState } from 'react';
import { useTelemetry } from '../lib/useTelemetry';
import { api, type UserSession } from '../lib/api';
import { apiV1 } from '../lib/apiV1';
import { SessionDrawer } from '../components/SessionDrawer';
import { BroadcastModal } from '../components/BroadcastModal';
import { useToast } from '../asaas-ui';
import {
  AlertCircle,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  LogOut,
  MessageSquare,
  Monitor,
  MonitorPlay,
  MoreHorizontal,
  RefreshCw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Unplug,
  UserRound,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import {
  formatLoginTimestamp,
  formatSessionDuration,
  sessionStatus,
} from '../lib/sessionUtils';
import { t } from '../lib/i18n';

type StatusFilter = 'all' | 'active' | 'disconnected' | 'other';

interface ConfirmState {
  kind: 'disconnect' | 'logoff';
  sessions: UserSession[];
}

const PAGE_SIZES = [10, 25, 50, 100];

function looksLikeAccessDenied(message: string): boolean {
  return /access denied|error 5|مسؤول|صلاحي/i.test(message);
}

type ResultEntry = { job_id: string; completed_at: string | null; result: unknown; error: string | null };

interface FleetSessionAgent {
  id: string;
  name: string;
  status: string;
  hostname?: string | null;
  linked_asset: { id: string; name: string; hostname: string } | null;
  sessions: ResultEntry | null;
  processes: ResultEntry | null;
}

// Heuristic row extraction for session.list payloads — falls back to raw JSON.
function sessionRows(result: unknown): { user: string; id: string; state: string; logon: string }[] {
  const arr = Array.isArray(result)
    ? result
    : Array.isArray((result as any)?.sessions)
      ? (result as any).sessions
      : null;
  if (!arr) return [];
  return arr
    .filter((s: unknown) => s && typeof s === 'object')
    .map((s: any) => ({
      user: String(s.user || s.username || s.name || '?'),
      id: String(s.id ?? s.session_id ?? s.sessionId ?? ''),
      state: String(s.state || s.status || ''),
      logon: String(s.logon_time || s.logonTime || s.logontime || s.login_time || ''),
    }));
}

// Heuristic row extraction for process.list payloads — falls back to raw JSON.
interface ProcRow { name: string; pid: string; mem: string; cpu: string }
function procRows(result: unknown): ProcRow[] {
  const arr = Array.isArray(result)
    ? result
    : Array.isArray((result as any)?.processes)
      ? (result as any).processes
      : null;
  if (!arr) return [];
  const pick = (o: any, ...keys: string[]) => {
    for (const k of keys) { const v = o?.[k]; if (v !== undefined && v !== null && v !== '') return v; }
    return '';
  };
  return arr
    .filter((p: unknown) => p && typeof p === 'object')
    .map((p: any) => ({
      name: String(pick(p, 'ProcessName', 'Name', 'name', 'process_name') || '?'),
      pid: String(pick(p, 'ProcessId', 'PID', 'pid', 'Id', 'id') || ''),
      mem: String(pick(p, 'WorkingSetMB', 'MemoryMB', 'memory_mb', 'WorkingSet64', 'mem') || ''),
      cpu: String(pick(p, 'CPU', 'CpuPercent', 'cpu_percent', 'cpu') || ''),
    }));
}

export function ControlPage() {
  const { snapshot, refresh } = useTelemetry();
  const toast = useToast();

  const sessions = useMemo(() => snapshot?.sessions ?? [], [snapshot?.sessions]);
  const hostname = snapshot?.host?.hostname || snapshot?.host?.host || '—';

  const [query, setQuery] = useState('');
  const [serverFilter, setServerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [userFilter, setUserFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [elevating, setElevating] = useState(false);
  const [accessDenied, setAccessDenied] = useState<string | null>(null);
  const [messageTarget, setMessageTarget] = useState<UserSession | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [fleetSessions, setFleetSessions] = useState<FleetSessionAgent[]>([]);
  const [fleetBusy, setFleetBusy] = useState<string | null>(null);
  const [procKillBusy, setProcKillBusy] = useState<string | null>(null);

  const loadFleetSessions = async () => {
    try {
      const fleetRes = await apiV1.fleetSummary();
      if (!fleetRes?.agents?.length) { setFleetSessions([]); return; }
      const detailed = await Promise.all(
        fleetRes.agents.map(async (ag) => {
          let sessionsEntry: ResultEntry | null = null;
          let processesEntry: ResultEntry | null = null;
          const r = await apiV1.agentLatestResults(ag.id).catch(() => null);
          sessionsEntry = r?.results?.['session.list'] ?? null;
          processesEntry = r?.results?.['process.list'] ?? null;
          return { ...ag, sessions: sessionsEntry, processes: processesEntry };
        }),
      );
      setFleetSessions(detailed);
    } catch {
      setFleetSessions([]);
    }
  };

  useEffect(() => {
    loadFleetSessions();
    const timer = window.setInterval(loadFleetSessions, 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setSelectedIds((previous) => previous.filter((id) => sessions.some((session) => session.id === id)));
    setActiveId((previous) => {
      if (previous !== null && sessions.some((session) => session.id === previous)) return previous;
      return sessions[0]?.id ?? null;
    });
  }, [sessions]);

  useEffect(() => {
    setPage(1);
  }, [query, serverFilter, statusFilter, userFilter, pageSize]);

  const activeCount = useMemo(
    () => sessions.filter((session) => sessionStatus(session).key === 'active').length,
    [sessions],
  );

  const userOptions = useMemo(
    () => Array.from(new Set(sessions.map((session) => session.user))).sort((a, b) => a.localeCompare(b, 'ar')),
    [sessions],
  );

  const filteredSessions = useMemo(() => {
    const term = query.trim().toLowerCase();
    return sessions.filter((session) => {
      const status = sessionStatus(session).key;
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (userFilter !== 'all' && session.user !== userFilter) return false;
      if (serverFilter !== 'all' && hostname !== serverFilter) return false;
      if (!term) return true;
      return (
        session.user.toLowerCase().includes(term) ||
        String(session.id).includes(term) ||
        hostname.toLowerCase().includes(term) ||
        (session.station || '').toLowerCase().includes(term) ||
        formatLoginTimestamp(session.login_time || session.login).toLowerCase().includes(term)
      );
    });
  }, [sessions, statusFilter, userFilter, serverFilter, hostname, query]);

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * pageSize;
  const visibleSessions = filteredSessions.slice(pageStart, pageStart + pageSize);
  const visibleFrom = filteredSessions.length === 0 ? 0 : pageStart + 1;
  const visibleTo = Math.min(pageStart + pageSize, filteredSessions.length);

  const pageNumbers: number[] = [];
  const firstPage = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
  const lastPage = Math.min(totalPages, firstPage + 4);
  for (let index = firstPage; index <= lastPage; index += 1) pageNumbers.push(index);

  const activeSession = sessions.find((session) => session.id === activeId) ?? null;
  const selectedSessions = sessions.filter((session) => selectedIds.includes(session.id));
  const singleTarget = selectedSessions.length === 1
    ? selectedSessions[0]
    : selectedSessions.length === 0
      ? activeSession
      : null;
  const bulkTargets = selectedSessions.length > 0
    ? selectedSessions
    : activeSession
      ? [activeSession]
      : [];
  const selectionCount = selectedIds.length || (activeSession ? 1 : 0);
  const allVisibleSelected = visibleSessions.length > 0
    && visibleSessions.every((session) => selectedIds.includes(session.id));

  const openSession = (session: UserSession) => {
    setActiveId(session.id);
    setSelectedIds([session.id]);
    setPanelOpen(true);
    setMoreOpen(false);
  };

  const toggleSelect = (session: UserSession) => {
    setSelectedIds((previous) => (
      previous.includes(session.id)
        ? previous.filter((id) => id !== session.id)
        : [...previous, session.id]
    ));
    setActiveId(session.id);
    setPanelOpen(true);
    setMoreOpen(false);
  };

  const toggleSelectAll = () => {
    if (allVisibleSelected) {
      setSelectedIds((previous) => previous.filter((id) => !visibleSessions.some((session) => session.id === id)));
      return;
    }
    setSelectedIds((previous) => Array.from(new Set([...previous, ...visibleSessions.map((session) => session.id)])));
  };

  const noteActionError = (message: string) => {
    if (message && looksLikeAccessDenied(message)) setAccessDenied(message);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleElevate = async () => {
    setElevating(true);
    try {
      const res = await api.requestElevation();
      toast(res.message || t('تم إرسال طلب رفع الصلاحيات، يرجى الموافقة على نافذة UAC في شاشة السيرفر.'), 'success');
      setAccessDenied(null);
    } catch (err: any) {
      toast(err.message || t('تعذر طلب ترقية الصلاحيات'), 'error');
    } finally {
      setElevating(false);
    }
  };

  const handleShadow = async (session: UserSession, mode: 'control' | 'view') => {
    setBusy(`${session.id}:${mode}`);
    setAccessDenied(null);
    try {
      const res = await api.shadowSession(session.id, mode);
      if (res.ok) {
        toast(
          mode === 'control'
            ? `${t('تم إطلاق نافذة التحكم بجلسة ')}${session.user}${t(' بنجاح.')}`
            : `${t('تم إطلاق المراقبة الحية لجلسة ')}${session.user}${t(' بنجاح.')}`,
          'success',
        );
      } else {
        const message = res.error || t('تعذر إطلاق الجلسة. تأكد من صلاحيات المسؤول وتفعيل سياسة RDP Shadowing.');
        toast(message, 'error');
        noteActionError(message);
      }
    } catch (err: any) {
      const message = err.message || t('خطأ في إطلاق الجلسة');
      toast(message, 'error');
      noteActionError(message);
    } finally {
      setBusy(null);
    }
  };

  const handleFleetSessionAction = async (ag: FleetSessionAgent, sessionId: string, kind: 'disconnect' | 'logoff') => {
    const sid = Number.parseInt(sessionId, 10);
    if (!Number.isFinite(sid) || sid <= 0) {
      toast(t('معرّف جلسة غير صالح'), 'error');
      return;
    }
    const key = `${ag.id}:${sid}:${kind}`;
    setFleetBusy(key);
    try {
      const res = kind === 'disconnect'
        ? await apiV1.disconnectSession(ag.id, sid)
        : await apiV1.terminateSession(ag.id, sid);
      toast(`${t('تمت جدولة الأمر')} (${res.job_id?.slice(0, 8) ?? '…'}) — ${t('ينفذه الوكيل عند أول poll تالٍ')}`, 'success');
    } catch (err: any) {
      toast(err?.message || t('فشل جدولة الأمر'), 'error');
    } finally {
      setFleetBusy(null);
    }
  };

  const requestBulkDisconnect = () => {
    if (bulkTargets.length === 0) return;
    setConfirmState({ kind: 'disconnect', sessions: bulkTargets });
    setMoreOpen(false);
  };

  const requestBulkLogoff = () => {
    if (bulkTargets.length === 0) return;
    setConfirmState({ kind: 'logoff', sessions: bulkTargets });
    setMoreOpen(false);
  };

  const executeConfirm = async () => {
    if (!confirmState) return;
    const { kind, sessions: targets } = confirmState;
    setConfirmBusy(true);
    setAccessDenied(null);
    try {
      const results = await Promise.allSettled(
        targets.map((session) => (
          kind === 'disconnect'
            ? api.disconnectSession(session.id)
            : api.logoffSession(session.id)
        )),
      );

      let succeeded = 0;
      let firstError = '';
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value?.ok) {
          succeeded += 1;
        } else {
          const message = result.status === 'rejected'
            ? result.reason?.message || ''
            : result.value?.error || '';
          if (!firstError) firstError = message;
        }
      }

      if (succeeded === targets.length) {
        toast(
          kind === 'disconnect'
            ? `${t('تم فصل ')}${succeeded}${t(' جلسة بنجاح مع إبقاء برامج المستخدمين في الخلفية.')}`
            : `${t('تم تسجيل خروج ')}${succeeded}${t(' جلسة وإنهاء برامجها بنجاح.')}`,
          'success',
        );
      } else {
        toast(firstError || `${t('تعذر إكمال العملية على ')}${targets.length - succeeded}${t(' جلسة.')}`, 'error');
        noteActionError(firstError);
      }

      setConfirmState(null);
      setSelectedIds([]);
      if (targets.some((session) => session.id === activeId)) setPanelOpen(false);
      await refresh();
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleTrim = async (session: UserSession) => {
    setBusy(`${session.id}:trim`);
    setMoreOpen(false);
    try {
      const res = await api.trimGovernor(session.id);
      const reclaimed = res.reclaimed_mb ?? res.result?.reclaimed_mb ?? 0;
      toast(
        reclaimed > 0
          ? `${t('تم استرداد ')}${reclaimed}${t(' MB من ذاكرة جلسة ')}${session.user}.`
          : res.message || `${t('ذاكرة جلسة ')}${session.user}${t(' مُحسّنة مسبقاً ولا توجد صفحات خاملة لتحريرها.')}`,
        'success',
      );
      await refresh();
    } catch (err: any) {
      toast(err.message || t('تعذر تفريغ ذاكرة الجلسة'), 'error');
    } finally {
      setBusy(null);
    }
  };

  const handleEnablePolicy = async () => {
    setBusy('policy');
    setMoreOpen(false);
    try {
      const res = await api.enableShadowPolicy();
      if (res.ok) {
        toast(res.message || t('تم تفعيل سياسة RDP Shadowing في الريجستري بنجاح.'), 'success');
        setAccessDenied(null);
      } else {
        const message = res.error || t('فشل تعديل سياسة الريجستري (يتطلب تشغيل السيرفر كمسؤول).');
        toast(message, 'error');
        noteActionError(message);
      }
    } catch (err: any) {
      const message = err.message || t('تعذر تفعيل سياسة RDP Shadowing');
      toast(message, 'error');
      noteActionError(message);
    } finally {
      setBusy(null);
    }
  };

  const confirmSingle = confirmState?.sessions.length === 1 ? confirmState.sessions[0] : null;
  const isDisconnect = confirmState?.kind === 'disconnect';

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head__title">
          <span className="page-head__icon"><Monitor size={20} /></span>
          <div>
            <h1>{t('إدارة جلسات سطح المكتب البعيد (RDP)')}</h1>
            <p>{t('مراقبة وإدارة جلسات المستخدمين النشطة على الخوادم بشكل آمن وفوري')}</p>
          </div>
        </div>
        <div className="page-head__actions">
          <button type="button" className="btn-gold-outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
            {refreshing ? t('جارٍ التحديث…') : t('تحديث الآن')}
          </button>
          <span className="rdp-count">
            <span className="conn-dot" style={{ color: 'var(--status-safe)' }} />
            {t('جلسات نشطة:')} <strong>{activeCount}</strong> من {sessions.length}
          </span>
        </div>
      </div>

      {accessDenied && (
        <div className="rdp-banner" role="alert">
          <span className="rdp-banner__icon"><ShieldAlert size={18} /></span>
          <div className="rdp-banner__copy">
            <strong>{t('رفض نظام ويندوز تنفيذ العملية (Access Denied)')}</strong>
            <p>{accessDenied}</p>
          </div>
          <button type="button" className="btn-gold-outline" onClick={handleElevate} disabled={elevating}>
            <ShieldCheck size={15} />
            {elevating ? t('جارٍ طلب الترقية…') : t('ترقية السيرفر كمسؤول')}
          </button>
          <button type="button" className="modal-panel__close" onClick={() => setAccessDenied(null)} aria-label={t('إغلاق التنبيه')}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* ASAAS remote agent sessions — real session.list collector data */}
      {fleetSessions.length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Bot size={18} style={{ color: 'var(--accent)' }} />
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text-1)' }}>{t('جلسات وكلاء أساس')}</h2>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('session.list حقيقية من كل وكيل — عرض فقط')}</span>
            </div>
            <NavLink to="/agents" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>
              {t('إدارة الوكلاء')} ←
            </NavLink>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
            {fleetSessions.map((ag) => {
              const rows = ag.sessions && !ag.sessions.error ? sessionRows(ag.sessions.result) : [];
              return (
                <div key={ag.id} style={{ border: '1px solid var(--hairline)', borderRadius: 12, padding: '14px 16px', background: 'var(--glass-tint)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{ag.linked_asset?.name || ag.name}</span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: ag.status === 'online' ? 'var(--paid-bg)' : 'var(--surface-glass-tint)', color: ag.status === 'online' ? 'var(--paid)' : 'var(--text-3)' }}>
                      {ag.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-telemetry)', direction: 'ltr', textAlign: 'left', marginBottom: 10 }}>
                    {ag.hostname || ag.id.slice(0, 8)}
                  </div>
                  {!ag.sessions ? (
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('لم يُرسل جامع الجلسات بعد — أرسله من صفحة الوكلاء.')}</div>
                  ) : ag.sessions.error ? (
                    <div className="text-status-danger" style={{ fontSize: 11 }}>{ag.sessions.error}</div>
                  ) : rows.length === 0 ? (
                    <details style={{ fontSize: 11 }}>
                      <summary style={{ cursor: 'pointer', color: 'var(--text-3)' }}>{t('نتيجة غير معروفة — عرض خام')}</summary>
                      <pre dir="ltr" style={{ margin: '8px 0 0', fontSize: 10, fontFamily: 'var(--font-telemetry)', color: 'var(--text-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 160, overflowY: 'auto' }}>
                        {JSON.stringify(ag.sessions.result, null, 2)}
                      </pre>
                    </details>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {rows.slice(0, 8).map((s, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, padding: '6px 8px', borderRadius: 8, background: 'var(--surface-ground)' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text)' }} dir="ltr">{s.user}{s.id ? ` · #${s.id}` : ''}</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ color: s.state.toLowerCase().includes('active') ? 'var(--paid)' : 'var(--text-3)', fontSize: 10 }}>
                              {s.state || '—'}{s.logon ? ` · ${s.logon}` : ''}
                            </span>
                            {/^\d+$/.test(s.id) && !/listen/i.test(s.state) && (
                              <>
                                <button
                                  type="button"
                                  title={t('فصل الجلسة (يبقيها، يقطع الاتصال)')}
                                  disabled={fleetBusy !== null}
                                  onClick={() => handleFleetSessionAction(ag, s.id, 'disconnect')}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 2, display: 'inline-flex' }}
                                >
                                  <Unplug size={12} />
                                </button>
                                <button
                                  type="button"
                                  title={t('تسجيل خروج الجلسة')}
                                  disabled={fleetBusy !== null}
                                  onClick={() => handleFleetSessionAction(ag, s.id, 'logoff')}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger, #dc2626)', padding: 2, display: 'inline-flex' }}
                                >
                                  <LogOut size={12} />
                                </button>
                              </>
                            )}
                          </span>
                        </div>
                      ))}
                      {rows.length > 8 && <div style={{ fontSize: 10, color: 'var(--text-3)' }}>+{rows.length - 8} {t('جلسة أخرى')}</div>}
                      {ag.sessions.completed_at && (
                        <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{t('آخر قياس')}: {new Date(ag.sessions.completed_at).toLocaleString('ar-SA')}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ASAAS remote agent processes — real process.list collector data */}
      {fleetSessions.length > 0 && (
        <section style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <MonitorPlay size={18} style={{ color: 'var(--accent)' }} />
              <h2 style={{ fontSize: 16, fontWeight: 800, margin: 0, color: 'var(--text-1)' }}>{t('عمليات وكلاء أساس')}</h2>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('process.list حقيقية من كل وكيل — عرض فقط')}</span>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
            {fleetSessions.map((ag) => {
              const procs = ag.processes && !ag.processes.error ? procRows(ag.processes.result) : [];
              return (
                <div key={ag.id} style={{ border: '1px solid var(--hairline)', borderRadius: 12, padding: '14px 16px', background: 'var(--glass-tint)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{ag.linked_asset?.name || ag.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: ag.status === 'online' ? 'var(--paid-bg)' : 'var(--surface-glass-tint)', color: ag.status === 'online' ? 'var(--paid)' : 'var(--text-3)' }}>
                      {ag.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-telemetry)', direction: 'ltr', textAlign: 'left', marginBottom: 10 }}>
                    {ag.hostname || ag.id.slice(0, 8)}
                    {procs.length > 0 ? ` · ${procs.length} ${t('عملية')}` : ''}
                  </div>
                  {!ag.processes ? (
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('لم يُرسل جامع العمليات بعد — أرسله من صفحة الوكلاء.')}</div>
                  ) : ag.processes.error ? (
                    <div className="text-status-danger" style={{ fontSize: 11 }}>{ag.processes.error}</div>
                  ) : procs.length === 0 ? (
                    <details style={{ fontSize: 11 }}>
                      <summary style={{ cursor: 'pointer', color: 'var(--text-3)' }}>{t('نتيجة غير معروفة — عرض خام')}</summary>
                      <pre dir="ltr" style={{ margin: '8px 0 0', fontSize: 10, fontFamily: 'var(--font-telemetry)', color: 'var(--text-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 160, overflowY: 'auto' }}>
                        {JSON.stringify(ag.processes.result, null, 2)}
                      </pre>
                    </details>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
                      {procs.slice(0, 25).map((p, i) => {
                        const pidNum = parseInt(p.pid, 10);
                        const canKill = Number.isFinite(pidNum) && pidNum > 4;
                        const killKey = `${ag.id}:${pidNum}`;
                        return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 10, padding: '5px 8px', borderRadius: 6, background: 'var(--surface-ground)' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                          <span style={{ color: 'var(--text-3)', fontFamily: 'var(--font-telemetry)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }} dir="ltr">
                            {p.pid ? `#${p.pid}` : ''}{p.mem ? ` · ${p.mem}` : ''}{p.cpu ? ` · ${p.cpu}` : ''}
                            {canKill && (
                              <button
                                type="button"
                                disabled={procKillBusy !== null}
                                onClick={() => {
                                  if (!window.confirm(t(`إنهاء العملية ${p.name} (PID ${pidNum}) على ${ag.linked_asset?.name || ag.name}؟`))) return;
                                  setProcKillBusy(killKey);
                                  apiV1.createJob({ agent_id: ag.id, job_type: 'process.kill', payload: { pid: pidNum } })
                                    .then(() => toast(t('تم إرسال أمر الإنهاء — ينفذ على الوكيل خلال ~15 ثانية'), 'success'))
                                    .catch((e: any) => toast(e?.message || t('فشل إرسال الأمر'), 'error'))
                                    .finally(() => setProcKillBusy(null));
                                }}
                                style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, cursor: procKillBusy ? 'wait' : 'pointer', border: '1px solid var(--glass-rim)', background: 'transparent', color: 'var(--status-danger, #dc2626)' }}
                              >
                                {procKillBusy === killKey ? '…' : t('إنهاء')}
                              </button>
                            )}
                          </span>
                        </div>
                        );
                      })}
                      {procs.length > 25 && <div style={{ fontSize: 10, color: 'var(--text-3)' }}>+{procs.length - 25} {t('عملية أخرى')}</div>}
                      {ag.processes.completed_at && (
                        <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{t('آخر قياس')}: {new Date(ag.processes.completed_at).toLocaleString('ar-SA')}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="rdp-layout">
        <div className="rdp-main">
          <section className="panel" aria-label={t('قائمة جلسات سطح المكتب البعيد')}>
            <div className="rdp-filters">
              <label className="search-box">
                <Search size={15} />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('ابحث باسم المستخدم أو الخادم أو معرّف الجلسة…')}
                  aria-label={t('البحث في الجلسات')}
                />
              </label>

              <div className="ui-select">
                <select
                  aria-label={t('تصفية حسب الخادم')}
                  value={serverFilter}
                  onChange={(event) => setServerFilter(event.target.value)}
                >
                  <option value="all">{t('كل الخوادم')}</option>
                  <option value={hostname}>{hostname}</option>
                </select>
              </div>

              <div className="ui-select">
                <select
                  aria-label={t('تصفية حسب حالة الجلسة')}
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                >
                  <option value="all">{t('كل الحالات')}</option>
                  <option value="active">{t('نشطة')}</option>
                  <option value="disconnected">{t('خاملة')}</option>
                  <option value="other">{t('مستمرة')}</option>
                </select>
              </div>

              <div className="ui-select">
                <select
                  aria-label={t('تصفية حسب المستخدم')}
                  value={userFilter}
                  onChange={(event) => setUserFilter(event.target.value)}
                >
                  <option value="all">{t('كل المستخدمين')}</option>
                  {userOptions.map((user) => (
                    <option key={user} value={user}>{user}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="table-shell">
              <table className="data-table rdp-table">
                <thead>
                  <tr>
                    <th style={{ width: 36 }}>
                      <button
                        type="button"
                        className="table-check"
                        data-checked={allVisibleSelected ? 'true' : 'false'}
                        onClick={toggleSelectAll}
                        aria-label={t('تحديد كل الجلسات الظاهرة')}
                        aria-pressed={allVisibleSelected}
                      >
                        {allVisibleSelected && <Check size={11} />}
                      </button>
                    </th>
                    <th>{t('اسم المستخدم')}</th>
                    <th>{t('عنوان المصدر (IP)')}</th>
                    <th>{t('وقت تسجيل الدخول')}</th>
                    <th>{t('مدة الجلسة')}</th>
                    <th>{t('حالة الجلسة')}</th>
                    <th>{t('الخادم')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSessions.length === 0 && (
                    <tr>
                      <td colSpan={7}>
                        <div className="rdp-empty">
                          <Monitor size={26} />
                          <strong>{t('لا توجد جلسات مطابقة')}</strong>
                          <span>{t('جرّب تغيير عوامل التصفية أو البحث للعثور على جلسة.')}</span>
                        </div>
                      </td>
                    </tr>
                  )}

                  {visibleSessions.map((session) => {
                    const status = sessionStatus(session);
                    const selected = selectedIds.includes(session.id);
                    const isFocused = activeSession?.id === session.id;
                    return (
                      <tr
                        key={session.id}
                        data-selected={isFocused ? 'true' : undefined}
                        onClick={() => openSession(session)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td onClick={(event) => event.stopPropagation()}>
                          <button
                            type="button"
                            className="table-check"
                            data-checked={selected ? 'true' : 'false'}
                            onClick={() => toggleSelect(session)}
                            aria-label={`${t('تحديد جلسة ')}${session.user}`}
                            aria-pressed={selected}
                          >
                            {selected && <Check size={11} />}
                          </button>
                        </td>
                        <td>
                          <span className="cell-user">
                            <UserRound size={13} />
                            <span className="cell-strong" dir="ltr">{session.user}</span>
                            {session.is_current && <span className="mini-chip">{t('أنت هنا')}</span>}
                          </span>
                        </td>
                        <td>
                          <span
                            className="mono-sm"
                            dir="ltr"
                            title={t('لا يوفّر Windows WTS عنوان IP المصدر للجلسة')}
                          >
                            —
                          </span>
                        </td>
                        <td className="cell-mono" style={{ color: 'var(--text-muted)' }}>
                          {formatLoginTimestamp(session.login_time || session.login)}
                        </td>
                        <td className="cell-mono" style={{ color: 'var(--text-muted)' }}>
                          {formatSessionDuration(session.login_time || session.login, now)}
                        </td>
                        <td>
                          <span className={`pill-status ${status.className}`}>
                            <span className="badge-dot" />
                            {status.label}
                            {status.key === 'other' && <RefreshCw size={10} className="spin" />}
                          </span>
                        </td>
                        <td className="cell-muted" dir="ltr">{hostname}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="rdp-quickbar">
              <span className="rdp-quickbar__label">
                {t('إجراءات سريعة على المحدد')} ({selectionCount})
              </span>
              <div className="rdp-quickbar__actions">
                <button
                  type="button"
                  className="btn-gold-outline"
                  onClick={() => singleTarget && handleShadow(singleTarget, 'control')}
                  disabled={!singleTarget || Boolean(busy)}
                >
                  <Eye size={15} />
                  {t('عرض الجلسة')}
                </button>
                <button
                  type="button"
                  className="btn-danger-soft"
                  onClick={requestBulkDisconnect}
                  disabled={bulkTargets.length === 0 || confirmBusy}
                >
                  <Unplug size={15} />
                  {t('قطع الاتصال')}
                </button>
                <button
                  type="button"
                  className="btn-dark"
                  onClick={() => singleTarget && handleShadow(singleTarget, 'view')}
                  disabled={!singleTarget || Boolean(busy)}
                >
                  <MonitorPlay size={15} />
                  {t('مراقبة الجلسة (Shadow)')}
                </button>

                <div className="menu-wrap">
                  <button
                    type="button"
                    className="btn-dark"
                    onClick={() => setMoreOpen((open) => !open)}
                    aria-expanded={moreOpen}
                    aria-haspopup="menu"
                  >
                    <MoreHorizontal size={16} />
                    {t('المزيد')}
                  </button>

                  {moreOpen && (
                    <>
                      <button
                        type="button"
                        className="menu-backdrop"
                        aria-label={t('إغلاق قائمة الإجراءات')}
                        onClick={() => setMoreOpen(false)}
                      />
                      <div className="menu-pop" role="menu">
                        <button
                          type="button"
                          role="menuitem"
                          disabled={!singleTarget}
                          onClick={() => {
                            if (singleTarget) setMessageTarget(singleTarget);
                            setMoreOpen(false);
                          }}
                        >
                          <MessageSquare size={14} />
                          {t('إرسال تنبيه مباشر للمستخدم')}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          disabled={bulkTargets.length === 0}
                          onClick={requestBulkLogoff}
                        >
                          <LogOut size={14} />
                          {t('تسجيل خروج إجباري')}
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          disabled={!singleTarget || busy !== null}
                          onClick={() => { if (singleTarget) void handleTrim(singleTarget); }}
                        >
                          <Zap size={14} />
                          {t('تفريغ الذاكرة الخاملة للجلسة')}
                        </button>
                        <div className="menu-pop__sep" />
                        <button
                          type="button"
                          role="menuitem"
                          disabled={busy === 'policy'}
                          onClick={handleEnablePolicy}
                        >
                          <ShieldCheck size={14} />
                          {busy === 'policy' ? t('جارٍ تفعيل السياسة…') : t('تفعيل سياسة RDP Shadowing')}
                        </button>
                        <button type="button" role="menuitem" onClick={handleRefresh}>
                          <RefreshCw size={14} />
                          {t('تحديث بيانات الجلسات')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="pagination">
              <span>
                {t('إظهار')} {visibleFrom} - {visibleTo} {t('من')} {filteredSessions.length} {t('جلسة')}
              </span>

              {totalPages > 1 && (
                <div className="pagination__pages">
                  <button
                    type="button"
                    onClick={() => setPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage <= 1}
                    aria-label={t('الصفحة السابقة')}
                  >
                    <ChevronRight size={13} />
                  </button>
                  {pageNumbers.map((pageNumber) => (
                    <button
                      key={pageNumber}
                      type="button"
                      data-active={pageNumber === currentPage ? 'true' : undefined}
                      onClick={() => setPage(pageNumber)}
                    >
                      {pageNumber}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage >= totalPages}
                    aria-label={t('الصفحة التالية')}
                  >
                    <ChevronLeft size={13} />
                  </button>
                </div>
              )}

              <span className="pagination__size">
                {t('عدد العناصر في الصفحة')}
                <span className="ui-select">
                  <select
                    aria-label={t('عدد العناصر في الصفحة')}
                    value={pageSize}
                    onChange={(event) => setPageSize(Number(event.target.value))}
                  >
                    {PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>{size}</option>
                    ))}
                  </select>
                </span>
              </span>
            </div>
          </section>
        </div>

        {panelOpen && activeSession && (
          <SessionDrawer
            key={activeSession.id}
            session={activeSession}
            hostname={hostname}
            onClose={() => setPanelOpen(false)}
            onView={(session) => handleShadow(session, 'control')}
            onShadow={(session) => handleShadow(session, 'view')}
            onDisconnect={(session) => setConfirmState({ kind: 'disconnect', sessions: [session] })}
            viewBusy={busy === `${activeSession.id}:control`}
            shadowBusy={busy === `${activeSession.id}:view`}
          />
        )}
      </div>

      {confirmState && (
        <div
          className="modal-overlay"
          role="presentation"
          onClick={() => { if (!confirmBusy) setConfirmState(null); }}
        >
          <div
            className="modal-panel"
            role="dialog"
            aria-modal="true"
            aria-label={isDisconnect ? t('تأكيد قطع الاتصال') : t('تأكيد تسجيل الخروج')}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-panel__head">
              <span className="modal-panel__title">
                {isDisconnect ? <Unplug size={18} /> : <LogOut size={18} />}
                {isDisconnect ? t('تأكيد قطع الاتصال') : t('تأكيد تسجيل الخروج')}
              </span>
              <button
                type="button"
                className="modal-panel__close"
                onClick={() => setConfirmState(null)}
                disabled={confirmBusy}
                aria-label={t('إغلاق نافذة التأكيد')}
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-panel__body">
              <p style={{ margin: 0 }}>
                {isDisconnect
                  ? t('هل أنت متأكد من قطع اتصال المستخدم؟')
                  : t('هل أنت متأكد من تسجيل خروج المستخدم؟')}
              </p>

              {confirmSingle ? (
                <div className="modal-kv">
                  <span className="modal-kv__cell">
                    <UserRound size={15} />
                    <span>
                      <strong dir="ltr">{confirmSingle.user}</strong>
                      <small>{t('اسم المستخدم')}</small>
                    </span>
                  </span>
                  <span className="modal-kv__divider" />
                  <span className="modal-kv__cell">
                    <Server size={15} />
                    <span>
                      <strong dir="ltr">{hostname}</strong>
                      <small>{t('الخادم')}</small>
                    </span>
                  </span>
                </div>
              ) : (
                <div className="modal-kv">
                  <span className="modal-kv__cell">
                    <Users size={15} />
                    <span>
                      <strong>{confirmState.sessions.length} {t('جلسات محددة')}</strong>
                      <small>{t('سيتم تنفيذ الإجراء على جميع الجلسات المحددة')}</small>
                    </span>
                  </span>
                </div>
              )}

              <div className="modal-warning">
                <AlertCircle size={14} />
                {isDisconnect
                  ? t('سيتم إنهاء جلسة سطح المكتب البعيد (RDP) فوراً مع إبقاء برامج المستخدم في الخلفية.')
                  : t('سيتم إغلاق كافة البرامج المفتوحة وإنهاء جلسة المستخدم نهائياً.')}
              </div>
            </div>

            <div className="modal-panel__actions">
              <button
                type="button"
                className="btn-danger-soft"
                onClick={executeConfirm}
                disabled={confirmBusy}
              >
                {confirmBusy
                  ? t('جارٍ التنفيذ…')
                  : isDisconnect
                    ? t('قطع الاتصال الآن')
                    : t('تسجيل الخروج الآن')}
              </button>
              <button
                type="button"
                className="btn-dark"
                onClick={() => setConfirmState(null)}
                disabled={confirmBusy}
              >
                {t('إلغاء')}
              </button>
            </div>
          </div>
        </div>
      )}

      <BroadcastModal
        open={messageTarget !== null}
        onClose={() => setMessageTarget(null)}
        targetSessionId={messageTarget?.id}
        targetUser={messageTarget?.user}
      />
    </div>
  );
}
