import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { UserSession } from '../lib/api';
import {
  Activity,
  CalendarClock,
  Clock3,
  Cpu,
  Eye,
  Globe,
  Maximize2,
  MemoryStick,
  Monitor,
  MonitorPlay,
  Server,
  Timer,
  Unplug,
  UserRound,
  X,
} from 'lucide-react';
import {
  formatLoginTimestamp,
  formatSessionDuration,
  sessionIdleLabel,
  sessionProcessCount,
  sessionRamLabel,
  sessionStatus,
} from '../lib/sessionUtils';
import { t } from '../lib/i18n';

interface SessionDrawerProps {
  session: UserSession;
  hostname: string;
  onClose: () => void;
  onView: (session: UserSession) => void;
  onShadow: (session: UserSession) => void;
  onDisconnect: (session: UserSession) => void;
  viewBusy?: boolean;
  shadowBusy?: boolean;
}

function DetailRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="detail-row">
      <dt>
        {icon}
        <span>{label}</span>
      </dt>
      <dd>{children}</dd>
    </div>
  );
}

export function SessionDrawer({
  session,
  hostname,
  onClose,
  onView,
  onShadow,
  onDisconnect,
  viewBusy = false,
  shadowBusy = false,
}: SessionDrawerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const status = sessionStatus(session);

  return (
    <aside className="session-panel" aria-label={`${t('تفاصيل جلسة المستخدم ')}${session.user}`}>
      <header className="session-panel__head">
        <h2 className="session-panel__title">
          <Monitor size={17} />
          {t('تفاصيل الجلسة')}
        </h2>
        <button type="button" className="modal-panel__close" onClick={onClose} aria-label={t('إغلاق تفاصيل الجلسة')}>
          <X size={16} />
        </button>
      </header>

      <div className="session-panel__body">
        <div className="session-identity">
          <span className={`pill-status ${status.className}`}>
            <span className="badge-dot" />
            {status.label}
          </span>
          <span className="session-identity__avatar">
            <UserRound size={25} />
          </span>
          <span className="session-identity__name" dir="ltr">{session.user}</span>
          <span className="session-identity__server" dir="ltr">{hostname}</span>
        </div>

        <dl className="detail-rows">
          <DetailRow icon={<UserRound size={13} />} label={t('اسم المستخدم')}>
            <span dir="ltr">{session.user}</span>
          </DetailRow>
          <DetailRow icon={<Server size={13} />} label={t('الخادم')}>
            <span dir="ltr">{hostname}</span>
          </DetailRow>
          <DetailRow icon={<Globe size={13} />} label={t('عنوان المصدر (IP)')}>
            <span className="ltr" title={t('لا يوفّر Windows WTS عنوان IP المصدر للجلسة')}>—</span>
          </DetailRow>
          <DetailRow icon={<CalendarClock size={13} />} label={t('وقت تسجيل الدخول')}>
            <span className="ltr">{formatLoginTimestamp(session.login_time || session.login)}</span>
          </DetailRow>
          <DetailRow icon={<Timer size={13} />} label={t('مدة الجلسة')}>
            <span className="ltr">{formatSessionDuration(session.login_time || session.login, now)}</span>
          </DetailRow>
          <DetailRow icon={<Activity size={13} />} label={t('حالة الجلسة')}>
            <span className={`pill-status ${status.className}`}>
              <span className="badge-dot" />
              {status.label}
            </span>
          </DetailRow>
          <DetailRow icon={<Monitor size={13} />} label={t('نوع الاتصال')}>
            <span className="ltr">{session.station || 'RDP-Tcp'}</span>
          </DetailRow>
          <DetailRow icon={<Maximize2 size={13} />} label={t('الدقة')}>
            <span className="ltr" title={t('دقة شاشة الجلسة غير متاحة عبر WTS')}>—</span>
          </DetailRow>
          <DetailRow icon={<MemoryStick size={13} />} label={t('الذاكرة المستخدمة')}>
            <span className="ltr gold">{sessionRamLabel(session)}</span>
          </DetailRow>
          <DetailRow icon={<Cpu size={13} />} label={t('العمليات المفتوحة')}>
            <span>{sessionProcessCount(session)} عملية</span>
          </DetailRow>
          <DetailRow icon={<Clock3 size={13} />} label={t('وقت الخمول')}>
            <span>{sessionIdleLabel(session)}</span>
          </DetailRow>
          <DetailRow icon={<UserRound size={13} />} label={t('الصلاحيات')}>
            <span className="chip-row">
              <span className="mini-chip">RDP</span>
              <span className="mini-chip">{session.is_current ? t('الجلسة الحالية') : session.role || t('مستخدم')}</span>
            </span>
          </DetailRow>
        </dl>

        <div className="session-panel__actions">
          <button
            type="button"
            className="btn-gold-outline"
            onClick={() => onView(session)}
            disabled={viewBusy}
          >
            <Eye size={15} />
            {viewBusy ? t('جارٍ فتح الجلسة…') : t('عرض الجلسة')}
          </button>
          <div className="session-panel__split">
            <button type="button" className="btn-dark" onClick={() => onShadow(session)} disabled={shadowBusy}>
              <MonitorPlay size={15} />
              {shadowBusy ? t('جارٍ المراقبة…') : t('مراقبة الجلسة')}
            </button>
            <button type="button" className="btn-danger-soft" onClick={() => onDisconnect(session)}>
              <Unplug size={15} />
              {t('قطع الاتصال')}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
