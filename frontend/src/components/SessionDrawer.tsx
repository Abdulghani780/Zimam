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
    <aside className="session-panel" aria-label={`تفاصيل جلسة المستخدم ${session.user}`}>
      <header className="session-panel__head">
        <h2 className="session-panel__title">
          <Monitor size={17} />
          تفاصيل الجلسة
        </h2>
        <button type="button" className="modal-panel__close" onClick={onClose} aria-label="إغلاق تفاصيل الجلسة">
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
          <DetailRow icon={<UserRound size={13} />} label="اسم المستخدم">
            <span dir="ltr">{session.user}</span>
          </DetailRow>
          <DetailRow icon={<Server size={13} />} label="الخادم">
            <span dir="ltr">{hostname}</span>
          </DetailRow>
          <DetailRow icon={<Globe size={13} />} label="عنوان المصدر (IP)">
            <span className="ltr" title="لا يوفّر Windows WTS عنوان IP المصدر للجلسة">—</span>
          </DetailRow>
          <DetailRow icon={<CalendarClock size={13} />} label="وقت تسجيل الدخول">
            <span className="ltr">{formatLoginTimestamp(session.login_time || session.login)}</span>
          </DetailRow>
          <DetailRow icon={<Timer size={13} />} label="مدة الجلسة">
            <span className="ltr">{formatSessionDuration(session.login_time || session.login, now)}</span>
          </DetailRow>
          <DetailRow icon={<Activity size={13} />} label="حالة الجلسة">
            <span className={`pill-status ${status.className}`}>
              <span className="badge-dot" />
              {status.label}
            </span>
          </DetailRow>
          <DetailRow icon={<Monitor size={13} />} label="نوع الاتصال">
            <span className="ltr">{session.station || 'RDP-Tcp'}</span>
          </DetailRow>
          <DetailRow icon={<Maximize2 size={13} />} label="الدقة">
            <span className="ltr" title="دقة شاشة الجلسة غير متاحة عبر WTS">—</span>
          </DetailRow>
          <DetailRow icon={<MemoryStick size={13} />} label="الذاكرة المستخدمة">
            <span className="ltr gold">{sessionRamLabel(session)}</span>
          </DetailRow>
          <DetailRow icon={<Cpu size={13} />} label="العمليات المفتوحة">
            <span>{sessionProcessCount(session)} عملية</span>
          </DetailRow>
          <DetailRow icon={<Clock3 size={13} />} label="وقت الخمول">
            <span>{sessionIdleLabel(session)}</span>
          </DetailRow>
          <DetailRow icon={<UserRound size={13} />} label="الصلاحيات">
            <span className="chip-row">
              <span className="mini-chip">RDP</span>
              <span className="mini-chip">{session.is_current ? 'الجلسة الحالية' : session.role || 'مستخدم'}</span>
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
            {viewBusy ? 'جارٍ فتح الجلسة…' : 'عرض الجلسة'}
          </button>
          <div className="session-panel__split">
            <button type="button" className="btn-dark" onClick={() => onShadow(session)} disabled={shadowBusy}>
              <MonitorPlay size={15} />
              {shadowBusy ? 'جارٍ المراقبة…' : 'مراقبة الجلسة'}
            </button>
            <button type="button" className="btn-danger-soft" onClick={() => onDisconnect(session)}>
              <Unplug size={15} />
              قطع الاتصال
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
