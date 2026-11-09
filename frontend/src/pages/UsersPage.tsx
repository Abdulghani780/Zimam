/**
 * ASAAS Server Control v2.5 - Screen RDP
 * حوكمة مستخدمي ويندوز المحليين وصلاحيات سطح المكتب البعيد RDP & IAM
 * Strict implementation of Stitch Prototype RDP
 */

import { useState, useEffect } from 'react';
import { Card, Button, Modal, Field, TextInput, PasswordInput, PasswordStrength, Glass, useToast, TableContainer, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmpty } from '../asaas-ui';
import { api, type LocalUser, type DomainProfile } from '../lib/api';
import {
  Users,
  UserPlus,
  CheckCircle2,
  KeyRound,
  RefreshCw,
} from 'lucide-react';

export function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState<LocalUser[]>([]);
  const [domainProfile, setDomainProfile] = useState<DomainProfile | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionUser, setActionUser] = useState<string | null>(null);

  // Form states
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isRdp, setIsRdp] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const fetchUsers = async () => {
    try {
      const [list, dom] = await Promise.all([
        api.getUsers(),
        api.getDomainProfile().catch(() => null),
      ]);
      setUsers(Array.isArray(list) ? list : (list as any)?.users || []);
      if (dom && dom.domain) {
        setDomainProfile(dom.domain);
      }
    } catch (err: any) {
      toast(err.message || 'فشل جلب المستخدمين', 'error');
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleToggleState = async (user: LocalUser) => {
    setActionUser(user.username);
    try {
      const res = await api.toggleUserState(user.username, !user.enabled);
      if (res.ok) {
        toast(user.enabled ? `تم تعطيل حساب [${user.username}].` : `تم تفعيل حساب [${user.username}].`, 'success');
        fetchUsers();
      } else {
        toast(res.error || 'فشل الإجراء', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ', 'error');
    } finally {
      setActionUser(null);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !newPassword) return;
    setLoading(true);
    try {
      const res = await api.resetUserPassword(selectedUser, newPassword);
      if (res.ok) {
        toast(res.message || `تم تغيير كلمة مرور مستخدم ويندوز [${selectedUser}] بنجاح.`, 'success');
        setPasswordModalOpen(false);
        setNewPassword('');
      } else {
        toast(res.error || 'فشل تغيير كلمة المرور', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ أثناء محاولة تغيير كلمة المرور', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (uname: string) => {
    if (domainProfile?.is_domain_controller) {
      toast('حظر أمني: لا يمكن حذف حسابات محلية عشوائياً على وحدة تحكم النطاق (Domain Controller).', 'error');
      return;
    }
    if (!confirm(`تحذير: هل أنت متأكد من حذف المستخدم [${uname}] نهائياً من نظام ويندوز؟`)) return;
    try {
      const res = await api.deleteUser(uname);
      if (res.ok) {
        toast('تم حذف المستخدم بنجاح', 'success');
        fetchUsers();
      } else {
        toast(res.error || 'فشل الحذف', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ', 'error');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.createUser({
        username,
        password,
        full_name: fullName,
        is_rdp: isRdp,
        is_admin: isAdmin,
      });
      if (res.ok) {
        toast(`تم إنشاء حساب [${username}] وإضافته لمجموعات ويندوز المطلوبة.`, 'success');
        setModalOpen(false);
        setUsername('');
        setPassword('');
        setFullName('');
        fetchUsers();
      } else {
        toast(res.error || 'فشل إنشاء المستخدم', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 1. Sovereign IAM Header (Stitch RDP Top) */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(20, 19, 21, 0.95) 0%, rgba(14, 14, 16, 0.98) 100%)',
          border: '1px solid rgba(212, 160, 23, 0.22)',
          boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
          padding: '24px 28px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 12px',
                  borderRadius: 9999,
                  background: 'rgba(34, 197, 94, 0.12)',
                  color: '#22c55e',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <CheckCircle2 size={13} />
                حوكمة الهوية وإدارة الوصول المميز IAM
              </span>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: 9999,
                  background: 'rgba(212, 160, 23, 0.12)',
                  color: 'var(--accent)',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {domainProfile?.is_domain_joined ? `Active Directory: ${domainProfile.domain_name}` : 'Windows Workgroup / SAM'}
              </span>
            </div>

            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>
              حوكمة مستخدمي ويندوز المحليين وصلاحيات سطح المكتب البعيد RDP &amp; IAM
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0, maxWidth: 840, lineHeight: 1.6 }}>
              إدارة شاملة لحسابات ويندوز (SAM / Active Directory)، تعيين صلاحيات الدخول عن بعد (Remote Desktop Users)،
              وفرض سياسات تصليب كلمات المرور ومكافحة تصعيد الامتيازات.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Button
              size="sm"
              variant="glass"
              onClick={fetchUsers}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={13} />
              <span>مزامنة SAM</span>
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <UserPlus size={14} />
              <span>إضافة مستخدم جديد</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Security & Policy Cards (Stitch RDP H2) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
        <Glass style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
              سياسات أمان الحسابات وتصليب كلمات المرور
            </h4>
            <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}>مفعلة Enforced</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
            فرض طول 12+ رمز، حظر كلمات المرور الشائعة، قفل الحساب التلقائي بعد 5 محاولات خاطئة لمنع هجمات التخمين.
          </p>
        </Glass>

        <Glass style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
              جلسات RDP والحصة المتزامنة
            </h4>
            <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>غير محدودة Unlimited</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
            دعم اتصالات متعددة متزامنة مع عزل مساحة الذاكرة لكل جلسة مستخدم وضبط استهلاك البرامج الخاملة.
          </p>
        </Glass>

        <Glass style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
              بيئة تشغيل السيرفر
            </h4>
            <span style={{ fontSize: 11, color: '#38bdf8', fontWeight: 700 }}>
              {domainProfile?.is_domain_controller ? 'Domain Controller' : 'Sovereign Standalone Host'}
            </span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
            كافة العمليات المحلية تخضع لرقابة النواة المشددة وتوثق بصمتها في سجل الامتثال الجنائي.
          </p>
        </Glass>
      </div>

      {/* 3. Windows Local Users Directory Table (Stitch RDP H2) */}
      <Card
        title="دليل حسابات السيرفر المحلي (Windows Local Users Directory)"
        icon="users"
        actions={
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            إجمالي الحسابات: {users.length} مستخدم
          </span>
        }
      >
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>اسم الحساب (Username)</TableHead>
                <TableHead>الاسم الكامل والوصف</TableHead>
                <TableHead>حالة الحساب</TableHead>
                <TableHead>صلاحية RDP</TableHead>
                <TableHead>دور الحساب</TableHead>
                <TableHead style={{ textAlign: 'end' }}>إجراءات الحوكمة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableEmpty colSpan={6} message="لا يوجد مستخدمين مسجلين في السيرفر حالياً." />
              ) : (
                users.map((u) => (
                  <TableRow key={u.username}>
                    <TableCell className="font-bold text-title">
                      <div className="flex items-center gap-2">
                        <Users size={15} className="text-primary" />
                        <span>{u.username}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted">
                      {u.full_name || u.description || 'حساب مستخدم محلي'}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold ${
                          u.enabled
                            ? 'bg-status-safe-surface text-status-safe'
                            : 'bg-status-danger-surface text-status-danger'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${u.enabled ? 'bg-status-safe' : 'bg-status-danger'}`} />
                        {u.enabled ? 'نشط Active' : 'معطّل Disabled'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-xs font-bold ${
                          u.is_rdp ? 'text-primary' : 'text-muted'
                        }`}
                      >
                        {u.is_rdp ? 'مفعّل (Remote Desktop)' : 'معطّل'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-bold ${
                          u.is_admin
                            ? 'bg-primary/20 text-primary border border-border-gold-rim'
                            : 'bg-surface-glass-tint text-muted'
                        }`}
                      >
                        {u.is_admin ? 'مدير نظام (Admin)' : 'مستخدم قياسي (User)'}
                      </span>
                    </TableCell>
                    <TableCell style={{ textAlign: 'end' }}>
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedUser(u.username);
                            setNewPassword('');
                            setPasswordModalOpen(true);
                          }}
                          className="text-xs px-2 text-primary"
                        >
                          <KeyRound size={13} className="ml-1" />
                          كلمة المرور
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={actionUser === u.username}
                          onClick={() => handleToggleState(u)}
                          className="text-xs px-2"
                        >
                          {u.enabled ? 'تعطيل' : 'تفعيل'}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDelete(u.username)}
                          className="text-xs px-2"
                        >
                          حذف
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Modal: Change Password */}
      {passwordModalOpen && (
        <Modal onClose={() => setPasswordModalOpen(false)} title={`تغيير كلمة المرور للمستخدم: ${selectedUser}`}>
          <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="كلمة المرور الجديدة (New Password)">
              {(id) => (
                <PasswordInput
                  id={id}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="أدخل كلمة مرور قوية (12+ رمز)..."
                  required
                />
              )}
            </Field>
            <PasswordStrength password={newPassword} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Button type="button" variant="ghost" onClick={() => setPasswordModalOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" variant="primary" loading={loading}>
                تحديث كلمة المرور
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Create User (Stitch RDP H2) */}
      {modalOpen && (
        <Modal onClose={() => setModalOpen(false)} title="إضافة مستخدم ويندوز محلي جديد">
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="اسم الحساب بالإنجليزية (Username)">
              {(id) => (
                <TextInput
                  id={id}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="مثال: khalid.ops"
                  required
                />
              )}
            </Field>

            <Field label="الاسم الكامل أو الوصف (Full Name / Description)">
              {(id) => (
                <TextInput
                  id={id}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثال: خالد محمد - فريق الدعم الفني"
                />
              )}
            </Field>

            <Field label="كلمة المرور (Password)">
              {(id) => (
                <PasswordInput
                  id={id}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="كلمة مرور مؤمنة..."
                  required
                />
              )}
            </Field>
            <PasswordStrength password={password} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={isRdp}
                  onChange={(e) => setIsRdp(e.target.checked)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                <span>منح إذن تسجيل الدخول عن بعد (Remote Desktop Users)</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={isAdmin}
                  onChange={(e) => setIsAdmin(e.target.checked)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                <span>منح صلاحيات مدير نظام كامل (Administrators Group)</span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" variant="primary" loading={loading}>
                إنشاء الحساب
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
