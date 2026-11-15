import { useEffect, useMemo, useState } from 'react';
import { useTelemetry } from '../lib/useTelemetry';
import { api, type UserSession } from '../lib/api';
import { SessionDrawer } from '../components/SessionDrawer';
import { BroadcastModal } from '../components/BroadcastModal';
import { useToast } from '../asaas-ui';
import {
  AlertCircle,
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
import {
  formatLoginTimestamp,
  formatSessionDuration,
  sessionStatus,
} from '../lib/sessionUtils';

type StatusFilter = 'all' | 'active' | 'disconnected' | 'other';

interface ConfirmState {
  kind: 'disconnect' | 'logoff';
  sessions: UserSession[];
}

const PAGE_SIZES = [10, 25, 50, 100];

function looksLikeAccessDenied(message: string): boolean {
  return /access denied|error 5|مسؤول|صلاحي/i.test(message);
}

export function ControlPage() {
  const { snapshot, refresh } = useTelemetry();
  const toast = useToast();

  const sessions = useMemo(() => snapshot?.sessions ?? [], [snapshot?.sessions]);
  const hostname = snapshot?.host?.hostname || snapshot?.host?.host || 'SRV-LOCAL';

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
      toast(res.message || 'تم إرسال طلب رفع الصلاحيات، يرجى الموافقة على نافذة UAC في شاشة السيرفر.', 'success');
      setAccessDenied(null);
    } catch (err: any) {
      toast(err.message || 'تعذر طلب ترقية الصلاحيات', 'error');
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
            ? `تم إطلاق نافذة التحكم بجلسة ${session.user} بنجاح.`
            : `تم إطلاق المراقبة الحية لجلسة ${session.user} بنجاح.`,
          'success',
        );
      } else {
        const message = res.error || 'تعذر إطلاق الجلسة. تأكد من صلاحيات المسؤول وتفعيل سياسة RDP Shadowing.';
        toast(message, 'error');
        noteActionError(message);
      }
    } catch (err: any) {
      const message = err.message || 'خطأ في إطلاق الجلسة';
      toast(message, 'error');
      noteActionError(message);
    } finally {
      setBusy(null);
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
            ? `تم فصل ${succeeded} جلسة بنجاح مع إبقاء برامج المستخدمين في الخلفية.`
            : `تم تسجيل خروج ${succeeded} جلسة وإنهاء برامجها بنجاح.`,
          'success',
        );
      } else {
        toast(firstError || `تعذر إكمال العملية على ${targets.length - succeeded} جلسة.`, 'error');
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
          ? `تم استرداد ${reclaimed} MB من ذاكرة جلسة ${session.user}.`
          : res.message || `ذاكرة جلسة ${session.user} مُحسّنة مسبقاً ولا توجد صفحات خاملة لتحريرها.`,
        'success',
      );
      await refresh();
    } catch (err: any) {
      toast(err.message || 'تعذر تفريغ ذاكرة الجلسة', 'error');
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
        toast(res.message || 'تم تفعيل سياسة RDP Shadowing في الريجستري بنجاح.', 'success');
        setAccessDenied(null);
      } else {
        const message = res.error || 'فشل تعديل سياسة الريجستري (يتطلب تشغيل السيرفر كمسؤول).';
        toast(message, 'error');
        noteActionError(message);
      }
    } catch (err: any) {
      const message = err.message || 'تعذر تفعيل سياسة RDP Shadowing';
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
            <h1>إدارة جلسات سطح المكتب البعيد (RDP)</h1>
            <p>مراقبة وإدارة جلسات المستخدمين النشطة على الخوادم بشكل آمن وفوري</p>
          </div>
        </div>
        <div className="page-head__actions">
          <button type="button" className="btn-gold-outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
            {refreshing ? 'جارٍ التحديث…' : 'تحديث الآن'}
          </button>
          <span className="rdp-count">
            <span className="conn-dot" style={{ color: 'var(--status-safe)' }} />
            جلسات نشطة: <strong>{activeCount}</strong> من {sessions.length}
          </span>
        </div>
      </div>

      {accessDenied && (
        <div className="rdp-banner" role="alert">
          <span className="rdp-banner__icon"><ShieldAlert size={18} /></span>
          <div className="rdp-banner__copy">
            <strong>رفض نظام ويندوز تنفيذ العملية (Access Denied)</strong>
            <p>{accessDenied}</p>
          </div>
          <button type="button" className="btn-gold-outline" onClick={handleElevate} disabled={elevating}>
            <ShieldCheck size={15} />
            {elevating ? 'جارٍ طلب الترقية…' : 'ترقية السيرفر كمسؤول'}
          </button>
          <button type="button" className="modal-panel__close" onClick={() => setAccessDenied(null)} aria-label="إغلاق التنبيه">
            <X size={16} />
          </button>
        </div>
      )}

      <div className="rdp-layout">
        <div className="rdp-main">
          <section className="panel" aria-label="قائمة جلسات سطح المكتب البعيد">
            <div className="rdp-filters">
              <label className="search-box">
                <Search size={15} />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="ابحث باسم المستخدم أو الخادم أو معرّف الجلسة…"
                  aria-label="البحث في الجلسات"
                />
              </label>

              <div className="ui-select">
                <select
                  aria-label="تصفية حسب الخادم"
                  value={serverFilter}
                  onChange={(event) => setServerFilter(event.target.value)}
                >
                  <option value="all">كل الخوادم</option>
                  <option value={hostname}>{hostname}</option>
                </select>
              </div>

              <div className="ui-select">
                <select
                  aria-label="تصفية حسب حالة الجلسة"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                >
                  <option value="all">كل الحالات</option>
                  <option value="active">نشطة</option>
                  <option value="disconnected">خاملة</option>
                  <option value="other">مستمرة</option>
                </select>
              </div>

              <div className="ui-select">
                <select
                  aria-label="تصفية حسب المستخدم"
                  value={userFilter}
                  onChange={(event) => setUserFilter(event.target.value)}
                >
                  <option value="all">كل المستخدمين</option>
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
                        aria-label="تحديد كل الجلسات الظاهرة"
                        aria-pressed={allVisibleSelected}
                      >
                        {allVisibleSelected && <Check size={11} />}
                      </button>
                    </th>
                    <th>اسم المستخدم</th>
                    <th>عنوان المصدر (IP)</th>
                    <th>وقت تسجيل الدخول</th>
                    <th>مدة الجلسة</th>
                    <th>حالة الجلسة</th>
                    <th>الخادم</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSessions.length === 0 && (
                    <tr>
                      <td colSpan={7}>
                        <div className="rdp-empty">
                          <Monitor size={26} />
                          <strong>لا توجد جلسات مطابقة</strong>
                          <span>جرّب تغيير عوامل التصفية أو البحث للعثور على جلسة.</span>
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
                            aria-label={`تحديد جلسة ${session.user}`}
                            aria-pressed={selected}
                          >
                            {selected && <Check size={11} />}
                          </button>
                        </td>
                        <td>
                          <span className="cell-user">
                            <UserRound size={13} />
                            <span className="cell-strong" dir="ltr">{session.user}</span>
                            {session.is_current && <span className="mini-chip">أنت هنا</span>}
                          </span>
                        </td>
                        <td>
                          <span
                            className="mono-sm"
                            dir="ltr"
                            title="لا يوفّر Windows WTS عنوان IP المصدر للجلسة"
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
                إجراءات سريعة على المحدد ({selectionCount})
              </span>
              <div className="rdp-quickbar__actions">
                <button
                  type="button"
                  className="btn-gold-outline"
                  onClick={() => singleTarget && handleShadow(singleTarget, 'control')}
                  disabled={!singleTarget || Boolean(busy)}
                >
                  <Eye size={15} />
                  عرض الجلسة
                </button>
                <button
                  type="button"
                  className="btn-danger-soft"
                  onClick={requestBulkDisconnect}
                  disabled={bulkTargets.length === 0 || confirmBusy}
                >
                  <Unplug size={15} />
                  قطع الاتصال
                </button>
                <button
                  type="button"
                  className="btn-dark"
                  onClick={() => singleTarget && handleShadow(singleTarget, 'view')}
                  disabled={!singleTarget || Boolean(busy)}
                >
                  <MonitorPlay size={15} />
                  مراقبة الجلسة (Shadow)
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
                    المزيد
                  </button>

                  {moreOpen && (
                    <>
                      <button
                        type="button"
                        className="menu-backdrop"
                        aria-label="إغلاق قائمة الإجراءات"
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
                          إرسال تنبيه مباشر للمستخدم
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          disabled={bulkTargets.length === 0}
                          onClick={requestBulkLogoff}
                        >
                          <LogOut size={14} />
                          تسجيل خروج إجباري
                        </button>
                        <button
                          type="button"
                          role="menuitem"
                          disabled={!singleTarget || busy !== null}
                          onClick={() => { if (singleTarget) void handleTrim(singleTarget); }}
                        >
                          <Zap size={14} />
                          تفريغ الذاكرة الخاملة للجلسة
                        </button>
                        <div className="menu-pop__sep" />
                        <button
                          type="button"
                          role="menuitem"
                          disabled={busy === 'policy'}
                          onClick={handleEnablePolicy}
                        >
                          <ShieldCheck size={14} />
                          {busy === 'policy' ? 'جارٍ تفعيل السياسة…' : 'تفعيل سياسة RDP Shadowing'}
                        </button>
                        <button type="button" role="menuitem" onClick={handleRefresh}>
                          <RefreshCw size={14} />
                          تحديث بيانات الجلسات
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="pagination">
              <span>
                إظهار {visibleFrom} - {visibleTo} من {filteredSessions.length} جلسة
              </span>

              {totalPages > 1 && (
                <div className="pagination__pages">
                  <button
                    type="button"
                    onClick={() => setPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage <= 1}
                    aria-label="الصفحة السابقة"
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
                    aria-label="الصفحة التالية"
                  >
                    <ChevronLeft size={13} />
                  </button>
                </div>
              )}

              <span className="pagination__size">
                عدد العناصر في الصفحة
                <span className="ui-select">
                  <select
                    aria-label="عدد العناصر في الصفحة"
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
            aria-label={isDisconnect ? 'تأكيد قطع الاتصال' : 'تأكيد تسجيل الخروج'}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-panel__head">
              <span className="modal-panel__title">
                {isDisconnect ? <Unplug size={18} /> : <LogOut size={18} />}
                {isDisconnect ? 'تأكيد قطع الاتصال' : 'تأكيد تسجيل الخروج'}
              </span>
              <button
                type="button"
                className="modal-panel__close"
                onClick={() => setConfirmState(null)}
                disabled={confirmBusy}
                aria-label="إغلاق نافذة التأكيد"
              >
                <X size={16} />
              </button>
            </div>

            <div className="modal-panel__body">
              <p style={{ margin: 0 }}>
                {isDisconnect
                  ? 'هل أنت متأكد من قطع اتصال المستخدم؟'
                  : 'هل أنت متأكد من تسجيل خروج المستخدم؟'}
              </p>

              {confirmSingle ? (
                <div className="modal-kv">
                  <span className="modal-kv__cell">
                    <UserRound size={15} />
                    <span>
                      <strong dir="ltr">{confirmSingle.user}</strong>
                      <small>اسم المستخدم</small>
                    </span>
                  </span>
                  <span className="modal-kv__divider" />
                  <span className="modal-kv__cell">
                    <Server size={15} />
                    <span>
                      <strong dir="ltr">{hostname}</strong>
                      <small>الخادم</small>
                    </span>
                  </span>
                </div>
              ) : (
                <div className="modal-kv">
                  <span className="modal-kv__cell">
                    <Users size={15} />
                    <span>
                      <strong>{confirmState.sessions.length} جلسات محددة</strong>
                      <small>سيتم تنفيذ الإجراء على جميع الجلسات المحددة</small>
                    </span>
                  </span>
                </div>
              )}

              <div className="modal-warning">
                <AlertCircle size={14} />
                {isDisconnect
                  ? 'سيتم إنهاء جلسة سطح المكتب البعيد (RDP) فوراً مع إبقاء برامج المستخدم في الخلفية.'
                  : 'سيتم إغلاق كافة البرامج المفتوحة وإنهاء جلسة المستخدم نهائياً.'}
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
                  ? 'جارٍ التنفيذ…'
                  : isDisconnect
                    ? 'قطع الاتصال الآن'
                    : 'تسجيل الخروج الآن'}
              </button>
              <button
                type="button"
                className="btn-dark"
                onClick={() => setConfirmState(null)}
                disabled={confirmBusy}
              >
                إلغاء
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
