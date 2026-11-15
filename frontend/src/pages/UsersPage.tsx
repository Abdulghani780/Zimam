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
import { t } from '../lib/i18n';

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
      toast(err.message || t('فشل جلب المستخدمين'), 'error');
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
      toast(`${t('تم إنشاء حساب مشغل النظام [')}${appUsername}${t('] بدور ')}${appRole}.`, 'success');
      setAppModalOpen(false);
      setAppUsername('');
      setAppPassword('');
      setAppFullName('');
      setAppRole('viewer');
      fetchAppUsers();
    } catch (err: any) {
      toast(err.message || t('فشل إنشاء حساب المشغل'), 'error');
    } finally {
      setAppSubmitting(false);
    }
  };

  const handleAppRoleChange = async (user: V1User, role: string) => {
    if (role === user.role) return;
    if (!confirm(`${t('تغيير دور الحساب [')}${user.username}${t('] إلى (')}${role}${t(')؟')}`)) {
      fetchAppUsers();
      return;
    }
    setAppActionUser(user.username);
    try {
      await apiV1.updateUserRole(user.username, role);
      toast(`${t('تم تحديث دور الحساب [')}${user.username}${t('] إلى (')}${role}).`, 'success');
      fetchAppUsers();
    } catch (err: any) {
      toast(err.message || t('فشل تحديث الدور'), 'error');
    } finally {
      setAppActionUser(null);
    }
  };

  const handleDeleteAppUser = async (user: V1User) => {
    if (user.username.toLowerCase() === 'admin') {
      toast(t('لا يمكن تعطيل الحساب الجذري admin.'), 'error');
      return;
    }
    if (currentUser?.username?.toLowerCase() === user.username.toLowerCase()) {
      toast(t('لا يمكنك تعطيل الحساب الذي تستخدمه حالياً.'), 'error');
      return;
    }
    if (!confirm(`${t('تعطيل حساب مشغل النظام [')}${user.username}${t(']؟ سيتم إنهاء جلساته فوراً.')}`)) return;
    setAppActionUser(user.username);
    try {
      await apiV1.updateUserStatus(user.username, false);
      toast(`${t('تم تعطيل حساب المشغل [')}${user.username}${t('] وإنهاء جلساته.')}`, 'success');
      fetchAppUsers();
    } catch (err: any) {
      toast(err.message || t('فشل تعطيل الحساب'), 'error');
    } finally {
      setAppActionUser(null);
    }
  };

  const handleToggleState = async (user: LocalUser) => {
    setActionUser(user.username);
    try {
      const res = await api.toggleUserState(user.username, !user.enabled);
      if (res.ok) {
        toast(user.enabled ? `${t('تم تعطيل حساب [')}${user.username}].` : `${t('تم تفعيل حساب [')}${user.username}].`, 'success');
        fetchUsers();
      } else {
        toast(res.error || t('فشل الإجراء'), 'error');
      }
    } catch (err: any) {
      toast(err.message || t('خطأ'), 'error');
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
        toast(res.message || `${t('تم تغيير كلمة مرور مستخدم ويندوز [')}${selectedUser}${t('] بنجاح.')}`, 'success');
        setPasswordModalOpen(false);
        setNewPassword('');
      } else {
        toast(res.error || t('فشل تغيير كلمة المرور'), 'error');
      }
    } catch (err: any) {
      toast(err.message || t('خطأ أثناء محاولة تغيير كلمة المرور'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (uname: string) => {
    if (domainProfile?.is_domain_controller) {
      toast(t('حظر أمني: لا يمكن حذف حسابات محلية عشوائياً على وحدة تحكم النطاق (Domain Controller).'), 'error');
      return;
    }
    if (!confirm(`${t('تحذير: هل أنت متأكد من حذف المستخدم [')}${uname}${t('] نهائياً من نظام ويندوز؟')}`)) return;
    try {
      const res = await api.deleteUser(uname);
      if (res.ok) {
        toast(t('تم حذف المستخدم بنجاح'), 'success');
        fetchUsers();
      } else {
        toast(res.error || t('فشل الحذف'), 'error');
      }
    } catch (err: any) {
      toast(err.message || t('خطأ'), 'error');
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
        toast(`${t('تم إنشاء حساب [')}${username}${t('] وإضافته لمجموعات ويندوز المطلوبة.')}`, 'success');
        setModalOpen(false);
        setUsername('');
        setPassword('');
        setFullName('');
        fetchUsers();
      } else {
        toast(res.error || t('فشل إنشاء المستخدم'), 'error');
      }
    } catch (err: any) {
      toast(err.message || t('خطأ'), 'error');
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
                {t('حوكمة الهوية وإدارة الوصول المميز IAM')}
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
              {t('حوكمة مستخدمي ويندوز المحليين وصلاحيات سطح المكتب البعيد')} RDP &amp; IAM
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0, maxWidth: 840, lineHeight: 1.6 }}>
              {t('إدارة شاملة لحسابات ويندوز (SAM / Active Directory)، تعيين صلاحيات الدخول عن بعد (Remote Desktop Users)، وفرض سياسات تصليب كلمات المرور ومكافحة تصعيد الامتيازات.')}
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
              <span>{t('مزامنة SAM')}</span>
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <UserPlus size={14} />
              <span>{t('إضافة مستخدم جديد')}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Security & Policy Cards (Stitch RDP H2) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
        <Glass style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
              {t('سياسات أمان الحسابات وتصليب كلمات المرور')}
            </h4>
            <span style={{ fontSize: 11, color: 'var(--paid)', fontWeight: 700 }}>{t('مفعلة Enforced')}</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
            {t('فرض طول 12+ رمز، حظر كلمات المرور الشائعة، قفل الحساب التلقائي بعد 5 محاولات خاطئة لمنع هجمات التخمين.')}
          </p>
        </Glass>

        <Glass style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
              {t('جلسات RDP والحصة المتزامنة')}
            </h4>
            <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>{t('غير محدودة Unlimited')}</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
            {t('دعم اتصالات متعددة متزامنة مع عزل مساحة الذاكرة لكل جلسة مستخدم وضبط استهلاك البرامج الخاملة.')}
          </p>
        </Glass>

        <Glass style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
              {t('بيئة تشغيل السيرفر')}
            </h4>
            <span style={{ fontSize: 11, color: 'var(--chart-out)', fontWeight: 700 }}>
              {domainProfile?.is_domain_controller ? 'Domain Controller' : 'Sovereign Standalone Host'}
            </span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
            {t('كافة العمليات المحلية تخضع لرقابة النواة المشددة وتوثق بصمتها في سجل الامتثال الجنائي.')}
          </p>
        </Glass>
      </div>

      {/* 3. Windows Local Users Directory Table (Stitch RDP H2) */}
      <Card
        title={t('دليل حسابات السيرفر المحلي (Windows Local Users Directory)')}
        icon="users"
        actions={
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {t('إجمالي الحسابات')}: {users.length} {t('مستخدم')}
          </span>
        }
      >
        <TableContainer>
          <Table style={{ width: "100%", tableLayout: "fixed" }}>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: '17%', textAlign: 'start' }}>{t('اسم الحساب (Username)')}</TableHead>
                <TableHead style={{ width: '20%', textAlign: 'start' }}>{t('الاسم الكامل والوصف')}</TableHead>
                <TableHead style={{ width: '12%', textAlign: 'start' }}>{t('حالة الحساب')}</TableHead>
                <TableHead style={{ width: '14%', textAlign: 'start' }}>{t('صلاحية RDP')}</TableHead>
                <TableHead style={{ width: '13%', textAlign: 'start' }}>{t('دور الحساب')}</TableHead>
                <TableHead style={{ width: '24%', textAlign: 'end' }}>{t('إجراءات الحوكمة')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableEmpty colSpan={6} message={t('لا يوجد مستخدمين مسجلين في السيرفر حالياً.')} />
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
                        {u.full_name || u.description || t('حساب مستخدم محلي')}
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
                        {u.enabled ? t('نشط Active') : t('معطّل Disabled')}
                      </span>
                    </TableCell>
                    <TableCell style={{ width: '14%' }}>
                      <span
                        className={`text-xs font-bold ${
                          u.is_rdp ? 'text-primary' : 'text-muted'
                        }`}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        {u.is_rdp ? t('مفعّل (RDP)') : t('معطّل')}
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
                        {u.is_admin ? t('مدير نظام (Admin)') : t('مستخدم قياسي (User)')}
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
                          {t('كلمة المرور')}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          loading={actionUser === u.username}
                          onClick={() => handleToggleState(u)}
                          style={{ fontSize: 11, padding: '3px 8px', whiteSpace: 'nowrap' }}
                        >
                          {u.enabled ? t('تعطيل') : t('تفعيل')}
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => handleDelete(u.username)}
                          style={{ fontSize: 11, padding: '3px 8px', whiteSpace: 'nowrap' }}
                        >
                          {t('حذف')}
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
        title={t('حسابات مشغلي النظام (ASAAS App Users)')}
        icon="users"
        actions={
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
              {t('إجمالي الحسابات')}: {appUsers.length} {t('حساب')}
            </span>
            <Button
              size="sm"
              variant="glass"
              onClick={fetchAppUsers}
              loading={appUsersLoading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
            >
              <RefreshCw size={12} />
              <span>{t('تحديث')}</span>
            </Button>
            {canManageAppUsers && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => setAppModalOpen(true)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                <UserCog size={13} />
                <span>{t('إضافة حساب مشغل')}</span>
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
            {t('إدارة حسابات مشغلي النظام مقيدة بمدير النظام (Admin). يمكنك مراجعة بيانات حسابك فقط.')}
          </div>
        )}

        <TableContainer>
          <Table style={{ width: '100%', tableLayout: 'fixed' }}>
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: '18%', textAlign: 'start' }}>{t('اسم المستخدم')}</TableHead>
                <TableHead style={{ width: '20%', textAlign: 'start' }}>{t('الاسم الكامل')}</TableHead>
                <TableHead style={{ width: '19%', textAlign: 'start' }}>{t('الدور والصلاحية')}</TableHead>
                <TableHead style={{ width: '12%', textAlign: 'start' }}>{t('حالة الحساب')}</TableHead>
                <TableHead style={{ width: '19%', textAlign: 'start' }}>{t('المصادقة الثنائية')}</TableHead>
                <TableHead style={{ width: '12%', textAlign: 'end' }}>{t('إجراءات')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {appUsers.length === 0 ? (
                <TableEmpty
                  colSpan={6}
                  message={appUsersLoading ? t('جارٍ تحميل حسابات المشغلين...') : t('لا توجد حسابات مشغلين مسجلة حالياً.')}
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
                              <span style={{ marginInlineStart: 6, fontSize: 10, color: 'var(--accent)' }}>{t('(أنت)')}</span>
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
                            aria-label={`${t('دور الحساب ')}${u.username}`}
                          >
                            <option value="admin">{t('مدير النظام (Admin)')}</option>
                            <option value="operator">{t('مشغل (Operator)')}</option>
                            <option value="viewer">{t('مشاهد (Viewer)')}</option>
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
                            {u.role === 'admin' ? t('مدير النظام (Admin)') : u.role === 'operator' ? t('مشغل (Operator)') : t('مشاهد (Viewer)')}
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
                          {u.is_active ? t('نشط Active') : t('معطّل Disabled')}
                        </span>
                      </TableCell>
                      <TableCell style={{ width: '19%' }} className="text-xs text-muted">
                        <span style={{ whiteSpace: 'nowrap' }}>
                          {u.mfa_enabled ? t('MFA مفعّل') : '—'}
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
                              title={isRoot ? t('الحساب الجذري محمي من التعطيل') : t('تعطيل حساب المشغل وإنهاء جلساته')}
                            >
                              <Trash2 size={12} style={{ marginInlineEnd: 4 }} />
                              {t('تعطيل')}
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
                                  toast(`${t('تم تفعيل حساب المشغل [')}${u.username}].`, 'success');
                                  fetchAppUsers();
                                } catch (err: any) {
                                  toast(err.message || t('فشل تفعيل الحساب'), 'error');
                                } finally {
                                  setAppActionUser(null);
                                }
                              }}
                              style={{ fontSize: 11, padding: '3px 8px', whiteSpace: 'nowrap' }}
                            >
                              {t('تفعيل')}
                            </Button>
                          )
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                            <ShieldCheck size={12} style={{ marginInlineEnd: 4 }} />
                            {t('مقيد')}
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
        <Modal onClose={() => setPasswordModalOpen(false)} title={`${t('تغيير كلمة المرور للمستخدم: ')}${selectedUser}`}>
          <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label={t('كلمة المرور الجديدة (New Password)')}>
              {(id) => (
                <PasswordInput
                  id={id}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t('أدخل كلمة مرور قوية (12+ رمز)...')}
                  required
                />
              )}
            </Field>
            <PasswordStrength password={newPassword} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Button type="button" variant="ghost" onClick={() => setPasswordModalOpen(false)}>
                {t('إلغاء')}
              </Button>
              <Button type="submit" variant="primary" loading={loading}>
                {t('تحديث كلمة المرور')}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Modal: Create User (Stitch RDP H2) */}
      {modalOpen && (
        <Modal onClose={() => setModalOpen(false)} title={t('إضافة مستخدم ويندوز محلي جديد')}>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label={t('اسم الحساب بالإنجليزية (Username)')}>
              {(id) => (
                <TextInput
                  id={id}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={t('مثال: khalid.ops')}
                  required
                />
              )}
            </Field>

            <Field label={t('الاسم الكامل أو الوصف (Full Name / Description)')}>
              {(id) => (
                <TextInput
                  id={id}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder={t('مثال: خالد محمد - فريق الدعم الفني')}
                />
              )}
            </Field>

            <Field label={t('كلمة المرور (Password)')}>
              {(id) => (
                <PasswordInput
                  id={id}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('كلمة مرور مؤمنة...')}
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
                <span>{t('منح إذن تسجيل الدخول عن بعد (Remote Desktop Users)')}</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                <input
                  type="checkbox"
                  checked={isAdmin}
                  onChange={(e) => setIsAdmin(e.target.checked)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                <span>{t('منح صلاحيات مدير نظام كامل (Administrators Group)')}</span>
              </label>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                {t('إلغاء')}
              </Button>
              <Button type="submit" variant="primary" loading={loading}>
                {t('إنشاء الحساب')}
              </Button>
            </div>
          </form>
        </Modal>
      )}
      {/* Modal: Create ASAAS App User */}
      {appModalOpen && (
        <Modal onClose={() => setAppModalOpen(false)} title={t('إضافة حساب مشغل جديد لمنصة ASAAS')}>
          <form onSubmit={handleCreateAppUser} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label={t('اسم المستخدم (Username)')}>
              {(id) => (
                <TextInput
                  id={id}
                  value={appUsername}
                  onChange={(e) => setAppUsername(e.target.value)}
                  placeholder={t('مثال: ops.khalid')}
                  required
                  minLength={3}
                />
              )}
            </Field>

            <Field label={t('الاسم الكامل (Full Name)')}>
              {(id) => (
                <TextInput
                  id={id}
                  value={appFullName}
                  onChange={(e) => setAppFullName(e.target.value)}
                  placeholder={t('مثال: خالد محمد - مشغل البنية التحتية')}
                />
              )}
            </Field>

            <Field label={t('الدور والصلاحية (Role)')}>
              {() => (
                <Select value={appRole} onChange={(e) => setAppRole(e.target.value as 'admin' | 'operator' | 'viewer')}>
                  <option value="viewer">{t('مشاهد (Viewer) - قراءة وتدقيق فقط')}</option>
                  <option value="operator">{t('مشغل (Operator) - تنفيذ عمليات التشغيل')}</option>
                  <option value="admin">{t('مدير النظام (Admin) - صلاحيات كاملة')}</option>
                </Select>
              )}
            </Field>

            <Field label={t('كلمة المرور (Password)')}>
              {(id) => (
                <PasswordInput
                  id={id}
                  value={appPassword}
                  onChange={(e) => setAppPassword(e.target.value)}
                  placeholder={t('كلمة مرور قوية (12+ رمز)...')}
                  required
                />
              )}
            </Field>
            <PasswordStrength password={appPassword} />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Button type="button" variant="ghost" onClick={() => setAppModalOpen(false)}>
                {t('إلغاء')}
              </Button>
              <Button type="submit" variant="primary" loading={appSubmitting}>
                {t('إنشاء حساب المشغل')}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
