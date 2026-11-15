/**
 * ASAAS Server Control v2.5 - Screen RDP
 * حوكمة مستخدمي ويندوز المحليين وصلاحيات سطح المكتب البعيد RDP & IAM
 * Strict implementation of Stitch Prototype RDP
 */

import { useState, useEffect } from 'react';
import { Card, Button, Modal, Field, TextInput, PasswordInput, PasswordStrength, Glass, Select, useToast, TableContainer, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmpty } from '../asaas-ui';
import { api, type LocalUser, type DomainProfile, type AppUser } from '../lib/api';
import { apiV1, type V1User } from '../lib/apiV1';
import {
  Users,
  UserPlus,
  CheckCircle2,
  KeyRound,
  RefreshCw,
  UserCog,
  Trash2,
  ShieldCheck,
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

  // ASAAS application-user management — now served by /api/v1 (identity authority).
  const [appUsers, setAppUsers] = useState<V1User[]>([]);
  const [appUsersLoading, setAppUsersLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [appModalOpen, setAppModalOpen] = useState(false);
  const [appUsername, setAppUsername] = useState('');
  const [appPassword, setAppPassword] = useState('');
  const [appFullName, setAppFullName] = useState('');
  const [appRole, setAppRole] = useState<'admin' | 'operator' | 'viewer'>('viewer');
  const [appSubmitting, setAppSubmitting] = useState(false);
  const [appActionUser, setAppActionUser] = useState<string | null>(null);

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

  const fetchAppUsers = async () => {
    setAppUsersLoading(true);
    try {
      const res = await apiV1.users();
      const list = Array.isArray(res) ? res : (res as { users?: V1User[] })?.users || [];
      setAppUsers(list);
    } catch {
      // The endpoint requires an authenticated session; non-admin operators
      // simply see the read-only notice instead of a noisy toast.
    } finally {
      setAppUsersLoading(false);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const res = await api.getCurrentUser();
      if (res?.ok && res.user) setCurrentUser(res.user);
    } catch {
      // ignore; role-based controls remain hidden until identity resolves
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchAppUsers();
    fetchCurrentUser();
  }, []);

  const canManageAppUsers = currentUser?.role === 'admin';

  const handleCreateAppUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setAppSubmitting(true);
    try {
      await apiV1.createUser({
        username: appUsername.trim(),
        password: appPassword,
        role: appRole,
        full_name: appFullName.trim(),
      });
      toast(`تم إنشاء حساب مشغل النظام [${appUsername}] بدور ${appRole}.`, 'success');
      setAppModalOpen(false);
      setAppUsername('');
      setAppPassword('');
      setAppFullName('');
      setAppRole('viewer');
      fetchAppUsers();
    } catch (err: any) {
      toast(err.message || 'فشل إنشاء حساب المشغل', 'error');
    } finally {
      setAppSubmitting(false);
    }
  };

  const handleAppRoleChange = async (user: AppUser, role: string) => {
    if (role === user.role) return;
    if (!confirm(`تغيير دور الحساب [${user.username}] إلى (${role})؟`)) {
      fetchAppUsers();
      return;
    }
    setAppActionUser(user.username);
    try {
      await apiV1.updateUserRole(user.username, role);
      toast(`تم تحديث دور الحساب [${user.username}] إلى (${role}).`, 'success');
      fetchAppUsers();
    } catch (err: any) {
      toast(err.message || 'فشل تحديث الدور', 'error');
    } finally {
      setAppActionUser(null);
    }
  };

  const handleDeleteAppUser = async (user: V1User) => {
    if (user.username.toLowerCase() === 'admin') {
      toast('لا يمكن تعطيل الحساب الجذري admin.', 'error');
      return;
    }
    if (currentUser?.username?.toLowerCase() === user.username.toLowerCase()) {
      toast('لا يمكنك تعطيل الحساب الذي تستخدمه حالياً.', 'error');
      return;
    }
    if (!confirm(`تعطيل حساب مشغل النظام [${user.username}]؟ سيتم إنهاء جلساته فوراً.`)) return;
    setAppActionUser(user.username);
    try {
      await apiV1.updateUserStatus(user.username, false);
      toast(`تم تعطيل حساب المشغل [${user.username}] وإنهاء جلساته.`, 'success');
      fetchAppUsers();
    } catch (err: any) {
      toast(err.message || 'فشل تعطيل الحساب', 'error');
    } finally {
      setAppActionUser(null);
    }
  };

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
    <div className="page">
      {/* Product page header */}
      <div className="page-hero"
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 16,
          background: 'linear-gradient(135deg, var(--glass-tint-strong) 0%, var(--surface-ground) 100%)',
          border: '1px solid var(--accent-soft)',
          boxShadow: '0 12px 32px var(--shadow-soft)',
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
                  background: 'var(--paid-bg)',
                  color: 'var(--paid)',
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
                  background: 'var(--accent-soft)',
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
            <span style={{ fontSize: 11, color: 'var(--paid)', fontWeight: 700 }}>مفعلة Enforced</span>
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
            <span style={{ fontSize: 11, color: 'var(--chart-out)', fontWeight: 700 }}>
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
          <Table style={{ width: "100%", tableLayout: "fixed" }}>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: '17%', textAlign: 'start' }}>اسم الحساب (Username)</TableHead>
                <TableHead style={{ width: '20%', textAlign: 'start' }}>الاسم الكامل والوصف</TableHead>
                <TableHead style={{ width: '12%', textAlign: 'start' }}>حالة الحساب</TableHead>
                <TableHead style={{ width: '14%', textAlign: 'start' }}>صلاحية RDP</TableHead>
                <TableHead style={{ width: '13%', textAlign: 'start' }}>دور الحساب</TableHead>
                <TableHead style={{ width: '24%', textAlign: 'end' }}>إجراءات الحوكمة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableEmpty colSpan={6} message="لا يوجد مستخدمين مسجلين في السيرفر حالياً." />
              ) : (
                users.map((u) => (
                  <TableRow key={u.username}>
                    <TableCell style={{ width: '17%' }} className="font-bold text-title">
                      <div className="flex items-center gap-2">
                        <Users size={15} className="text-primary" />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.username}</span>
                      </div>
                    </TableCell>
                    <TableCell style={{ width: '20%' }} className="text-xs text-muted">
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                        {u.full_name || u.description || 'حساب مستخدم محلي'}
                      </span>
                    </TableCell>
                    <TableCell style={{ width: '12%' }}>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold ${
                          u.enabled
                            ? 'bg-status-safe-surface text-status-safe'
                            : 'bg-status-danger-surface text-status-danger'
                        }`}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${u.enabled ? 'bg-status-safe' : 'bg-status-danger'}`} />
                        {u.enabled ? 'نشط Active' : 'معطّل Disabled'}
                      </span>
                    </TableCell>
                    <TableCell style={{ width: '14%' }}>
                      <span
                        className={`text-xs font-bold ${
                          u.is_rdp ? 'text-primary' : 'text-muted'
                        }`}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        {u.is_rdp ? 'مفعّل (RDP)' : 'معطّل'}
                      </span>
                    </TableCell>
                    <TableCell style={{ width: '13%' }}>
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-bold ${
                          u.is_admin
                            ? 'bg-primary/20 text-primary border border-border-gold-rim'
                            : 'bg-surface-glass-tint text-muted'
                        }`}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        {u.is_admin ? 'مدير نظام (Admin)' : 'مستخدم قياسي (User)'}
                      </span>
                    </TableCell>
                    <TableCell style={{ width: '24%', textAlign: 'end' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setSelectedUser(u.username);
                            setNewPassword('');
                            setPasswordModalOpen(true);
                          }}
                          style={{ fontSize: 11, padding: '3px 8px', whiteSpace: 'nowrap' }}
                          className="text-primary"
                        >
                          <KeyRound size={12} style={{ marginInlineEnd: 4 }} />
                          كلمة المرور
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={actionUser === u.username}
                          onClick={() => handleToggleState(u)}
                          style={{ fontSize: 11, padding: '3px 8px', whiteSpace: 'nowrap' }}
                        >
                          {u.enabled ? 'تعطيل' : 'تفعيل'}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDelete(u.username)}
                          style={{ fontSize: 11, padding: '3px 8px', whiteSpace: 'nowrap' }}
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

      {/* 4. ASAAS Application Users (operators of the console itself) */}
      <Card
        title="حسابات مشغلي النظام (ASAAS App Users)"
        icon="users"
        actions={
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
              إجمالي الحسابات: {appUsers.length} حساب
            </span>
            <Button
              size="sm"
              variant="glass"
              onClick={fetchAppUsers}
              loading={appUsersLoading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <RefreshCw size={12} />
              <span>تحديث</span>
            </Button>
            {canManageAppUsers && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => setAppModalOpen(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <UserCog size={13} />
                <span>إضافة حساب مشغل</span>
              </Button>
            )}
          </div>
        }
      >
        {!canManageAppUsers && currentUser && (
          <div
            style={{
              marginBottom: 12,
              padding: '10px 12px',
              borderRadius: 8,
              background: 'var(--partial-bg)',
              color: 'var(--partial)',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            إدارة حسابات مشغلي النظام مقيدة بمدير النظام (Admin). يمكنك مراجعة بيانات حسابك فقط.
          </div>
        )}

        <TableContainer>
          <Table style={{ width: '100%', tableLayout: 'fixed' }}>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: '18%', textAlign: 'start' }}>اسم المستخدم</TableHead>
                <TableHead style={{ width: '20%', textAlign: 'start' }}>الاسم الكامل</TableHead>
                <TableHead style={{ width: '19%', textAlign: 'start' }}>الدور والصلاحية</TableHead>
                <TableHead style={{ width: '12%', textAlign: 'start' }}>حالة الحساب</TableHead>
                <TableHead style={{ width: '19%', textAlign: 'start' }}>المصادقة الثنائية</TableHead>
                <TableHead style={{ width: '12%', textAlign: 'end' }}>إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appUsers.length === 0 ? (
                <TableEmpty
                  colSpan={6}
                  message={appUsersLoading ? 'جارٍ تحميل حسابات المشغلين...' : 'لا توجد حسابات مشغلين مسجلة حالياً.'}
                />
              ) : (
                appUsers.map((u) => {
                  const isSelf = currentUser?.username?.toLowerCase() === u.username.toLowerCase();
                  const isRoot = u.username.toLowerCase() === 'admin';
                  return (
                    <TableRow key={u.id}>
                      <TableCell style={{ width: '18%' }} className="font-bold text-title">
                        <div className="flex items-center gap-2">
                          <UserCog size={15} className="text-primary" />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {u.username}
                            {isSelf && (
                              <span style={{ marginInlineStart: 6, fontSize: 10, color: 'var(--accent)' }}>(أنت)</span>
                            )}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell style={{ width: '20%' }} className="text-xs text-muted">
                        <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.full_name || '—'}
                        </span>
                      </TableCell>
                      <TableCell style={{ width: '19%' }}>
                        {canManageAppUsers && !isRoot ? (
                          <select
                            value={u.role}
                            disabled={appActionUser === u.username}
                            onChange={(e) => handleAppRoleChange(u, e.target.value)}
                            className="text-input"
                            style={{ width: '100%', fontSize: 12, padding: '5px 8px' }}
                            aria-label={`دور الحساب ${u.username}`}
                          >
                            <option value="admin">مدير النظام (Admin)</option>
                            <option value="operator">مشغل (Operator)</option>
                            <option value="viewer">مشاهد (Viewer)</option>
                          </select>
                        ) : (
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-bold ${
                              u.role === 'admin'
                                ? 'bg-primary/20 text-primary border border-border-gold-rim'
                                : 'bg-surface-glass-tint text-muted'
                            }`}
                            style={{ whiteSpace: 'nowrap' }}
                          >
                            {u.role === 'admin' ? 'مدير النظام (Admin)' : u.role === 'operator' ? 'مشغل (Operator)' : 'مشاهد (Viewer)'}
                          </span>
                        )}
                      </TableCell>
                      <TableCell style={{ width: '12%' }}>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-bold ${
                            u.is_active
                              ? 'bg-status-safe-surface text-status-safe'
                              : 'bg-status-danger-surface text-status-danger'
                          }`}
                          style={{ whiteSpace: 'nowrap' }}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-status-safe' : 'bg-status-danger'}`} />
                          {u.is_active ? 'نشط Active' : 'معطّل Disabled'}
                        </span>
                      </TableCell>
                      <TableCell style={{ width: '19%' }} className="text-xs text-muted">
                        <span style={{ whiteSpace: 'nowrap' }}>
                          {u.mfa_enabled ? 'MFA مفعّل' : '—'}
                        </span>
                      </TableCell>
                      <TableCell style={{ width: '12%', textAlign: 'end' }}>
                        {canManageAppUsers ? (
                          u.is_active ? (
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={isRoot || isSelf || appActionUser === u.username}
                              onClick={() => handleDeleteAppUser(u)}
                              style={{ fontSize: 11, padding: '3px 8px', whiteSpace: 'nowrap' }}
                              title={isRoot ? 'الحساب الجذري محمي من التعطيل' : 'تعطيل حساب المشغل وإنهاء جلساته'}
                            >
                              <Trash2 size={12} style={{ marginInlineEnd: 4 }} />
                              تعطيل
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="glass"
                              disabled={appActionUser === u.username}
                              onClick={async () => {
                                setAppActionUser(u.username);
                                try {
                                  await apiV1.updateUserStatus(u.username, true);
                                  toast(`تم تفعيل حساب المشغل [${u.username}].`, 'success');
                                  fetchAppUsers();
                                } catch (err: any) {
                                  toast(err.message || 'فشل تفعيل الحساب', 'error');
                                } finally {
                                  setAppActionUser(null);
                                }
                              }}
                              style={{ fontSize: 11, padding: '3px 8px', whiteSpace: 'nowrap' }}
                            >
                              تفعيل
                            </Button>
                          )
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                            <ShieldCheck size={12} style={{ marginInlineEnd: 4 }} />
                            مقيد
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
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
      {/* Modal: Create ASAAS App User */}
      {appModalOpen && (
        <Modal onClose={() => setAppModalOpen(false)} title="إضافة حساب مشغل جديد لمنصة ASAAS">
          <form onSubmit={handleCreateAppUser} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="اسم المستخدم (Username)">
              {(id) => (
                <TextInput
                  id={id}
                  value={appUsername}
                  onChange={(e) => setAppUsername(e.target.value)}
                  placeholder="مثال: ops.khalid"
                  required
                  minLength={3}
                />
              )}
            </Field>

            <Field label="الاسم الكامل (Full Name)">
              {(id) => (
                <TextInput
                  id={id}
                  value={appFullName}
                  onChange={(e) => setAppFullName(e.target.value)}
                  placeholder="مثال: خالد محمد - مشغل البنية التحتية"
                />
              )}
            </Field>

            <Field label="الدور والصلاحية (Role)">
              {() => (
                <Select value={appRole} onChange={(e) => setAppRole(e.target.value as 'admin' | 'operator' | 'viewer')}>
                  <option value="viewer">مشاهد (Viewer) - قراءة وتدقيق فقط</option>
                  <option value="operator">مشغل (Operator) - تنفيذ عمليات التشغيل</option>
                  <option value="admin">مدير النظام (Admin) - صلاحيات كاملة</option>
                </Select>
              )}
            </Field>

            <Field label="كلمة المرور (Password)">
              {(id) => (
                <PasswordInput
                  id={id}
                  value={appPassword}
                  onChange={(e) => setAppPassword(e.target.value)}
                  placeholder="كلمة مرور قوية (12+ رمز)..."
                  required
                />
              )}
            </Field>
            <PasswordStrength password={appPassword} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Button type="button" variant="ghost" onClick={() => setAppModalOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" variant="primary" loading={appSubmitting}>
                إنشاء حساب المشغل
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
