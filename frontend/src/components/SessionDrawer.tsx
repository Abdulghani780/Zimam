import { useState } from 'react';
import { Button, useToast } from '../asaas-ui';
import { api, type UserSession } from '../lib/api';
import { Eye, MonitorPlay, MessageSquare, Unplug, LogOut, Zap, X, User, Clock } from 'lucide-react';

interface SessionDrawerProps {
  session: UserSession | null;
  onClose: () => void;
  onSendMessage: (sid: number, user: string) => void;
  onRefresh: () => void;
}

export function SessionDrawer({
  session,
  onClose,
  onSendMessage,
  onRefresh,
}: SessionDrawerProps) {
  const toast = useToast();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  if (!session) return null;

    const handleEnablePolicy = async () => {
    setLoadingAction('enable-policy');
    try {
      const res = await api.enableShadowPolicy();
      if (res.ok) {
        toast('تم تفعيل سياسة RDP Shadowing في الريجستري بنجاح.', 'success');
      } else {
        toast(res.error || 'فشل تعديل سياسة الريجستري (يتطلب تشغيل كمسؤول).', 'error');
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
      } else {
        toast(res.error || 'تأكد من صلاحيات المسؤول وتفعيل سياسة RDP Shadowing.', 'error');
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
        onRefresh();
        onClose();
      } else {
        toast(res.error || 'فشل فصل الجلسة', 'error');
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
        onRefresh();
        onClose();
      } else {
        toast(res.error || 'فشل تسجيل الخروج', 'error');
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

  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <div className="drawer" onClick={(e) => e.stopPropagation()}>
        {/* Drawer Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ padding: 8, borderRadius: 'var(--radius-sm)', background: 'var(--glass-inset)' }}>
              <User size={20} color="var(--accent)" />
            </div>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>
                جلسة المستخدم: {session.user}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                معرّف الجلسة: #{session.id} · {session.station || 'RDP-Tcp'}
              </div>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} label="إغلاق">
            <X size={16} />
          </Button>
        </div>

        {/* State and Vitals */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--glass-inset)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>حالة الجلسة</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>
              <span className={`badge ${session.status === 'Active' ? 'badge--success' : 'badge--warning'}`}>
                {session.status === 'Active' ? 'نشطة (Active)' : 'خاملة / مفصولة'}
              </span>
            </div>
          </div>

          <div style={{ padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--glass-inset)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>وقت الخمول (Idle)</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={15} color="var(--accent)" />
              <span>{session.idle_time || (session.idle !== null && session.idle !== undefined ? String(session.idle) : 'متصل حالياً')}</span>
            </div>
          </div>

          <div style={{ padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--glass-inset)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>الذاكرة المستخدمة</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4, color: 'var(--accent)', fontFamily: 'var(--font)' }}>
              <span dir="ltr">{session.ram_formatted || (session.ram_mb ? (session.ram_mb >= 1024 ? `${(session.ram_mb / 1024).toFixed(2)} GB` : `${Math.round(session.ram_mb)} MB`) : session.ram ? `${session.ram} GB` : 'أقل من 0.1 GB')}</span>
            </div>
          </div>

          <div style={{ padding: 14, borderRadius: 'var(--radius-md)', background: 'var(--glass-inset)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 600 }}>العمليات المفتوحة</div>
            <div style={{ fontSize: 16, fontWeight: 700, marginTop: 4, fontFamily: 'var(--font)' }}>
              <span dir="ltr">{session.processes_count || session.procs || 0}</span> عملية
            </div>
          </div>
        </div>

        {/* Shadowing Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
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
              <MonitorPlay size={16} />
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
              style={{ fontSize: 11, color: 'var(--accent)', justifyContent: 'center', marginTop: 4 }}
            >
              تفعيل / تهيئة سياسة RDP Shadowing في نظام ويندوز
            </Button>
        </div>

        {/* Messaging & Governor Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
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
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 10, color: 'var(--partial)' }}
          >
            <Unplug size={16} />
            <span>فصل الجلسة مؤقتاً (Disconnect)</span>
          </Button>

          <Button
            variant="ghost"
            loading={loadingAction === 'logoff'}
            onClick={handleLogoff}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 10, color: 'var(--unpaid)' }}
          >
            <LogOut size={16} />
            <span>تسجيل خروج إجباري وإغلاق البرامج (Logoff)</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
