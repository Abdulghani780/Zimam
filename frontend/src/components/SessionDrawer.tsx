import { useState } from 'react';
import { Button, useToast } from '../asaas-ui';
import { api, type UserSession } from '../lib/api';
import {
  Eye,
  MonitorPlay,
  MessageSquare,
  Unplug,
  LogOut,
  Zap,
  X,
  User,
  Clock,
  ShieldAlert,
  ShieldCheck,
  Cpu,
  AlertTriangle,
} from 'lucide-react';

interface SessionDrawerProps {
  session: UserSession | null;
  isAdmin?: boolean;
  onClose: () => void;
  onSendMessage: (sid: number, user: string) => void;
  onRefresh: () => void;
  onRequestElevation?: () => void;
}

export function SessionDrawer({
  session,
  isAdmin = false,
  onClose,
  onSendMessage,
  onRefresh,
  onRequestElevation,
}: SessionDrawerProps) {
  const toast = useToast();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [elevating, setElevating] = useState(false);
  const [accessDeniedError, setAccessDeniedError] = useState<string | null>(null);

  if (!session) return null;

  const handleElevate = async () => {
    setElevating(true);
    try {
      if (onRequestElevation) {
        onRequestElevation();
      } else {
        const res = await api.requestElevation();
        toast(res.message || 'تم إرسال طلب رفع الصلاحيات كمسؤول، يرجى الموافقة في نافذة السيرفر.', 'success');
      }
      setAccessDeniedError(null);
    } catch (err: any) {
      toast(err.message || 'فشل طلب الترقية', 'error');
    } finally {
      setElevating(false);
    }
  };

  const handleEnablePolicy = async () => {
    setLoadingAction('enable-policy');
    try {
      const res = await api.enableShadowPolicy();
      if (res.ok) {
        toast('تم تفعيل سياسة RDP Shadowing في الريجستري بنجاح.', 'success');
        setAccessDeniedError(null);
      } else {
        toast(res.error || 'فشل تعديل سياسة الريجستري (يتطلب تشغيل كمسؤول).', 'error');
        if (res.error?.includes('مسؤول') || res.error?.includes('Access Denied')) {
          setAccessDeniedError(res.error);
        }
      }
    } catch (err: any) {
      toast(err.message || 'خطأ', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleShadow = async (mode: 'control' | 'view') => {
    setLoadingAction(`shadow-${mode}`);
    try {
      const res = await api.shadowSession(session.id, mode);
      if (res.ok) {
        toast(mode === 'control' ? 'تم إطلاق نافذة التحكم الكامل بالشاشة.' : 'تم إطلاق نافذة المشاهدة الحية.', 'success');
        setAccessDeniedError(null);
      } else {
        const errMsg = res.error || 'تأكد من صلاحيات المسؤول وتفعيل سياسة RDP Shadowing.';
        toast(errMsg, 'error');
        if (errMsg.includes('Access Denied') || errMsg.includes('مسؤول')) {
          setAccessDeniedError(errMsg);
        }
      }
    } catch (err: any) {
      toast(err.message || 'خطأ في إطلاق المراقبة', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm(`هل أنت متأكد من رغبتك في فصل الجلسة #${session.id} للمستخدم ${session.user}؟\n(ستبقى برامجه تعمل في الخلفية)`)) return;
    setLoadingAction('disconnect');
    try {
      const res = await api.disconnectSession(session.id);
      if (res.ok) {
        toast('تم تحويل الجلسة إلى حالة Disconnected بنجاح.', 'success');
        setAccessDeniedError(null);
        onRefresh();
        onClose();
      } else {
        const errMsg = res.error || 'فشل فصل الجلسة';
        toast(errMsg, 'error');
        if (errMsg.includes('Access Denied') || errMsg.includes('مسؤول') || res.is_access_denied) {
          setAccessDeniedError(errMsg);
        }
      }
    } catch (err: any) {
      toast(err.message || 'خطأ', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleLogoff = async () => {
    if (!confirm(`تحذير: هل أنت متأكد من تسجيل خروج الجلسة #${session.id} للمستخدم ${session.user}؟\n(سيتم إغلاق كافة البرامج المفتوحة)`)) return;
    setLoadingAction('logoff');
    try {
      const res = await api.logoffSession(session.id);
      if (res.ok) {
        toast('تم إغلاق الجلسة وإنهاء برامجها بنجاح.', 'success');
        setAccessDeniedError(null);
        onRefresh();
        onClose();
      } else {
        const errMsg = res.error || 'فشل تسجيل الخروج';
        toast(errMsg, 'error');
        if (errMsg.includes('Access Denied') || errMsg.includes('مسؤول') || res.is_access_denied) {
          setAccessDeniedError(errMsg);
        }
      }
    } catch (err: any) {
      toast(err.message || 'خطأ', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  const handleTrim = async () => {
    setLoadingAction('trim');
    try {
      const res = await api.trimGovernor(session.id);
      toast(`تم استرداد ${res.result?.reclaimed_mb || 0} MB من ذاكرة الجلسة #${session.id}.`, 'success');
      onRefresh();
    } catch (err: any) {
      toast(err.message || 'خطأ', 'error');
    } finally {
      setLoadingAction(null);
    }
  };

  // Safe formatting for RAM
  const displayRam =
    session.ram_formatted && session.ram_formatted !== '—'
      ? session.ram_formatted
      : session.ram_mb && session.ram_mb > 0
      ? session.ram_mb >= 1024
        ? `${(session.ram_mb / 1024).toFixed(2)} GB`
        : `${Math.round(session.ram_mb)} MB`
      : session.ram && session.ram > 0
      ? `${session.ram} GB`
      : 'أقل من 50 MB';

  // Safe process count
  const displayProcs =
    session.processes_count && session.processes_count > 0
      ? session.processes_count
      : session.procs && session.procs > 0
      ? session.procs
      : 1;

  const isActive = session.status === 'Active' || session.state === 'Active';

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: 'rgba(212, 160, 23, 0.12)',
                border: '1.5px solid rgba(212, 160, 23, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 16px rgba(212, 160, 23, 0.2)',
              }}
            >
              <User size={22} color="var(--accent, #d4a017)" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 18, fontWeight: 800, color: '#fcfaf7' }}>
                  جلسة المستخدم: {session.user}
                </span>
                {session.is_current && (
                  <span
                    style={{
                      background: 'var(--accent, #d4a017)',
                      color: '#000',
                      padding: '2px 8px',
                      borderRadius: 9999,
                      fontSize: 10,
                      fontWeight: 800,
                    }}
                  >
                    أنت هنا
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3, #8a8478)', marginTop: 2 }}>
                معرّف الجلسة: #{session.id} · {session.station || 'RDP-Tcp'}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} label="إغلاق">
            <X size={18} />
          </Button>
        </div>

        {/* State and Vitals Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div
            style={{
              padding: 14,
              borderRadius: 'var(--radius-md, 12px)',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(212, 160, 23, 0.16)',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>حالة الجلسة</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 6 }}>
              <span className={`badge ${isActive ? 'badge--success' : 'badge--warning'}`}>
                {isActive ? 'نشطة (Active)' : 'خاملة / مفصولة (Disc)'}
              </span>
            </div>
          </div>

          <div
            style={{
              padding: 14,
              borderRadius: 'var(--radius-md, 12px)',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(212, 160, 23, 0.16)',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>وقت الخمول (Idle)</div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 700,
                marginTop: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: 'var(--text-1)',
              }}
            >
              <Clock size={15} color="var(--accent)" />
              <span>
                {session.idle_time ||
                  (session.idle !== null && session.idle !== undefined
                    ? String(session.idle)
                    : 'متصل حالياً')}
              </span>
            </div>
          </div>

          <div
            style={{
              padding: 14,
              borderRadius: 'var(--radius-md, 12px)',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(212, 160, 23, 0.16)',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>الذاكرة المستخدمة</div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 800,
                marginTop: 6,
                color: 'var(--accent, #d4a017)',
              }}
            >
              <span dir="ltr" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {displayRam}
              </span>
            </div>
          </div>

          <div
            style={{
              padding: 14,
              borderRadius: 'var(--radius-md, 12px)',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(212, 160, 23, 0.16)',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>العمليات المفتوحة</div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 800,
                marginTop: 6,
                color: 'var(--text-1)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Cpu size={15} color="var(--accent)" />
              <span>
                <span dir="ltr" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {displayProcs}
                </span>{' '}
                عملية
              </span>
            </div>
          </div>
        </div>

        {/* Sovereign Privilege / Admin Notice Banner */}
        {!isAdmin && !session.is_current && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              background: 'linear-gradient(135deg, rgba(212, 160, 23, 0.12) 0%, rgba(30, 24, 18, 0.6) 100%)',
              border: '1px solid rgba(212, 160, 23, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <ShieldAlert size={20} color="var(--accent, #d4a017)" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: 12, color: 'var(--text-1)', lineHeight: 1.5 }}>
                يتطلب إنهاء أو فصل جلسات المستخدمين الآخرين تشغيل السيرفر بصلاحيات مسؤول (Run as Admin).
              </div>
            </div>
            <Button
              size="sm"
              variant="primary"
              loading={elevating}
              onClick={handleElevate}
              style={{ whiteSpace: 'nowrap', fontSize: 12, padding: '4px 12px' }}
            >
              ترقية كمسؤول
            </Button>
          </div>
        )}

        {/* Access Denied Direct Banner if encountered */}
        {accessDeniedError && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 12,
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#ef4444', fontWeight: 700, fontSize: 13 }}>
              <AlertTriangle size={16} />
              <span>تم رفض الوصول من نظام ويندوز (Error 5 Access Denied)</span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: '#fca5a5', lineHeight: 1.5 }}>
              رفض نظام Windows Server تنفيذ العملية لأن حساب العملية الحالية يفتقر إلى امتيازات إدارة الجلسات البعيدة (SeDebugPrivilege / SeShutdownPrivilege).
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <Button
                size="sm"
                variant="primary"
                loading={elevating}
                onClick={handleElevate}
                style={{ fontSize: 12 }}
              >
                <ShieldCheck size={14} style={{ marginLeft: 6 }} />
                ترقية السيرفر كمسؤول الآن
              </Button>
            </div>
          </div>
        )}

        {/* Shadowing Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>
            مراقبة الشاشة الحية (Stealth RDP Shadowing):
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Button
              variant="glass"
              loading={loadingAction === 'shadow-control'}
              onClick={() => handleShadow('control')}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <MonitorPlay size={16} color="var(--accent)" />
              <span>تحكم كامل</span>
            </Button>
            <Button
              variant="ghost"
              loading={loadingAction === 'shadow-view'}
              onClick={() => handleShadow('view')}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              <Eye size={16} />
              <span>مشاهدة فقط</span>
            </Button>
          </div>
          <Button
            variant="ghost"
            size="sm"
            loading={loadingAction === 'enable-policy'}
            onClick={handleEnablePolicy}
            style={{ fontSize: 11, color: 'var(--accent)', justifyContent: 'center', marginTop: 2 }}
          >
            تفعيل / تهيئة سياسة RDP Shadowing في نظام ويندوز
          </Button>
        </div>

        {/* Messaging & Governor Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-2)' }}>
            الإجراءات الإدارية:
          </div>

          <Button
            variant="glass"
            onClick={() => onSendMessage(session.id, session.user)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 10 }}
          >
            <MessageSquare size={16} color="var(--accent)" />
            <span>إرسال تنبيه مباشر لشاشة المستخدم</span>
          </Button>

          <Button
            variant="glass"
            loading={loadingAction === 'trim'}
            onClick={handleTrim}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 10 }}
          >
            <Zap size={16} color="var(--accent)" />
            <span>تفريغ الذاكرة الخاملة لهذه الجلسة فوراً</span>
          </Button>

          <Button
            variant="ghost"
            loading={loadingAction === 'disconnect'}
            onClick={handleDisconnect}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 10,
              color: 'var(--partial, #f59e0b)',
            }}
          >
            <Unplug size={16} />
            <span>فصل الجلسة مؤقتاً (Disconnect)</span>
          </Button>

          <Button
            variant="ghost"
            loading={loadingAction === 'logoff'}
            onClick={handleLogoff}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 10,
              color: 'var(--unpaid, #ef4444)',
            }}
          >
            <LogOut size={16} />
            <span>تسجيل خروج إجباري وإغلاق البرامج (Logoff)</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
