import { useEffect, useState } from 'react';
import { Modal, Button, Field, TextInput, PasswordInput, useToast } from '../asaas-ui';
import { api, type AppUser } from '../lib/api';
import { apiV1 } from '../lib/apiV1';
import { User, LogIn, LogOut } from 'lucide-react';
import { t } from '../lib/i18n';

interface UserAccountModalProps {
  open: boolean;
  onClose: () => void;
  currentUser: AppUser | null;
  onUserChanged: (user: AppUser | null) => void;
}

export function UserAccountModal({ open, onClose, currentUser, onUserChanged }: UserAccountModalProps) {
  const toast = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaUri, setMfaUri] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);

  useEffect(() => {
    if (!open || !currentUser) return;
    apiV1.me().then((user) => setMfaEnabled(Boolean(user.mfa_enabled))).catch((err) => {
      toast(err.message || t('تعذر تحميل حالة المصادقة الثنائية'), 'error');
    });
  }, [open, currentUser, toast]);

  if (!open) return null;

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    setLoading(true);
    try {
      const res = await api.login(username, password);
      if (res.ok) {
        toast(`${t('تم تسجيل الدخول بنجاح كـ ')}${res.user.full_name} (${res.user.role}).`, 'success');
        onUserChanged(res.user);
        onClose();
      } else {
        toast(t('فشل تسجيل الدخول: بيانات الاعتماد غير صحيحة.'), 'error');
      }
    } catch (err: any) {
      toast(err.message || t('خطأ أثناء تسجيل الدخول'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
      toast(t('تم تسجيل الخروج بنجاح.'), 'success');
      onUserChanged(null);
    } catch (err: any) {
      toast(err.message || t('فشل تسجيل الخروج'), 'error');
    }
  };

  const setupMfa = async () => {
    setMfaBusy(true);
    try {
      const res = await apiV1.mfaSetup();
      setMfaSecret(res.secret || '');
      setMfaUri(res.otpauth_uri || '');
      setMfaCode('');
    } catch (err: any) {
      toast(err.message || t('فشل بدء إعداد المصادقة الثنائية'), 'error');
    } finally {
      setMfaBusy(false);
    }
  };

  const verifyMfa = async () => {
    if (!mfaCode.trim()) return;
    setMfaBusy(true);
    try {
      await apiV1.mfaVerify(mfaCode.trim());
      setMfaEnabled(true);
      setMfaSecret('');
      setMfaUri('');
      setMfaCode('');
      toast(t('تم تفعيل المصادقة الثنائية بعد التحقق من الرمز.'), 'success');
    } catch (err: any) {
      toast(err.message || t('رمز المصادقة غير صالح'), 'error');
    } finally {
      setMfaBusy(false);
    }
  };

  return (
    <Modal
      title={t('إدارة الحسابات وصلاحيات الوصول (Multi-User RBAC)')}
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Current User Status Banner */}
        <div
          style={{
            padding: 16,
            borderRadius: 'var(--radius-md)',
            background: 'var(--glass-tint)',
            border: '1px solid var(--hairline)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                background: currentUser?.role === 'admin' ? 'var(--paid-bg)' : currentUser?.role === 'operator' ? 'var(--accent-soft)' : 'var(--status-info-surface)',
                border: `1px solid ${currentUser?.role === 'admin' ? 'var(--paid)' : currentUser?.role === 'operator' ? 'var(--accent)' : 'var(--chart-out)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: currentUser?.role === 'admin' ? 'var(--paid)' : currentUser?.role === 'operator' ? 'var(--accent)' : 'var(--chart-out)',
              }}
            >
              <User size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>
                {currentUser?.full_name || t('حساب غير محدد')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span>{t('اسم المستخدم:')} <strong style={{ color: 'var(--text-2)' }}>{currentUser?.username || '—'}</strong></span>
                <span>•</span>
                <span style={{ color: currentUser?.role === 'admin' ? 'var(--paid)' : currentUser?.role === 'operator' ? 'var(--accent)' : 'var(--chart-out)', fontWeight: 600 }}>
                  {currentUser?.role === 'admin' ? t('مدير نظام كامل الصلاحيات') : currentUser?.role === 'operator' ? t('مشغل عمليات') : t('مراجع للقراءة فقط')}
                </span>
              </div>
            </div>
          </div>

          {currentUser && (
            <Button size="sm" variant="ghost" onClick={handleLogout} style={{ color: 'var(--danger)' }}>
              <LogOut size={14} />
              <span>{t('خروج')}</span>
            </Button>
          )}
        </div>

        {currentUser && (
          <div style={{ padding: 16, borderRadius: 'var(--radius-md)', background: 'var(--glass-inset)', display: 'flex', flexDirection: 'column', gap: 12 }}>
            <strong>{t('المصادقة الثنائية (MFA)')}</strong>
            {mfaEnabled ? (
              <span style={{ color: 'var(--paid)' }}>{t('المصادقة الثنائية مفعّلة لهذا الحساب.')}</span>
            ) : mfaSecret ? (
              <>
                <p style={{ margin: 0, color: 'var(--text-2)' }}>{t('أضف الرمز التالي إلى تطبيق المصادقة، ثم أدخل رمز OTP لتأكيد التفعيل.')}</p>
                <code dir="ltr" style={{ userSelect: 'all', wordBreak: 'break-all' }}>{mfaSecret}</code>
                {mfaUri && <code dir="ltr" style={{ userSelect: 'all', wordBreak: 'break-all', fontSize: 11 }}>{mfaUri}</code>}
                <Field label={t('رمز OTP')}>
                  {(id) => <TextInput id={id} value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" dir="ltr" />}
                </Field>
                <Button variant="primary" onClick={() => void verifyMfa()} loading={mfaBusy} disabled={!mfaCode.trim()}>{t('تحقق وفعّل MFA')}</Button>
              </>
            ) : (
              <Button variant="secondary" onClick={() => void setupMfa()} loading={mfaBusy}>{t('إعداد المصادقة الثنائية')}</Button>
            )}
          </div>
        )}

        {/* Direct Login Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label={t('اسم المستخدم')}>
            {(id) => (
              <TextInput
                id={id}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={t('اسم المستخدم المسجل في المنصة')}
                autoComplete="username"
                required
              />
            )}
          </Field>

          <Field label={t('كلمة المرور')}>
            {(id) => (
              <PasswordInput
                id={id}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                autoComplete="current-password"
                required
              />
            )}
          </Field>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <Button type="button" variant="ghost" onClick={onClose}>
              {t('إلغاء')}
            </Button>
            <Button type="submit" variant="primary" loading={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <LogIn size={15} />
              <span>{t('تسجيل الدخول')}</span>
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
