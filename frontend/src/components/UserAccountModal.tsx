import { useState } from 'react';
import { Modal, Button, Field, TextInput, PasswordInput, useToast } from '../asaas-ui';
import { api, type AppUser } from '../lib/api';
import { User, LogIn, LogOut } from 'lucide-react';

interface UserAccountModalProps {
  open: boolean;
  onClose: () => void;
  currentUser: AppUser | null;
  onUserChanged: (user: AppUser | null) => void;
}

export function UserAccountModal({ open, onClose, currentUser, onUserChanged }: UserAccountModalProps) {
  const toast = useToast();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin@asaas2026');
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const handleLogin = async (e?: React.FormEvent, customUser?: string, customPass?: string) => {
    if (e) e.preventDefault();
    const u = customUser || username;
    const p = customPass || password;

    setLoading(true);
    try {
      const res = await api.login(u, p);
      if (res.ok) {
        toast(`تم تسجيل الدخول بنجاح كـ ${res.user.full_name} (${res.user.role}).`, 'success');
        onUserChanged(res.user);
        onClose();
      } else {
        toast('فشل تسجيل الدخول: بيانات الاعتماد غير صحيحة.', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ أثناء تسجيل الدخول', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSwitch = (role: 'admin' | 'operator' | 'viewer') => {
    const creds = {
      admin: { u: 'admin', p: 'admin@asaas2026' },
      operator: { u: 'operator', p: 'operator@asaas2026' },
      viewer: { u: 'viewer', p: 'viewer@asaas2026' },
    }[role];
    handleLogin(undefined, creds.u, creds.p);
  };

  const handleLogout = async () => {
    await api.logout();
    toast('تم تسجيل الخروج بنجاح.', 'success');
    onUserChanged(null);
  };

  return (
    <Modal
      title="إدارة الحسابات وصلاحيات الوصول (Multi-User RBAC)"
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
                background: currentUser?.role === 'admin' ? 'rgba(34, 197, 94, 0.15)' : currentUser?.role === 'operator' ? 'rgba(212, 160, 23, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                border: `1px solid ${currentUser?.role === 'admin' ? '#22c55e' : currentUser?.role === 'operator' ? 'var(--accent)' : '#3b82f6'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: currentUser?.role === 'admin' ? '#22c55e' : currentUser?.role === 'operator' ? 'var(--accent)' : '#3b82f6',
              }}
            >
              <User size={22} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-1)' }}>
                {currentUser?.full_name || 'حساب غير محدد'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span>اسم المستخدم: <strong style={{ color: 'var(--text-2)' }}>{currentUser?.username || '—'}</strong></span>
                <span>•</span>
                <span style={{ color: currentUser?.role === 'admin' ? '#22c55e' : currentUser?.role === 'operator' ? 'var(--accent)' : '#3b82f6', fontWeight: 600 }}>
                  {currentUser?.role === 'admin' ? 'مدير نظام كامل الصلاحيات' : currentUser?.role === 'operator' ? 'مشغل عمليات' : 'مراجع للقراءة فقط'}
                </span>
              </div>
            </div>
          </div>

          {currentUser && (
            <Button size="sm" variant="ghost" onClick={handleLogout} style={{ color: 'var(--danger)' }}>
              <LogOut size={14} />
              <span>خروج</span>
            </Button>
          )}
        </div>

        {/* Quick Role Switcher for Testing (Story 1 verification) */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8 }}>
            التبديل السريع بين الأدوار لاختبار صلاحيات RBAC:
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <Button
              size="sm"
              variant={currentUser?.role === 'admin' ? 'primary' : 'ghost'}
              onClick={() => handleQuickSwitch('admin')}
              disabled={loading}
              style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 6px', height: 'auto' }}
            >
              <span style={{ fontWeight: 700 }}>Admin (مدير)</span>
              <span style={{ fontSize: 10, opacity: 0.8 }}>صلاحيات كاملة</span>
            </Button>

            <Button
              size="sm"
              variant={currentUser?.role === 'operator' ? 'primary' : 'ghost'}
              onClick={() => handleQuickSwitch('operator')}
              disabled={loading}
              style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 6px', height: 'auto' }}
            >
              <span style={{ fontWeight: 700 }}>Operator (مشغل)</span>
              <span style={{ fontSize: 10, opacity: 0.8 }}>تحكم تشغيلي</span>
            </Button>

            <Button
              size="sm"
              variant={currentUser?.role === 'viewer' ? 'primary' : 'ghost'}
              onClick={() => handleQuickSwitch('viewer')}
              disabled={loading}
              style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '10px 6px', height: 'auto' }}
            >
              <span style={{ fontWeight: 700 }}>Viewer (مشاهدة)</span>
              <span style={{ fontSize: 10, opacity: 0.8 }}>قراءة فقط (403)</span>
            </Button>
          </div>
        </div>

        {/* Direct Login Form */}
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="اسم المستخدم">
            {(id) => (
              <TextInput
                id={id}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin / operator / viewer"
                required
              />
            )}
          </Field>

          <Field label="كلمة المرور">
            {(id) => (
              <PasswordInput
                id={id}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                required
              />
            )}
          </Field>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <Button type="button" variant="ghost" onClick={onClose}>
              إلغاء
            </Button>
            <Button type="submit" variant="primary" loading={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <LogIn size={15} />
              <span>تسجيل الدخول</span>
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
