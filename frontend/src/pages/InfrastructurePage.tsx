/**
 * ZIMAM Enterprise v3.0 - Sovereign Windows Server Management
 * Domain 7: Infrastructure (أدوار Windows، ميزات الخادم، الخدمات، المهام المجدولة، التحديثات والشهادات)
 * Zero-Mock Production with Real Windows Server 2025 Standard APIs
 */

import { useState, useEffect } from 'react';
import { Card, Button, Modal, TextInput, useToast } from '../zimam-ui';
import { api } from '../lib/api';
import { apiV1 } from '../lib/apiV1';
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
  Bot,
  Network,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { t } from '../lib/i18n';

type ResultEntry = { job_id: string; completed_at: string | null; result: unknown; error: string | null };

// Heuristic extraction for service.list payloads — falls back to raw JSON.
interface RemoteService { name: string; status: string; start: string; display: string }
function serviceRows(result: unknown): RemoteService[] {
  const arr = Array.isArray(result)
    ? result
    : Array.isArray((result as any)?.services)
      ? (result as any).services
      : null;
  if (!arr) return [];
  const pick = (o: any, ...keys: string[]) => {
    for (const k of keys) { const v = o?.[k]; if (v !== undefined && v !== null && v !== '') return v; }
    return '';
  };
  return arr
    .filter((s: unknown) => s && typeof s === 'object')
    .map((s: any) => ({
      name: String(pick(s, 'Name', 'name', 'ServiceName') || '?'),
      display: String(pick(s, 'DisplayName', 'display_name', 'displayName') || ''),
      status: String(pick(s, 'Status', 'status', 'State', 'state') || ''),
      start: String(pick(s, 'StartType', 'start_type', 'StartMode', 'startMode') || ''),
    }));
}

interface FleetNetAgent {
  id: string;
  name: string;
  status: string;
  hostname?: string | null;
  linked_asset: { id: string; name: string; hostname: string } | null;
  net: ResultEntry | null;
  services: ResultEntry | null;
}

interface NetIface {
  label: string;
  ipv4: string;
  gateway: string;
  dns: string;
  speed: string;
  mac: string;
  up: boolean | null;
}

// Heuristic extraction for network.info payloads — falls back to raw JSON.
function netIfaces(result: unknown): NetIface[] {
  const arr = Array.isArray(result)
    ? result
    : Array.isArray((result as any)?.interfaces)
      ? (result as any).interfaces
      : Array.isArray((result as any)?.adapters)
        ? (result as any).adapters
        : null;
  if (!arr) return [];
  const pick = (o: any, ...keys: string[]) => {
    for (const k of keys) {
      const v = o?.[k];
      if (v !== undefined && v !== null && v !== '') return v;
    }
    return '';
  };
  return arr
    .filter((n: unknown) => n && typeof n === 'object')
    .map((n: any) => {
      const state = String(pick(n, 'Status', 'MediaConnectState', 'state', 'status')).toLowerCase();
      const dns = pick(n, 'DnsServers', 'DNS', 'dns');
      return {
        label: String(pick(n, 'Name', 'InterfaceDescription', 'Description', 'InterfaceAlias', 'name') || '?'),
        ipv4: String(pick(n, 'IPv4Address', 'IPv4', 'IpAddress', 'ip') || ''),
        gateway: String(pick(n, 'DefaultGateway', 'Gateway', 'gateway') || ''),
        dns: Array.isArray(dns) ? dns.join(', ') : String(dns || ''),
        speed: String(pick(n, 'LinkSpeed', 'Speed', 'speed') || ''),
        mac: String(pick(n, 'MacAddress', 'PhysicalAddress', 'MAC', 'mac') || ''),
        up: state ? /up|connect|enabled/.test(state) : null,
      };
    });
}

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

  // 6. ZIMAM agent network telemetry
  const [fleetNet, setFleetNet] = useState<FleetNetAgent[]>([]);

  const loadFleetNet = async () => {
    try {
      const fleetRes = await apiV1.fleetSummary();
      if (!fleetRes?.agents?.length) { setFleetNet([]); return; }
      const detailed = await Promise.all(
        fleetRes.agents.map(async (ag) => {
          let net: ResultEntry | null = null;
          let services: ResultEntry | null = null;
          const r = await apiV1.agentLatestResults(ag.id).catch(() => null);
          net = r?.results?.['network.info'] ?? null;
          services = r?.results?.['service.list'] ?? null;
          return { ...ag, net, services };
        }),
      );
      setFleetNet(detailed);
    } catch {
      setFleetNet([]);
    }
  };

  useEffect(() => {
    loadFleetNet();
  }, []);

  const fetchRoles = async (refresh = false) => {
    try {
      const res = await api.getRoles(refresh);
      setRoles(res?.roles || []);
    } catch (err: any) {
      toast(err.message || t('فشل جلب أدوار الخادم'), 'error');
    }
  };

  const fetchServices = async (q = '') => {
    try {
      const res = await api.getServicesList(q);
      setServices(res?.services || []);
    } catch (err: any) {
      toast(err.message || t('فشل جلب خدمات النظام'), 'error');
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await api.getTasksList();
      setTasks(res?.tasks || []);
    } catch (err: any) {
      toast(err.message || t('فشل جلب المهام المجدولة'), 'error');
    }
  };

  const fetchUpdates = async () => {
    try {
      const res = await api.getUpdates();
      setUpdatesData(res);
    } catch (err: any) {
      toast(err.message || t('فشل جلب تحديثات الخادم'), 'error');
    }
  };

  const fetchCerts = async () => {
    try {
      const res = await api.getCertificatesList();
      setCerts(res?.certificates || []);
    } catch (err: any) {
      toast(err.message || t('فشل جلب شهادات النظام'), 'error');
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
        toast(`${t('تم بنجاح أمر ')}${isInstalled ? t('إزالة') : t('تثبيت')}${t(' الدور [')}${selectedRole.display_name}].`, 'success');
        setRoleModalOpen(false);
        fetchRoles(true);
      } else {
        toast(res.error || t('فشلت معالجة طلب الدور'), 'error');
      }
    } catch (err: any) {
      toast(err.message || t('خطأ أثناء تنفيذ الإجراء'), 'error');
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
        toast(`${t('تم إرسال أمر ')}${action}${t(' للخدمة [')}${serviceName}${t('] بنجاح')}`, 'success');
        fetchServices(serviceSearch);
      } else {
        toast(res.error || `${t('فشل أمر ')}${action}${t(' للخدمة')}`, 'error');
      }
    } catch (err: any) {
      toast(err.message || t('خطأ أثناء التحكم بالخدمة'), 'error');
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
            <span>{t('البنية التحتية والخدمات (Windows Server Core & SCM)')}</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-3)' }}>
            {t('لوحة إدارة مركزية لأدوار وميزات السيرفر، خدمات Windows Service Control Manager، المهام المجدولة، والتحديثات.')}
          </p>
        </div>
        <Button variant="ghost" onClick={fetchTabData} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          <span>{t('تحديث')}</span>
        </Button>
      </div>

      {/* ZIMAM agent networks — real network.info collector data */}
      {fleetNet.length > 0 && (
        <Card style={{ padding: 22, border: '1px solid var(--glass-rim)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Network size={18} style={{ color: 'var(--accent)' }} />
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--text-1)' }}>{t('شبكات وكلاء زِمام')}</h3>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('network.info حقيقية: IP وDNS والبوابة والسرعة لكل وكيل')}</span>
            </div>
            <NavLink to="/agents" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>
              {t('إدارة الوكلاء')} ←
            </NavLink>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {fleetNet.map((ag) => {
              const ifaces = ag.net && !ag.net.error ? netIfaces(ag.net.result) : [];
              return (
                <div key={ag.id} style={{ border: '1px solid var(--hairline)', borderRadius: 12, padding: '14px 16px', background: 'var(--glass-tint)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Bot size={15} style={{ color: 'var(--accent)' }} />
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{ag.linked_asset?.name || ag.name}</span>
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: ag.status === 'online' ? 'var(--paid-bg)' : 'var(--surface-glass-tint)', color: ag.status === 'online' ? 'var(--paid)' : 'var(--text-3)' }}>
                      {ag.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-telemetry)', direction: 'ltr', textAlign: 'left', marginBottom: 10 }}>
                    {ag.hostname || ag.id.slice(0, 8)}
                  </div>
                  {!ag.net ? (
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('لم يُرسل جامع الشبكة بعد — أرسله من صفحة الوكلاء.')}</div>
                  ) : ag.net.error ? (
                    <div className="text-status-danger" style={{ fontSize: 11 }}>{ag.net.error}</div>
                  ) : ifaces.length === 0 ? (
                    <details style={{ fontSize: 11 }}>
                      <summary style={{ cursor: 'pointer', color: 'var(--text-3)' }}>{t('نتيجة غير معروفة — عرض خام')}</summary>
                      <pre dir="ltr" style={{ margin: '8px 0 0', fontSize: 10, fontFamily: 'var(--font-telemetry)', color: 'var(--text-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 160, overflowY: 'auto' }}>
                        {JSON.stringify(ag.net.result, null, 2)}
                      </pre>
                    </details>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {ifaces.slice(0, 6).map((n, i) => (
                        <div key={i} style={{ border: '1px solid var(--hairline)', borderRadius: 8, padding: '8px 10px', background: 'var(--surface-ground)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{n.label}</span>
                            <span style={{ fontSize: 10, color: n.up === false ? 'var(--unpaid)' : 'var(--paid)' }}>
                              {n.up === true ? t('متصل') : n.up === false ? t('غير متصل') : ''}{n.speed ? ` · ${n.speed}` : ''}
                            </span>
                          </div>
                          {n.ipv4 && <div style={{ fontSize: 10, color: 'var(--text-2)', fontFamily: 'var(--font-telemetry)', direction: 'ltr', textAlign: 'left' }}>IP: {n.ipv4}</div>}
                          {n.gateway && <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-telemetry)', direction: 'ltr', textAlign: 'left' }}>GW: {n.gateway}</div>}
                          {n.dns && <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-telemetry)', direction: 'ltr', textAlign: 'left', wordBreak: 'break-all' }}>DNS: {n.dns}</div>}
                          {n.mac && <div style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-telemetry)', direction: 'ltr', textAlign: 'left' }}>MAC: {n.mac}</div>}
                        </div>
                      ))}
                      {ifaces.length > 6 && <div style={{ fontSize: 10, color: 'var(--text-3)' }}>+{ifaces.length - 6} {t('واجهة أخرى')}</div>}
                      {ag.net.completed_at && (
                        <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{t('آخر قياس')}: {new Date(ag.net.completed_at).toLocaleString('ar-SA')}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* ZIMAM remote agent services — real service.list collector data */}
      {fleetNet.length > 0 && (
        <Card style={{ padding: 22, border: '1px solid var(--glass-rim)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Cog size={18} style={{ color: 'var(--accent)' }} />
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--text-1)' }}>{t('خدمات وكلاء زِمام')}</h3>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('service.list حقيقية: حالة وخدمة بدء كل خدمة على كل وكيل')}</span>
            </div>
            <NavLink to="/agents" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>
              {t('إدارة الوكلاء')} ←
            </NavLink>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {fleetNet.map((ag) => {
              const svcs = ag.services && !ag.services.error ? serviceRows(ag.services.result) : [];
              const running = svcs.filter((s) => /run|active|started/i.test(s.status)).length;
              return (
                <div key={ag.id} style={{ border: '1px solid var(--hairline)', borderRadius: 12, padding: '14px 16px', background: 'var(--glass-tint)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{ag.linked_asset?.name || ag.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: ag.status === 'online' ? 'var(--paid-bg)' : 'var(--surface-glass-tint)', color: ag.status === 'online' ? 'var(--paid)' : 'var(--text-3)' }}>
                      {ag.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-telemetry)', direction: 'ltr', textAlign: 'left', marginBottom: 10 }}>
                    {ag.hostname || ag.id.slice(0, 8)}
                    {svcs.length > 0 ? ` · ${svcs.length} ${t('خدمة')} (${running} ${t('تعمل')})` : ''}
                  </div>
                  {!ag.services ? (
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('لم يُرسل جامع الخدمات بعد — أرسله من صفحة الوكلاء.')}</div>
                  ) : ag.services.error ? (
                    <div className="text-status-danger" style={{ fontSize: 11 }}>{ag.services.error}</div>
                  ) : svcs.length === 0 ? (
                    <details style={{ fontSize: 11 }}>
                      <summary style={{ cursor: 'pointer', color: 'var(--text-3)' }}>{t('نتيجة غير معروفة — عرض خام')}</summary>
                      <pre dir="ltr" style={{ margin: '8px 0 0', fontSize: 10, fontFamily: 'var(--font-telemetry)', color: 'var(--text-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 160, overflowY: 'auto' }}>
                        {JSON.stringify(ag.services.result, null, 2)}
                      </pre>
                    </details>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
                      {svcs.slice(0, 40).map((s, i) => (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 10, padding: '5px 8px', borderRadius: 6, background: 'var(--surface-ground)' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'left' }} title={s.display || s.name}>
                            {s.display || s.name}
                          </span>
                          <span style={{ display: 'flex', gap: 6, flexShrink: 0, color: 'var(--text-3)' }}>
                            {s.start && <span style={{ fontSize: 9 }}>{s.start}</span>}
                            <span style={{ color: /run|active|started/i.test(s.status) ? 'var(--paid)' : 'var(--unpaid)' }}>{s.status || '—'}</span>
                          </span>
                        </div>
                      ))}
                      {svcs.length > 40 && <div style={{ fontSize: 10, color: 'var(--text-3)' }}>+{svcs.length - 40} {t('خدمة أخرى')}</div>}
                      {ag.services.completed_at && (
                        <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{t('آخر قياس')}: {new Date(ag.services.completed_at).toLocaleString('ar-SA')}</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

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
          <span>{t('أدوار وميزات السيرفر (Roles & Features)')}</span>
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
          <span>{t('خدمات Windows')} (Services - {services.length})</span>
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
          <span>{t('المهام المجدولة (Task Scheduler)')}</span>
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
          <span>{t('تحديثات النظام (Windows Updates)')}</span>
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
          <span>{t('خزنة الشهادات (Certificates)')}</span>
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
                  placeholder={t('بحث في الأدوار والميزات...')}
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
                {t('المثبتة فقط')}
              </Button>
              <Button
                variant={rolesFilter === 'available' ? 'primary' : 'ghost'}
                onClick={() => setRolesFilter('available')}
                style={{ fontSize: 12 }}
              >
                {t('المتاحة للتثبيت')}
              </Button>
              <Button
                variant={rolesFilter === 'all' ? 'primary' : 'ghost'}
                onClick={() => setRolesFilter('all')}
                style={{ fontSize: 12 }}
              >
                {t('الكل')} ({roles.length})
              </Button>
            </div>
          </div>

          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
                <thead>
                  <tr style={{ background: 'var(--glass-tint)', borderBottom: '1px solid var(--glass-rim)' }}>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('اسم الدور / الميزة')}</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('المعرف التقني')}</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('الحالة')}</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700, textAlign: 'end' }}>{t('إجراء المعالج')}</th>
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
                          {r.installed ? t('مثبّت ونشط') : t('متاح للتثبيت')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'end' }}>
                        <Button
                          variant={r.installed ? 'secondary' : 'primary'}
                          onClick={() => handleToggleRoleModal(r)}
                          style={{ fontSize: 11, padding: '4px 10px' }}
                        >
                          {r.installed ? t('إزالة الدور') : t('تثبيت الدور')}
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
                  placeholder={t('بحث سريع في الخدمات (مثال: RpcSs, TermService, WinRM)...')}
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
                {t('قيد التشغيل (Running)')}
              </Button>
              <Button
                variant={serviceStatusFilter === 'stopped' ? 'primary' : 'ghost'}
                onClick={() => setServiceStatusFilter('stopped')}
                style={{ fontSize: 12 }}
              >
                {t('متوقفة (Stopped)')}
              </Button>
              <Button
                variant={serviceStatusFilter === 'all' ? 'primary' : 'ghost'}
                onClick={() => setServiceStatusFilter('all')}
                style={{ fontSize: 12 }}
              >
                {t('كافة الخدمات')} ({services.length})
              </Button>
            </div>
          </div>

          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto', maxHeight: '600px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ background: 'var(--surface-ground)', borderBottom: '1px solid var(--glass-rim)' }}>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('اسم الخدمة')}</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('الاسم البرمجي')}</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('نوع البدء')}</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('الحالة')}</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700, textAlign: 'end' }}>{t('التحكم بالخدمة')}</th>
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
                          {s.status === 'running' ? t('قيد التشغيل') : t('متوقفة')}
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
                              title={t('تشغيل الخدمة')}
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
                              title={t('إيقاف الخدمة')}
                            >
                              <Square size={14} />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            disabled={controllingService === s.name}
                            onClick={() => handleControlService(s.name, 'restart')}
                            style={{ color: 'var(--accent)', padding: 6 }}
                            title={t('إعادة تشغيل الخدمة')}
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
              placeholder={t('بحث في المهام المجدولة...')}
              style={{ paddingRight: 36 }}
            />
          </div>

          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto', maxHeight: '500px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
                <thead>
                  <tr style={{ background: 'var(--glass-tint)', borderBottom: '1px solid var(--glass-rim)' }}>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('اسم المهمة')}</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('المسار في Task Scheduler')}</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('الحالة')}</th>
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
                <strong>{t('تنبيه: يتطلب النظام إعادة تشغيل لإكمال تطبيق تحديثات الأمان!')}</strong>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                  {t('سجل Windows Registry يشير إلى وجود تحديثات مجمعة مثبتة بانتظار إعادة التشغيل.')}
                </div>
              </div>
            </div>
          )}

          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--glass-rim)', fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>
              {t('سجل التحديثات المثبتة (Hotfixes & Security Patches)')}
            </div>
            <div style={{ overflowX: 'auto', maxHeight: '500px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
                <thead>
                  <tr style={{ background: 'var(--glass-tint)', borderBottom: '1px solid var(--glass-rim)' }}>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('معرف التحديث (HotFix ID)')}</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('الوصف')}</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('تاريخ التثبيت')}</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('مثبت بواسطة')}</th>
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
                        {h.InstalledOn || t('غير محدد')}
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
            {t('شهادات الأمان المحلية')} (LocalMachine\My Store)
          </div>
          <div style={{ overflowX: 'auto', maxHeight: '500px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
              <thead>
                <tr style={{ background: 'var(--glass-tint)', borderBottom: '1px solid var(--glass-rim)' }}>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('الموضوع (Subject)')}</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('الجهة المصدرة (Issuer)')}</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('تاريخ الانتهاء')}</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('البصمة (Thumbprint)')}</th>
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
        title={selectedRole?.installed ? t('إزالة دور من الخادم') : t('تثبيت دور وميزة على الخادم')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
            هل ترغب في {selectedRole?.installed ? t('إلغاء تثبيت') : t('تثبيت')} الدور التالي عبر Server Manager؟
          </div>
          <div style={{ padding: 12, borderRadius: 8, background: 'var(--glass-tint)', border: '1px solid var(--glass-rim)' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>{selectedRole?.display_name}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)', marginTop: 2 }}>{selectedRole?.name}</div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <Button variant="ghost" onClick={() => setRoleModalOpen(false)}>{t('إلغاء')}</Button>
            <Button
              variant={selectedRole?.installed ? 'danger' : 'primary'}
              disabled={roleActionExecuting}
              onClick={handleExecuteRoleAction}
            >
              {roleActionExecuting ? t('جارٍ المعالجة عبر Action Engine...') : (selectedRole?.installed ? t('تأكيد الإزالة') : t('تأكيد التثبيت'))}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
