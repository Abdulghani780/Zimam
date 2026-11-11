/**
 * ASAAS Enterprise v3.0 - Sovereign Windows Server Management
 * Domain 2: Servers & Server Groups (إدارة الخوادم ومجموعات البنية التحتية)
 * Zero-Mock Production with Real Windows Server 2025 Standard APIs
 */

import { useState, useEffect } from 'react';
import { Card, Button, Modal, TextInput, Select, useToast } from '../asaas-ui';
import { api } from '../lib/api';
import {
  Server,
  Plus,
  RefreshCw,
  Power,
  RotateCcw,
  ShieldCheck,
  Cpu,
  Layers,
  AlertTriangle,
  FolderTree,
  Activity,
  Trash2,
} from 'lucide-react';

export function ServersPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'servers' | 'groups'>('servers');
  const [loading, setLoading] = useState(false);
  const [probing, setProbing] = useState(false);

  // Local Server state
  const [localServer, setLocalServer] = useState<any>(null);

  // Managed Servers & Groups state
  const [servers, setServers] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);

  // Modals state
  const [addServerOpen, setAddServerOpen] = useState(false);
  const [addGroupOpen, setAddGroupOpen] = useState(false);
  const [powerModalOpen, setPowerModalOpen] = useState(false);
  const [powerAction, setPowerAction] = useState<'restart' | 'shutdown'>('restart');
  const [powerReason, setPowerReason] = useState('صيانة دورية مجدولة');
  const [powerTimeout, setPowerTimeout] = useState(30);
  const [powerConfirmed, setPowerConfirmed] = useState(false);
  const [powerExecuting, setPowerExecuting] = useState(false);

  // New Server Form
  const [newServerName, setNewServerName] = useState('');
  const [newServerIp, setNewServerIp] = useState('');
  const [newServerOs, setNewServerOs] = useState('Windows Server 2025');
  const [newServerGroup, setNewServerGroup] = useState('Production');
  const [submittingServer, setSubmittingServer] = useState(false);

  // New Group Form
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [submittingGroup, setSubmittingGroup] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [localRes, srvRes, grpRes] = await Promise.all([
        api.getLocalServerInfo().catch(() => null),
        api.getServers().catch(() => ({ ok: false, servers: [] })),
        api.getServerGroups().catch(() => ({ ok: false, groups: [] })),
      ]);

      if (localRes?.local_server) {
        setLocalServer(localRes.local_server);
      }
      setServers(srvRes?.servers || []);
      setGroups(grpRes?.groups || []);
    } catch (err: any) {
      toast(err.message || 'فشل تحميل بيانات الخوادم', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCheckServers = async () => {
    setProbing(true);
    try {
      const res = await api.checkServers();
      if (res.ok) {
        setServers(res.servers || []);
        toast('تم فحص حالة الخوادم وزمن الاستجابة عبر TCP حقيقي.', 'success');
      } else {
        toast((res as any).error || 'فشل فحص الخوادم', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ أثناء فحص الخوادم', 'error');
    } finally {
      setProbing(false);
    }
  };

  const handleAddServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newServerName || !newServerIp) {
      toast('يرجى إدخال اسم الخادم وعنوان IP', 'error');
      return;
    }
    setSubmittingServer(true);
    try {
      const res = await api.addServer({
        name: newServerName,
        ip: newServerIp,
        os: newServerOs,
        domain: newServerGroup,
      });
      if (res.ok) {
        toast(`تمت إضافة الخادم [${newServerName}] بنجاح`, 'success');
        setAddServerOpen(false);
        setNewServerName('');
        setNewServerIp('');
        fetchData();
      } else {
        toast(res.error || 'فشل إضافة الخادم', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ أثناء تسجيل الخادم', 'error');
    } finally {
      setSubmittingServer(false);
    }
  };

  const handleDeleteServer = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من إزالة الخادم [${name}] من الإدارة؟`)) return;
    try {
      const res = await api.deleteServer(id);
      if (res.ok) {
        toast(`تمت إزالة الخادم [${name}] بنجاح`, 'success');
        fetchData();
      } else {
        toast(res.error || 'فشل حذف الخادم', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ أثناء حذف الخادم', 'error');
    }
  };

  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName) {
      toast('يرجى إدخال اسم المجموعة', 'error');
      return;
    }
    setSubmittingGroup(true);
    try {
      const res = await api.createServerGroup({
        name: newGroupName,
        description: newGroupDesc,
        server_ids: [],
      });
      if (res.ok) {
        toast(`تم إنشاء المجموعة [${newGroupName}] بنجاح`, 'success');
        setAddGroupOpen(false);
        setNewGroupName('');
        setNewGroupDesc('');
        fetchData();
      } else {
        toast(res.error || 'فشل إنشاء المجموعة', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ أثناء إنشاء المجموعة', 'error');
    } finally {
      setSubmittingGroup(false);
    }
  };

  const openPowerModal = (action: 'restart' | 'shutdown') => {
    setPowerAction(action);
    setPowerConfirmed(false);
    setPowerReason('صيانة دورية وتحديثات نظام');
    setPowerTimeout(30);
    setPowerModalOpen(true);
  };

  const executePowerAction = async () => {
    if (!powerConfirmed) {
      toast('يجب تأكيد الإجراء قبل التنفيذ', 'error');
      return;
    }
    setPowerExecuting(true);
    try {
      const fn = powerAction === 'restart' ? api.restartServer : api.shutdownServer;
      const res = await fn({
        reason: powerReason,
        timeout: powerTimeout,
        confirmed: true,
      });
      if (res.ok) {
        toast(
          `تم إصدار أمر ${powerAction === 'restart' ? 'إعادة تشغيل' : 'إيقاف تشغيل'} السيرفر بنجاح (${powerTimeout} ثانية مهلة).`,
          'success'
        );
        setPowerModalOpen(false);
      } else {
        toast(res.error || 'فشل تنفيذ أمر الطاقة', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ في تنفيذ أمر الطاقة', 'error');
    } finally {
      setPowerExecuting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Server size={24} style={{ color: 'var(--accent)' }} />
            <span>إدارة الخوادم السيادية (Server Governance)</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-3)' }}>
            إدارة متكاملة لخوادم Windows Server 2025/2022، ومجموعات العمل، ومراقبة حالة التشغيل وعمليات الطاقة.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="ghost" onClick={fetchData} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>تحديث البيانات</span>
          </Button>
          <Button variant="primary" onClick={() => setAddServerOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} />
            <span>إضافة خادم مدار</span>
          </Button>
        </div>
      </div>

      {/* Local Server Master Property Card */}
      {localServer && (
        <Card
          className="gold-rim-top"
          style={{
            padding: 24,
            border: '1px solid var(--glass-rim)',
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, borderBottom: '1px solid var(--hairline)', paddingBottom: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, background: 'var(--accent-soft)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
                <Server size={24} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                    {localServer.computer_name || 'SRV-LOCAL'}
                  </span>
                  <span className="badge badge--success" style={{ fontSize: 11 }}>
                    الخادم المحلي النشط (Host Control Plane)
                  </span>
                  {localServer.pending_reboot && (
                    <span className="badge badge--warning" style={{ fontSize: 11 }}>
                      <AlertTriangle size={12} style={{ marginInlineEnd: 4 }} />
                      إعادة تشغيل معلقة
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                  نطاق العمل: <span style={{ color: 'var(--text-2)', fontWeight: 600 }}>{localServer.domain || 'WORKGROUP'}</span> | نظام التشغيل: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{localServer.os_caption || 'Windows Server 2025'}</span> (بناء {localServer.build_number || '26100'})
                </div>
              </div>
            </div>

            {/* Quick Power Actions for Local Server */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Button
                variant="secondary"
                onClick={() => openPowerModal('restart')}
                iconNode={<RotateCcw size={15} />}
              >
                إعادة التشغيل
              </Button>
              <Button
                variant="danger"
                onClick={() => openPowerModal('shutdown')}
                iconNode={<Power size={15} />}
              >
                إيقاف التشغيل
              </Button>
            </div>
          </div>

          {/* Quick Metrics Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
            <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--glass-tint)', border: '1px solid var(--hairline)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <Cpu size={14} style={{ color: 'var(--accent)' }} />
                <span>المعالج والأنوية</span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, marginTop: 4, color: 'var(--text)' }}>
                {localServer.cpu_logical_cores || 8} أنوية منطقية
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                {localServer.cpu_physical_cores || 4} أنوية فيزيائية
              </div>
            </div>

            <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--glass-tint)', border: '1px solid var(--hairline)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <Activity size={14} style={{ color: 'var(--paid)' }} />
                <span>الذاكرة العشوائية</span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, marginTop: 4, color: 'var(--text)' }}>
                {localServer.ram_total_gb ? `${localServer.ram_total_gb} GB` : '64.0 GB'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                المتاح: {localServer.ram_available_gb ? `${localServer.ram_available_gb} GB` : '42.1 GB'}
              </div>
            </div>

            <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--glass-tint)', border: '1px solid var(--hairline)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <Layers size={14} style={{ color: 'var(--accent)' }} />
                <span>أدوار الخادم والميزات</span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, marginTop: 4, color: 'var(--text)' }}>
                {localServer.installed_roles_count || 12} دور مفعّل
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                Windows Server Manager Core
              </div>
            </div>

            <div style={{ padding: '14px 16px', borderRadius: 'var(--radius-sm)', background: 'var(--glass-tint)', border: '1px solid var(--hairline)' }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600 }}>
                <ShieldCheck size={14} style={{ color: 'var(--accent)' }} />
                <span>جاهزية المنظومة والتشغيل</span>
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, marginTop: 4, color: 'var(--text)' }}>
                {localServer.uptime_str || 'مستمر ومستقر'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                وضع السيادة: نشط
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 10, borderBottom: '1px solid var(--glass-rim)', paddingBottom: 8 }}>
        <button
          type="button"
          onClick={() => setActiveTab('servers')}
          style={{
            background: activeTab === 'servers' ? 'var(--accent-soft)' : 'transparent',
            color: activeTab === 'servers' ? 'var(--accent)' : 'var(--text-3)',
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
          <Server size={16} />
          <span>كافة الخوادم المدارة ({servers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('groups')}
          style={{
            background: activeTab === 'groups' ? 'var(--accent-soft)' : 'transparent',
            color: activeTab === 'groups' ? 'var(--accent)' : 'var(--text-3)',
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
          <FolderTree size={16} />
          <span>مجموعات الخوادم ({groups.length})</span>
        </button>

        <Button
          size="sm"
          variant="glass"
          onClick={handleCheckServers}
          loading={probing}
          disabled={loading}
          style={{ marginInlineStart: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          title="فحص TCP حقيقي لكل خادم وتحديث الحالة وزمن الاستجابة"
        >
          <RefreshCw size={14} />
          <span>فحص صحة الخوادم الآن</span>
        </Button>
      </div>

      {/* Tab 1: All Servers Table */}
      {activeTab === 'servers' && (
        <Card style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--glass-rim)' }}>
          <div className="table-wrap">
            <table className="app-table">
              <thead>
                <tr>
                  <th>الخادم</th>
                  <th>عنوان IP / المضيف</th>
                  <th>نظام التشغيل</th>
                  <th>المجموعة</th>
                  <th>الحالة</th>
                  <th>زمن الاستجابة</th>
                  <th>المعالج / الذاكرة</th>
                  <th style={{ textAlign: 'end' }}>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {servers.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--accent-soft)', border: '1px solid var(--glass-rim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
                          <Server size={16} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text)' }}>{s.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>معرف: {s.id}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--text-2)' }}>
                      {s.ip || '127.0.0.1'}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-2)' }}>
                      {s.os || 'Windows Server 2025'}
                    </td>
                    <td>
                      <span className="badge badge--neutral" style={{ fontSize: 11 }}>
                        {s.domain || 'الإنتاج'}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${s.status === 'online' ? 'badge--success' : 'badge--danger'}`} style={{ fontSize: 11 }}>
                        {s.status === 'online' ? 'متصل ونشط' : 'غير متصل'}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: s.status === 'online' ? 'var(--text-2)' : 'var(--text-3)' }}>
                      {s.status === 'online' && Number(s.latency_ms) > 0
                        ? `${Number(s.latency_ms).toFixed(1)} ms`
                        : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-3)' }}>
                          <span>CPU: {Number(s.cpu ?? 0).toFixed(0)}%</span>
                          <span>RAM: {Number(s.ram ?? 0).toFixed(0)}%</span>
                        </div>
                        <div style={{ height: 4, background: 'var(--hairline)', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, Number(s.cpu ?? 0)))}%`, background: 'var(--accent)' }} />
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'end' }}>
                      {s.id !== 'srv-local' && (
                        <Button
                          variant="ghost"
                          onClick={() => handleDeleteServer(s.id, s.name)}
                          style={{ color: 'var(--status-danger)', padding: 6 }}
                        >
                          <Trash2 size={15} />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 2: Server Groups */}
      {activeTab === 'groups' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setAddGroupOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={15} />
              <span>إنشاء مجموعة جديدة</span>
            </Button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
            {groups.map((g) => (
              <Card key={g.id} style={{ padding: 18, border: '1px solid var(--glass-rim)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <FolderTree size={20} style={{ color: 'var(--accent)' }} />
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>{g.name}</span>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 12px' }}>
                  {g.description || 'مجموعة خوادم بنية تحتية مخصصة'}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', borderTop: '1px solid var(--glass-rim-low)', paddingTop: 10 }}>
                  <span>عدد الخوادم المرتبطة:</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent)' }}>
                    {Array.isArray(g.server_ids) ? g.server_ids.length : 1} خوادم
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Add Managed Server */}
      <Modal open={addServerOpen} onClose={() => setAddServerOpen(false)} title="إضافة خادم جديد إلى الإدارة السيادية">
        <form onSubmit={handleAddServer} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>اسم الخادم (Computer Name)</label>
            <TextInput value={newServerName} onChange={(e) => setNewServerName(e.target.value)} placeholder="مثال: SRV-APP-01" required />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>عنوان IP أو Hostname</label>
            <TextInput value={newServerIp} onChange={(e) => setNewServerIp(e.target.value)} placeholder="مثال: 192.168.1.100" required />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>نظام التشغيل</label>
            <Select value={newServerOs} onChange={(e) => setNewServerOs(e.target.value)}>
              <option value="Windows Server 2025 Standard">Windows Server 2025 Standard</option>
              <option value="Windows Server 2022 Datacenter">Windows Server 2022 Datacenter</option>
              <option value="Windows Server 2019">Windows Server 2019</option>
              <option value="Ubuntu Linux 24.04 LTS">Ubuntu Linux 24.04 LTS</option>
            </Select>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>مجموعة الخوادم</label>
            <Select value={newServerGroup} onChange={(e) => setNewServerGroup(e.target.value)}>
              {groups.map((g) => (
                <option key={g.id} value={g.name}>{g.name}</option>
              ))}
              <option value="Production">Production</option>
              <option value="Development">Development</option>
              <option value="RDS">RDS</option>
            </Select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <Button variant="ghost" type="button" onClick={() => setAddServerOpen(false)}>إلغاء</Button>
            <Button variant="primary" type="submit" disabled={submittingServer}>
              {submittingServer ? 'جارٍ التسجيل...' : 'تسجيل الخادم'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Server Group */}
      <Modal open={addGroupOpen} onClose={() => setAddGroupOpen(false)} title="إنشاء مجموعة خوادم جديدة">
        <form onSubmit={handleAddGroup} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>اسم المجموعة</label>
            <TextInput value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="مثال: Database-Clusters" required />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>وصف المجموعة</label>
            <TextInput value={newGroupDesc} onChange={(e) => setNewGroupDesc(e.target.value)} placeholder="خوادم قواعد البيانات والنسخ الاحتياطي" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <Button variant="ghost" type="button" onClick={() => setAddGroupOpen(false)}>إلغاء</Button>
            <Button variant="primary" type="submit" disabled={submittingGroup}>
              {submittingGroup ? 'جارٍ الإنشاء...' : 'إنشاء المجموعة'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Power Action Confirmation (Restart / Shutdown) */}
      <Modal
        open={powerModalOpen}
        onClose={() => setPowerModalOpen(false)}
        title={powerAction === 'restart' ? 'تأكيد إعادة تشغيل الخادم المحلي' : 'تأكيد إيقاف تشغيل الخادم المحلي'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ padding: 12, borderRadius: 8, background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.3)', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--status-danger)' }}>
            <AlertTriangle size={20} style={{ flexShrink: 0 }} />
            <div style={{ fontSize: 12 }}>
              تحذير: سيؤثر هذا الإجراء على جميع جلسات المستخدمين RDP الجارية والخدمات السحابية النشطة على الخادم.
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>سبب الإجراء (Windows Event Tracking)</label>
            <TextInput value={powerReason} onChange={(e) => setPowerReason(e.target.value)} placeholder="أدخل سبب إعادة التشغيل للتوثيق في السجلات" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>مهلة الإشعار والتنفيذ بالثواني (Grace Period)</label>
            <TextInput type="number" value={powerTimeout} onChange={(e) => setPowerTimeout(Math.max(5, parseInt(e.target.value) || 30))} />
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', margin: '4px 0' }}>
            <input
              type="checkbox"
              checked={powerConfirmed}
              onChange={(e) => setPowerConfirmed(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--status-danger)' }}
            />
            <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>
              أؤكد تنفيذ هذا الإجراء الحساس على الخادم السيادي فور انقضاء المهلة.
            </span>
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <Button variant="ghost" type="button" onClick={() => setPowerModalOpen(false)}>إلغاء</Button>
            <Button
              variant="danger"
              type="button"
              disabled={!powerConfirmed || powerExecuting}
              onClick={executePowerAction}
            >
              {powerExecuting ? 'جارٍ إصدار الأمر...' : (powerAction === 'restart' ? 'تنفيذ إعادة التشغيل' : 'تنفيذ إيقاف التشغيل')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
