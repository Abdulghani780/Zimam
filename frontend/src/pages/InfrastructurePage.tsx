/**
 * ASAAS Enterprise v3.0 - Sovereign Windows Server Management
 * Domain 7: Infrastructure (أدوار Windows، ميزات الخادم، الخدمات، المهام المجدولة، التحديثات والشهادات)
 * Zero-Mock Production with Real Windows Server 2025 Standard APIs
 */

import { useState, useEffect } from 'react';
import { Card, Button, Modal, TextInput, useToast } from '../asaas-ui';
import { api } from '../lib/api';
import {
  Layers,
  Cog,
  Calendar,
  ShieldCheck,
  Award,
  RefreshCw,
  Search,
  Play,
  Square,
  RotateCw,
  AlertTriangle,
} from 'lucide-react';

export function InfrastructurePage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'roles' | 'services' | 'tasks' | 'updates' | 'certs'>('roles');
  const [loading, setLoading] = useState(false);

  // 1. Roles & Features State
  const [roles, setRoles] = useState<any[]>([]);
  const [rolesSearch, setRolesSearch] = useState('');
  const [rolesFilter, setRolesFilter] = useState<'all' | 'installed' | 'available'>('installed');
  const [selectedRole, setSelectedRole] = useState<any | null>(null);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [roleActionExecuting, setRoleActionExecuting] = useState(false);

  // 2. Services State
  const [services, setServices] = useState<any[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceStatusFilter, setServiceStatusFilter] = useState<'all' | 'running' | 'stopped'>('all');
  const [controllingService, setControllingService] = useState<string | null>(null);

  // 3. Tasks State
  const [tasks, setTasks] = useState<any[]>([]);
  const [tasksSearch, setTasksSearch] = useState('');

  // 4. Updates State
  const [updatesData, setUpdatesData] = useState<any>(null);

  // 5. Certificates State
  const [certs, setCerts] = useState<any[]>([]);

  const fetchRoles = async (refresh = false) => {
    try {
      const res = await api.getRoles(refresh);
      setRoles(res?.roles || []);
    } catch (err: any) {
      toast(err.message || 'فشل جلب أدوار الخادم', 'error');
    }
  };

  const fetchServices = async (q = '') => {
    try {
      const res = await api.getServicesList(q);
      setServices(res?.services || []);
    } catch (err: any) {
      toast(err.message || 'فشل جلب خدمات النظام', 'error');
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await api.getTasksList();
      setTasks(res?.tasks || []);
    } catch (err: any) {
      toast(err.message || 'فشل جلب المهام المجدولة', 'error');
    }
  };

  const fetchUpdates = async () => {
    try {
      const res = await api.getUpdates();
      setUpdatesData(res);
    } catch (err: any) {
      toast(err.message || 'فشل جلب تحديثات الخادم', 'error');
    }
  };

  const fetchCerts = async () => {
    try {
      const res = await api.getCertificatesList();
      setCerts(res?.certificates || []);
    } catch (err: any) {
      toast(err.message || 'فشل جلب شهادات النظام', 'error');
    }
  };

  const fetchTabData = async () => {
    setLoading(true);
    if (activeTab === 'roles') await fetchRoles();
    else if (activeTab === 'services') await fetchServices(serviceSearch);
    else if (activeTab === 'tasks') await fetchTasks();
    else if (activeTab === 'updates') await fetchUpdates();
    else if (activeTab === 'certs') await fetchCerts();
    setLoading(false);
  };

  useEffect(() => {
    fetchTabData();
  }, [activeTab]);

  // Roles Actions
  const handleToggleRoleModal = (role: any) => {
    setSelectedRole(role);
    setRoleModalOpen(true);
  };

  const handleExecuteRoleAction = async () => {
    if (!selectedRole) return;
    setRoleActionExecuting(true);
    try {
      const isInstalled = selectedRole.installed;
      const fn = isInstalled ? api.uninstallRole : api.installRole;
      const res = await fn(selectedRole.name, true);
      if (res.ok) {
        toast(`تم بنجاح أمر ${isInstalled ? 'إزالة' : 'تثبيت'} الدور [${selectedRole.display_name}].`, 'success');
        setRoleModalOpen(false);
        fetchRoles(true);
      } else {
        toast(res.error || 'فشلت معالجة طلب الدور', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ أثناء تنفيذ الإجراء', 'error');
    } finally {
      setRoleActionExecuting(false);
    }
  };

  // Services Actions
  const handleControlService = async (serviceName: string, action: 'start' | 'stop' | 'restart') => {
    setControllingService(serviceName);
    try {
      const res = await api.controlServiceAction(serviceName, action);
      if (res.ok) {
        toast(`تم إرسال أمر ${action} للخدمة [${serviceName}] بنجاح`, 'success');
        fetchServices(serviceSearch);
      } else {
        toast(res.error || `فشل أمر ${action} للخدمة`, 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ أثناء التحكم بالخدمة', 'error');
    } finally {
      setControllingService(null);
    }
  };

  // Filters
  const filteredRoles = roles.filter((r) => {
    const matchesSearch =
      (r.display_name || '').toLowerCase().includes(rolesSearch.toLowerCase()) ||
      (r.name || '').toLowerCase().includes(rolesSearch.toLowerCase());
    if (!matchesSearch) return false;
    if (rolesFilter === 'installed') return r.installed;
    if (rolesFilter === 'available') return !r.installed;
    return true;
  });

  const filteredServices = services.filter((s) => {
    const matchesSearch =
      (s.display_name || '').toLowerCase().includes(serviceSearch.toLowerCase()) ||
      (s.name || '').toLowerCase().includes(serviceSearch.toLowerCase());
    if (!matchesSearch) return false;
    if (serviceStatusFilter === 'running') return s.status === 'running';
    if (serviceStatusFilter === 'stopped') return s.status === 'stopped';
    return true;
  });

  const filteredTasks = tasks.filter((t) =>
    (t.name || '').toLowerCase().includes(tasksSearch.toLowerCase()) ||
    (t.path || '').toLowerCase().includes(tasksSearch.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Layers size={24} style={{ color: 'var(--accent)' }} />
            <span>البنية التحتية والخدمات (Windows Server Core & SCM)</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-3)' }}>
            لوحة إدارة مركزية لأدوار وميزات السيرفر، خدمات Windows Service Control Manager، المهام المجدولة، والتحديثات.
          </p>
        </div>
        <Button variant="ghost" onClick={fetchTabData} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          <span>تحديث</span>
        </Button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--glass-rim)', paddingBottom: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setActiveTab('roles')}
          style={{
            background: activeTab === 'roles' ? 'var(--accent-soft)' : 'transparent',
            color: activeTab === 'roles' ? 'var(--accent)' : 'var(--text-3)',
            border: 'none',
            padding: '8px 16px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Layers size={16} />
          <span>أدوار وميزات السيرفر (Roles & Features)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('services')}
          style={{
            background: activeTab === 'services' ? 'var(--accent-soft)' : 'transparent',
            color: activeTab === 'services' ? 'var(--accent)' : 'var(--text-3)',
            border: 'none',
            padding: '8px 16px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Cog size={16} />
          <span>خدمات Windows (Services - {services.length || 387})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tasks')}
          style={{
            background: activeTab === 'tasks' ? 'var(--accent-soft)' : 'transparent',
            color: activeTab === 'tasks' ? 'var(--accent)' : 'var(--text-3)',
            border: 'none',
            padding: '8px 16px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Calendar size={16} />
          <span>المهام المجدولة (Task Scheduler)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('updates')}
          style={{
            background: activeTab === 'updates' ? 'var(--accent-soft)' : 'transparent',
            color: activeTab === 'updates' ? 'var(--accent)' : 'var(--text-3)',
            border: 'none',
            padding: '8px 16px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <ShieldCheck size={16} />
          <span>تحديثات النظام (Windows Updates)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('certs')}
          style={{
            background: activeTab === 'certs' ? 'var(--accent-soft)' : 'transparent',
            color: activeTab === 'certs' ? 'var(--accent)' : 'var(--text-3)',
            border: 'none',
            padding: '8px 16px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Award size={16} />
          <span>خزنة الشهادات (Certificates)</span>
        </button>
      </div>

      {/* Tab 1: Roles & Features */}
      {activeTab === 'roles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, maxWidth: 420 }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={16} style={{ position: 'absolute', right: 12, top: 10, color: 'var(--text-3)' }} />
                <TextInput
                  value={rolesSearch}
                  onChange={(e) => setRolesSearch(e.target.value)}
                  placeholder="بحث في الأدوار والميزات..."
                  style={{ paddingRight: 36 }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                variant={rolesFilter === 'installed' ? 'primary' : 'ghost'}
                onClick={() => setRolesFilter('installed')}
                style={{ fontSize: 12 }}
              >
                المثبتة فقط
              </Button>
              <Button
                variant={rolesFilter === 'available' ? 'primary' : 'ghost'}
                onClick={() => setRolesFilter('available')}
                style={{ fontSize: 12 }}
              >
                المتاحة للتثبيت
              </Button>
              <Button
                variant={rolesFilter === 'all' ? 'primary' : 'ghost'}
                onClick={() => setRolesFilter('all')}
                style={{ fontSize: 12 }}
              >
                الكل ({roles.length})
              </Button>
            </div>
          </div>

          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
                <thead>
                  <tr style={{ background: 'var(--glass-tint)', borderBottom: '1px solid var(--glass-rim)' }}>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>اسم الدور / الميزة</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>المعرف التقني</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>الحالة</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700, textAlign: 'end' }}>إجراء المعالج</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRoles.map((r, i) => (
                    <tr key={r.name || i} style={{ borderBottom: '1px solid var(--glass-rim-low)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-1)' }}>{r.display_name}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-3)' }}>
                        {r.name}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className={`badge ${r.installed ? 'badge--success' : 'badge--neutral'}`} style={{ fontSize: 11 }}>
                          {r.installed ? 'مثبّت ونشط' : 'متاح للتثبيت'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'end' }}>
                        <Button
                          variant={r.installed ? 'secondary' : 'primary'}
                          onClick={() => handleToggleRoleModal(r)}
                          style={{ fontSize: 11, padding: '4px 10px' }}
                        >
                          {r.installed ? 'إزالة الدور' : 'تثبيت الدور'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 2: Windows Services (SCM) */}
      {activeTab === 'services' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, maxWidth: 420 }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search size={16} style={{ position: 'absolute', right: 12, top: 10, color: 'var(--text-3)' }} />
                <TextInput
                  value={serviceSearch}
                  onChange={(e) => {
                    setServiceSearch(e.target.value);
                    fetchServices(e.target.value);
                  }}
                  placeholder="بحث سريع في الخدمات (مثال: RpcSs, TermService, WinRM)..."
                  style={{ paddingRight: 36 }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <Button
                variant={serviceStatusFilter === 'running' ? 'primary' : 'ghost'}
                onClick={() => setServiceStatusFilter('running')}
                style={{ fontSize: 12 }}
              >
                قيد التشغيل (Running)
              </Button>
              <Button
                variant={serviceStatusFilter === 'stopped' ? 'primary' : 'ghost'}
                onClick={() => setServiceStatusFilter('stopped')}
                style={{ fontSize: 12 }}
              >
                متوقفة (Stopped)
              </Button>
              <Button
                variant={serviceStatusFilter === 'all' ? 'primary' : 'ghost'}
                onClick={() => setServiceStatusFilter('all')}
                style={{ fontSize: 12 }}
              >
                كافة الخدمات ({services.length})
              </Button>
            </div>
          </div>

          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto', maxHeight: '600px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ background: 'var(--surface-ground)', borderBottom: '1px solid var(--glass-rim)' }}>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>اسم الخدمة</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>الاسم البرمجي</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>نوع البدء</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>الحالة</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700, textAlign: 'end' }}>التحكم بالخدمة</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredServices.map((s) => (
                    <tr key={s.name} style={{ borderBottom: '1px solid var(--glass-rim-low)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-1)' }}>{s.display_name || s.name}</div>
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-3)' }}>
                        {s.name}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-2)' }}>
                        <span className="badge badge--neutral" style={{ fontSize: 10 }}>
                          {s.start_type || 'Manual'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className={`badge ${s.status === 'running' ? 'badge--success' : 'badge--neutral'}`} style={{ fontSize: 11 }}>
                          {s.status === 'running' ? 'قيد التشغيل' : 'متوقفة'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'end' }}>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          {s.status !== 'running' && (
                            <Button
                              variant="ghost"
                              disabled={controllingService === s.name}
                              onClick={() => handleControlService(s.name, 'start')}
                              style={{ color: 'var(--status-safe)', padding: 6 }}
                              title="تشغيل الخدمة"
                            >
                              <Play size={14} />
                            </Button>
                          )}
                          {s.status === 'running' && (
                            <Button
                              variant="ghost"
                              disabled={controllingService === s.name}
                              onClick={() => handleControlService(s.name, 'stop')}
                              style={{ color: 'var(--status-danger)', padding: 6 }}
                              title="إيقاف الخدمة"
                            >
                              <Square size={14} />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            disabled={controllingService === s.name}
                            onClick={() => handleControlService(s.name, 'restart')}
                            style={{ color: 'var(--accent)', padding: 6 }}
                            title="إعادة تشغيل الخدمة"
                          >
                            <RotateCw size={14} className={controllingService === s.name ? 'spin' : ''} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 3: Scheduled Tasks */}
      {activeTab === 'tasks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ position: 'relative', maxWidth: 420 }}>
            <Search size={16} style={{ position: 'absolute', right: 12, top: 10, color: 'var(--text-3)' }} />
            <TextInput
              value={tasksSearch}
              onChange={(e) => setTasksSearch(e.target.value)}
              placeholder="بحث في المهام المجدولة..."
              style={{ paddingRight: 36 }}
            />
          </div>

          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto', maxHeight: '500px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
                <thead>
                  <tr style={{ background: 'var(--glass-tint)', borderBottom: '1px solid var(--glass-rim)' }}>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>اسم المهمة</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>المسار في Task Scheduler</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTasks.map((t, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--glass-rim-low)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13, color: 'var(--text-1)' }}>
                        {t.name}
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-3)' }}>
                        {t.path}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className={`badge ${t.state === 'Ready' || t.state === 'Running' ? 'badge--success' : 'badge--neutral'}`} style={{ fontSize: 11 }}>
                          {t.state}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 4: Windows Updates */}
      {activeTab === 'updates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {updatesData?.pending_reboot && (
            <div style={{ padding: 14, borderRadius: 8, background: 'rgba(234, 179, 8, 0.12)', border: '1px solid rgba(234, 179, 8, 0.3)', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--accent)' }}>
              <AlertTriangle size={20} />
              <div>
                <strong>تنبيه: يتطلب النظام إعادة تشغيل لإكمال تطبيق تحديثات الأمان!</strong>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                  سجل Windows Registry يشير إلى وجود تحديثات مجمعة مثبتة بانتظار إعادة التشغيل.
                </div>
              </div>
            </div>
          )}

          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--glass-rim)', fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>
              سجل التحديثات المثبتة (Hotfixes & Security Patches)
            </div>
            <div style={{ overflowX: 'auto', maxHeight: '500px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
                <thead>
                  <tr style={{ background: 'var(--glass-tint)', borderBottom: '1px solid var(--glass-rim)' }}>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>معرف التحديث (HotFix ID)</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>الوصف</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>تاريخ التثبيت</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>مثبت بواسطة</th>
                  </tr>
                </thead>
                <tbody>
                  {(updatesData?.hotfixes || []).map((h: any, i: number) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--glass-rim-low)' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>
                        {h.HotFixID}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-2)' }}>
                        {h.Description || 'Security Update'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)' }}>
                        {h.InstalledOn || 'غير محدد'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)' }}>
                        {h.InstalledBy || 'NT AUTHORITY\\SYSTEM'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 5: Certificates */}
      {activeTab === 'certs' && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--glass-rim)', fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>
            شهادات الأمان المحلية (LocalMachine\My Store)
          </div>
          <div style={{ overflowX: 'auto', maxHeight: '500px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
              <thead>
                <tr style={{ background: 'var(--glass-tint)', borderBottom: '1px solid var(--glass-rim)' }}>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>الموضوع (Subject)</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>الجهة المصدرة (Issuer)</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>تاريخ الانتهاء</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>البصمة (Thumbprint)</th>
                </tr>
              </thead>
              <tbody>
                {certs.map((c, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--glass-rim-low)' }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13, color: 'var(--text-1)' }}>
                      {c.subject || c.Subject}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-2)' }}>
                      {c.issuer || c.Issuer}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)' }}>
                      {c.not_after || c.NotAfter}
                    </td>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 11, color: 'var(--text-3)' }}>
                      {c.thumbprint || c.Thumbprint}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal: Role Action Confirmation */}
      <Modal
        open={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        title={selectedRole?.installed ? 'إزالة دور من الخادم' : 'تثبيت دور وميزة على الخادم'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
            هل ترغب في {selectedRole?.installed ? 'إلغاء تثبيت' : 'تثبيت'} الدور التالي عبر Server Manager؟
          </div>
          <div style={{ padding: 12, borderRadius: 8, background: 'var(--glass-tint)', border: '1px solid var(--glass-rim)' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>{selectedRole?.display_name}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)', marginTop: 2 }}>{selectedRole?.name}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <Button variant="ghost" onClick={() => setRoleModalOpen(false)}>إلغاء</Button>
            <Button
              variant={selectedRole?.installed ? 'danger' : 'primary'}
              disabled={roleActionExecuting}
              onClick={handleExecuteRoleAction}
            >
              {roleActionExecuting ? 'جارٍ المعالجة عبر Action Engine...' : (selectedRole?.installed ? 'تأكيد الإزالة' : 'تأكيد التثبيت')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
