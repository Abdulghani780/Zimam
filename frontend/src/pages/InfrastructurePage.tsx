/**
 * ASAAS Enterprise v3.0 - Sovereign Windows Server Management
 * Domain 7: Infrastructure — fleet collectors (windows.features, service.list,
 * scheduled.tasks, hotfix.list) via /api/v1 agents results/latest.
 * The certificates tab still uses the legacy local-server API (no collector yet).
 * All collector data is read-only; there are no agent write job types for
 * service control or role install yet.
 */

import { useState, useEffect, useMemo } from 'react';
import { Card, Button, TextInput, useToast } from '../asaas-ui';
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
      : result && typeof result === 'object'
        && ['name', 'Name', 'ServiceName', 'service_name'].some((k) => (result as any)[k] !== undefined)
        ? [result]
        : null;
  if (!arr) return [];
  const pick = (o: any, ...keys: string[]) => {
    for (const k of keys) { const v = o?.[k]; if (v !== undefined && v !== null && v !== '') return v; }
    return '';
  };
  return arr
    .filter((s: unknown) => s && typeof s === 'object')
    .map((s: any) => ({
      name: String(pick(s, 'Name', 'name', 'ServiceName', 'service_name') || '?'),
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
  features: ResultEntry | null;
  tasks: ResultEntry | null;
  hotfixes: ResultEntry | null;
  certs: ResultEntry | null;
}

// Generic row extraction for agent collector payloads (array or {items|...}).
function agentRows(result: unknown, ...keys: string[]): any[] {
  let arr: unknown = result;
  if (!Array.isArray(arr) && arr && typeof arr === 'object') {
    for (const k of keys) {
      const v = (arr as any)[k];
      if (Array.isArray(v)) { arr = v; break; }
    }
  }
  return Array.isArray(arr) ? arr.filter((x) => x && typeof x === 'object') : [];
}

// PowerShell collectors (scheduled.tasks, hotfix.list, ...) serialize a single
// row as a bare object instead of a one-element array — wrap it so row
// extraction stays uniform. Wrapper objects ({count, items,...}) are skipped.
function asItemArray(result: unknown, ...keys: string[]): any[] {
  const rows = agentRows(result, ...keys);
  if (rows.length > 0) return rows;
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    const o = result as Record<string, unknown>;
    const isWrapper = keys.some((k) => o[k] !== undefined) || o.count !== undefined || o.observed_at !== undefined;
    if (!isWrapper) return [o];
  }
  return [];
}

const pickField = (o: any, ...keys: string[]) => {
  for (const k of keys) {
    const v = o?.[k];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return '';
};

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

interface AgentRef {
  id: string;
  label: string;
  status: string;
  hostname: string;
}

function agentRef(ag: FleetNetAgent): AgentRef {
  return {
    id: ag.id,
    label: ag.linked_asset?.name || ag.name,
    status: ag.status,
    hostname: ag.hostname || ag.linked_asset?.hostname || ag.id.slice(0, 8),
  };
}

interface ServiceFleetRow extends RemoteService { agent: AgentRef; agentId: string; completedAt: string | null }
interface FeatureFleetRow { agent: AgentRef; agentId: string; completedAt: string | null; name: string; state: string; installed: boolean; available: boolean }
interface TaskFleetRow { agent: AgentRef; agentId: string; completedAt: string | null; name: string; path: string; state: string }
interface HotfixFleetRow { agent: AgentRef; completedAt: string | null; id: string; description: string; installedOn: string }

const isServiceRunning = (status: string) => /run|active|started/i.test(status);
const isServiceStopped = (status: string) => /^stop|paused/i.test(status);

export function InfrastructurePage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'roles' | 'services' | 'tasks' | 'updates' | 'certs'>('roles');
  const [loading, setLoading] = useState(false);

  // Fleet collector state — one entry per job_type per agent.
  const [fleetNet, setFleetNet] = useState<FleetNetAgent[]>([]);

  // Tab filters (client-side over fleet rows)
  const [rolesSearch, setRolesSearch] = useState('');
  const [rolesFilter, setRolesFilter] = useState<'all' | 'installed' | 'available'>('installed');
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceStatusFilter, setServiceStatusFilter] = useState<'all' | 'running' | 'stopped'>('all');
  const [tasksSearch, setTasksSearch] = useState('');
  const [svcBusy, setSvcBusy] = useState<string | null>(null);
  const [taskBusy, setTaskBusy] = useState<string | null>(null);
  const [featBusy, setFeatBusy] = useState<string | null>(null);
  const [certBusy, setCertBusy] = useState<string | null>(null);
  const [hotfixBusy, setHotfixBusy] = useState<string | null>(null);
  const [hotfixPaths, setHotfixPaths] = useState<Record<string, string>>({});

  // Certificates still come from the legacy local-server API.
  const [certs, setCerts] = useState<any[]>([]);

  const loadFleetNet = async () => {
    try {
      const fleetRes = await apiV1.fleetSummary();
      if (!fleetRes?.agents?.length) { setFleetNet([]); return; }
      const detailed = await Promise.all(
        fleetRes.agents.map(async (ag) => {
          let net: ResultEntry | null = null;
          let services: ResultEntry | null = null;
          let features: ResultEntry | null = null;
          let tasks: ResultEntry | null = null;
          let hotfixes: ResultEntry | null = null;
          let certs: ResultEntry | null = null;
          const r = await apiV1.agentLatestResults(ag.id).catch(() => null);
          net = r?.results?.['network.info'] ?? null;
          services = r?.results?.['service.list'] ?? null;
          features = r?.results?.['windows.features'] ?? null;
          tasks = r?.results?.['scheduled.tasks'] ?? null;
          hotfixes = r?.results?.['hotfix.list'] ?? null;
          certs = r?.results?.['cert.list'] ?? null;
          return { ...ag, net, services, features, tasks, hotfixes, certs };
        }),
      );
      setFleetNet(detailed);
    } catch {
      setFleetNet([]);
    }
  };

  // Signed agent write job: start/stop/restart a service on its host agent.
  const queueServiceControl = async (svc: ServiceFleetRow, action: 'start' | 'stop' | 'restart') => {
    const key = `${svc.agentId}:${svc.name}:${action}`;
    setSvcBusy(key);
    try {
      await apiV1.createJob({ agent_id: svc.agentId, job_type: 'service.control', payload: { name: svc.name, action } });
      toast(t('تم إرسال أمر الخدمة — ينفذ على الوكيل خلال ~15 ثانية'), 'success');
    } catch (err: any) {
      toast(err?.message || t('فشل إرسال أمر الخدمة'), 'error');
    } finally {
      setSvcBusy(null);
    }
  };

  // Signed agent write job: run/enable/disable a scheduled task on its host agent.
  const queueTaskControl = async (tk: TaskFleetRow, action: 'run' | 'enable' | 'disable') => {
    const key = `${tk.agentId}:${tk.name}:${action}`;
    setTaskBusy(key);
    try {
      await apiV1.createJob({
        agent_id: tk.agentId,
        job_type: 'task.control',
        payload: { task_name: tk.name, task_path: tk.path || '\\', action },
      });
      toast(t('تم إرسال أمر المهمة — ينفذ على الوكيل خلال ~15 ثانية'), 'success');
    } catch (err: any) {
      toast(err?.message || t('فشل إرسال أمر المهمة'), 'error');
    } finally {
      setTaskBusy(null);
    }
  };

  // Signed agent write job: enable/disable a Windows optional feature.
  const queueFeatureToggle = async (f: FeatureFleetRow, action: 'enable' | 'disable') => {
    const key = `${f.agentId}:${f.name}:${action}`;
    if (!window.confirm(t(`${action === 'enable' ? 'تفعيل' : 'تعطيل'} الميزة ${f.name} على ${f.agent.label}؟ قد يتطلب إعادة تشغيل.`))) return;
    setFeatBusy(key);
    try {
      await apiV1.createJob({ agent_id: f.agentId, job_type: 'feature.toggle', payload: { feature_name: f.name, action } });
      toast(t('تم إرسال أمر الميزة — ينفذ على الوكيل خلال ~15 ثانية'), 'success');
    } catch (err: any) {
      toast(err?.message || t('فشل إرسال الأمر'), 'error');
    } finally {
      setFeatBusy(null);
    }
  };

  // Signed agent write job: remove a certificate from LocalMachine\My by thumbprint.
  const queueCertRemove = async (agentId: string, thumbprint: string, subject: string, hostName: string) => {
    const key = `${agentId}:${thumbprint}`;
    if (!window.confirm(t(`حذف الشهادة «${subject}» من ${hostName}؟ لا يمكن التراجع.`))) return;
    setCertBusy(key);
    try {
      await apiV1.createJob({ agent_id: agentId, job_type: 'cert.remove', payload: { thumbprint, store: 'My' } });
      toast(t('تم إرسال أمر حذف الشهادة — ينفذ على الوكيل خلال ~15 ثانية'), 'success');
    } catch (err: any) {
      toast(err?.message || t('فشل إرسال الأمر'), 'error');
    } finally {
      setCertBusy(null);
    }
  };

  // Signed agent write job: install a local .msu hotfix package on the agent.
  const queueHotfixInstall = async (agentId: string, hostName: string) => {
    const path = (hotfixPaths[agentId] || '').trim();
    if (!path) { toast(t('أدخل مسار ملف .msu على الوكيل أولاً'), 'error'); return; }
    if (!window.confirm(t(`تثبيت التحديث ${path} على ${hostName}؟ قد يتطلب إعادة تشغيل.`))) return;
    setHotfixBusy(agentId);
    try {
      await apiV1.createJob({ agent_id: agentId, job_type: 'hotfix.install', payload: { path } });
      toast(t('تم إرسال أمر التثبيت — ينفذ على الوكيل خلال ~15 ثانية'), 'success');
    } catch (err: any) {
      toast(err?.message || t('فشل إرسال الأمر'), 'error');
    } finally {
      setHotfixBusy(null);
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

  const refreshAll = async () => {
    setLoading(true);
    try {
      await loadFleetNet();
      if (activeTab === 'certs') await fetchCerts();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFleetNet();
    const timer = window.setInterval(loadFleetNet, 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeTab === 'certs') fetchCerts();
  }, [activeTab]);

  // --- Fleet row extraction (one row per agent item, tagged with its agent) ---
  const fleetServices = useMemo<ServiceFleetRow[]>(() => fleetNet.flatMap((ag) => {
    const entry = ag.services;
    if (!entry || entry.error) return [];
    return serviceRows(entry.result).map((s) => ({ ...s, agent: agentRef(ag), agentId: ag.id, completedAt: entry.completed_at }));
  }), [fleetNet]);

  const fleetFeatures = useMemo<FeatureFleetRow[]>(() => fleetNet.flatMap((ag) => {
    const entry = ag.features;
    if (!entry || entry.error) return [];
    return asItemArray(entry.result, 'items', 'features').map((f) => {
      const state = String(pickField(f, 'state', 'State') || '');
      return {
        agent: agentRef(ag),
        agentId: ag.id,
        completedAt: entry.completed_at,
        name: String(pickField(f, 'name', 'Name', 'FeatureName') || '?'),
        state,
        installed: /^enabled/i.test(state),
        available: /^disabled/i.test(state),
      };
    });
  }), [fleetNet]);

  const fleetTasks = useMemo<TaskFleetRow[]>(() => fleetNet.flatMap((ag) => {
    const entry = ag.tasks;
    if (!entry || entry.error) return [];
    return asItemArray(entry.result, 'tasks', 'items').map((tk) => ({
      agent: agentRef(ag),
      agentId: ag.id,
      completedAt: entry.completed_at,
      name: String(pickField(tk, 'TaskName', 'name', 'taskName') || '?'),
      path: String(pickField(tk, 'TaskPath', 'path') || ''),
      state: String(pickField(tk, 'State', 'state') || ''),
    }));
  }), [fleetNet]);

  const fleetHotfixes = useMemo<HotfixFleetRow[]>(() => fleetNet.flatMap((ag) => {
    const entry = ag.hotfixes;
    if (!entry || entry.error) return [];
    return asItemArray(entry.result, 'items', 'hotfixes').map((f) => ({
      agent: agentRef(ag),
      completedAt: entry.completed_at,
      id: String(pickField(f, 'id', 'HotFixID', 'hotfix_id') || '?'),
      description: String(pickField(f, 'description', 'Description') || ''),
      installedOn: String(pickField(f, 'installed_on', 'InstalledOn', 'installedOn') || ''),
    }));
  }), [fleetNet]);

  // --- Filters ---
  const agentMatches = (agent: AgentRef, q: string) =>
    agent.label.toLowerCase().includes(q) || agent.hostname.toLowerCase().includes(q);

  const filteredFeatures = fleetFeatures.filter((f) => {
    const q = rolesSearch.toLowerCase();
    const match = !q || f.name.toLowerCase().includes(q) || agentMatches(f.agent, q);
    if (!match) return false;
    if (rolesFilter === 'installed') return f.installed;
    if (rolesFilter === 'available') return f.available;
    return true;
  });

  const filteredServices = fleetServices.filter((s) => {
    const q = serviceSearch.toLowerCase();
    const match = !q
      || s.display.toLowerCase().includes(q)
      || s.name.toLowerCase().includes(q)
      || agentMatches(s.agent, q);
    if (!match) return false;
    if (serviceStatusFilter === 'running') return isServiceRunning(s.status);
    if (serviceStatusFilter === 'stopped') return isServiceStopped(s.status);
    return true;
  });

  const filteredTasks = fleetTasks.filter((tk) => {
    const q = tasksSearch.toLowerCase();
    return !q || tk.name.toLowerCase().includes(q) || tk.path.toLowerCase().includes(q) || agentMatches(tk.agent, q);
  });

  // Honest empty state: per-agent collector status + raw payload fallback.
  const renderCollectorEmpty = (key: 'services' | 'features' | 'tasks' | 'hotfixes', label: string) => (
    <Card style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
        {t('لا توجد صفوف من جامع')} {label}{t(' بعد. أرسله من صفحة الوكلاء ثم حدّث.')}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {fleetNet.map((ag) => {
          const entry = ag[key];
          const name = ag.linked_asset?.name || ag.name;
          if (!entry) {
            return <div key={ag.id} style={{ fontSize: 11, color: 'var(--text-3)' }}>{name} — {t('لم يُرسل الجامع بعد')}</div>;
          }
          if (entry.error) {
            return <div key={ag.id} className="text-status-danger" style={{ fontSize: 11 }}>{name} — {entry.error}</div>;
          }
          return (
            <details key={ag.id} style={{ fontSize: 11 }}>
              <summary style={{ cursor: 'pointer', color: 'var(--text-3)' }}>{name} — {t('نتيجة مستلمة — عرض خام')}</summary>
              <pre dir="ltr" style={{ margin: '8px 0 0', fontSize: 10, fontFamily: 'var(--font-telemetry)', color: 'var(--text-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 160, overflowY: 'auto' }}>
                {JSON.stringify(entry.result, null, 2)}
              </pre>
            </details>
          );
        })}
      </div>
      <div>
        <NavLink to="/agents" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>
          {t('إدارة الوكلاء وإرسال الجامعين')} ←
        </NavLink>
      </div>
    </Card>
  );

  const renderNoAgents = () => (
    <Card style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
        {t('لا يوجد وكلاء ASAAS مسجلون بعد. سجّل وكيلاً من صفحة الوكلاء لتفعيل بيانات الأسطول هنا.')}
      </div>
      <div>
        <NavLink to="/agents" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>
          {t('إدارة الوكلاء')} ←
        </NavLink>
      </div>
    </Card>
  );

  const agentCell = (agent: AgentRef, completedAt: string | null) => (
    <td style={{ padding: '12px 16px' }}>
      <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-1)' }}>{agent.label}</div>
      <div
        style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-telemetry)', direction: 'ltr', textAlign: 'left' }}
        title={completedAt ? `${t('آخر قياس')}: ${new Date(completedAt).toLocaleString('ar-SA')}` : undefined}
      >
        {agent.hostname}
      </div>
    </td>
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
            {t('لوحة إدارة مركزية لأدوار وميزات السيرفر، خدمات Windows Service Control Manager، المهام المجدولة، والتحديثات — بيانات حية من وكلاء أساس.')}
          </p>
        </div>
        <Button variant="ghost" onClick={refreshAll} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          <span>{t('تحديث')}</span>
        </Button>
      </div>

      {/* ASAAS agent networks — real network.info collector data */}
      {fleetNet.length > 0 && (
        <Card style={{ padding: 22, border: '1px solid var(--glass-rim)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Network size={18} style={{ color: 'var(--accent)' }} />
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--text-1)' }}>{t('شبكات وكلاء أساس')}</h3>
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

      {/* ASAAS remote agent services — real service.list collector data */}
      {fleetNet.length > 0 && (
        <Card style={{ padding: 22, border: '1px solid var(--glass-rim)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Cog size={18} style={{ color: 'var(--accent)' }} />
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--text-1)' }}>{t('خدمات وكلاء أساس')}</h3>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('service.list حقيقية: حالة ونوع بدء كل خدمة على كل وكيل')}</span>
            </div>
            <NavLink to="/agents" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>
              {t('إدارة الوكلاء')} ←
            </NavLink>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {fleetNet.map((ag) => {
              const svcs = ag.services && !ag.services.error ? serviceRows(ag.services.result) : [];
              const running = svcs.filter((s) => isServiceRunning(s.status)).length;
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
                            <span style={{ color: isServiceRunning(s.status) ? 'var(--paid)' : 'var(--unpaid)' }}>{s.status || '—'}</span>
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

      {/* ASAAS remote agent roles/tasks/hotfixes — real collector data */}
      {fleetNet.length > 0 && (
        <Card style={{ padding: 22, border: '1px solid var(--glass-rim)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Layers size={18} style={{ color: 'var(--accent)' }} />
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--text-1)' }}>{t('أدوار ومهام مجدولة وتحديثات وكلاء أساس')}</h3>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('windows.features + scheduled.tasks + hotfix.list حقيقية لكل وكيل')}</span>
            </div>
            <NavLink to="/agents" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>
              {t('إدارة الوكلاء')} ←
            </NavLink>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
            {fleetNet.map((ag) => {
              const feats = ag.features && !ag.features.error ? asItemArray(ag.features.result, 'items', 'features') : [];
              const featEnabled = feats.filter((f) => /^enabled/i.test(String(pickField(f, 'state', 'State'))));
              const tasks = ag.tasks && !ag.tasks.error ? asItemArray(ag.tasks.result, 'tasks', 'items') : [];
              const fixes = ag.hotfixes && !ag.hotfixes.error ? asItemArray(ag.hotfixes.result, 'items', 'hotfixes') : [];
              const anyData = feats.length + tasks.length + fixes.length;
              const lastAt = [ag.features?.completed_at, ag.tasks?.completed_at, ag.hotfixes?.completed_at]
                .filter(Boolean).sort().pop();
              return (
                <div key={ag.id} style={{ border: '1px solid var(--hairline)', borderRadius: 12, padding: '14px 16px', background: 'var(--glass-tint)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{ag.linked_asset?.name || ag.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: ag.status === 'online' ? 'var(--paid-bg)' : 'var(--surface-glass-tint)', color: ag.status === 'online' ? 'var(--paid)' : 'var(--text-3)' }}>
                      {ag.status}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-telemetry)', direction: 'ltr', textAlign: 'left', marginBottom: 10 }}>
                    {ag.hostname || ag.id.slice(0, 8)}
                    {anyData > 0 ? ` · ${feats.length} ${t('ميزة')} · ${tasks.length} ${t('مهمة')} · ${fixes.length} ${t('تحديث')}` : ''}
                  </div>
                  {anyData === 0 ? (
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                      {!ag.features && !ag.tasks && !ag.hotfixes
                        ? t('لم تُرسل هذه القياسات بعد — أرسلها من صفحة الوكلاء.')
                        : t('لا بيانات — راجع أخطاء الجامعين أدناه.')}
                      {ag.features?.error && <div className="text-status-danger" style={{ marginTop: 4 }}>{t('ميزات:')} {ag.features.error}</div>}
                      {ag.tasks?.error && <div className="text-status-danger" style={{ marginTop: 4 }}>{t('مهام:')} {ag.tasks.error}</div>}
                      {ag.hotfixes?.error && <div className="text-status-danger" style={{ marginTop: 4 }}>{t('تحديثات:')} {ag.hotfixes.error}</div>}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {feats.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 4 }}>
                            {t('الأدوار والميزات المفعّلة')} ({featEnabled.length}/{feats.length})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 90, overflowY: 'auto' }}>
                            {feats.filter((f) => /^enabled/i.test(String(pickField(f, 'state', 'State')))).slice(0, 12).map((f, i) => (
                              <div key={i} style={{ fontSize: 10, color: 'var(--text-2)', fontFamily: 'var(--font-telemetry)', direction: 'ltr', textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {pickField(f, 'name', 'Name', 'FeatureName')}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {tasks.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 4 }}>
                            {t('المهام المجدولة')} ({tasks.length})
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 90, overflowY: 'auto' }}>
                            {tasks.slice(0, 12).map((tk, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 10, padding: '3px 6px', borderRadius: 5, background: 'var(--surface-ground)' }}>
                                <span style={{ color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'left' }}>
                                  {pickField(tk, 'TaskName', 'name', 'taskName')}
                                </span>
                                <span style={{ color: 'var(--text-3)', flexShrink: 0 }}>{pickField(tk, 'State', 'state')}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {fixes.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 4 }}>
                            {t('آخر التحديثات المثبتة')}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {fixes.slice(0, 8).map((f, i) => (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 10, padding: '3px 6px', borderRadius: 5, background: 'var(--surface-ground)' }}>
                                <span style={{ color: 'var(--text-2)', fontFamily: 'var(--font-telemetry)', direction: 'ltr' }}>
                                  {pickField(f, 'id', 'HotFixID', 'hotfix_id')}
                                </span>
                                <span style={{ color: 'var(--text-3)' }}>{pickField(f, 'installed_on', 'InstalledOn', 'installedOn')}</span>
                              </div>
                            ))}
                          </div>
                          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                            <TextInput
                              value={hotfixPaths[ag.id] || ''}
                              onChange={(e: any) => setHotfixPaths((prev) => ({ ...prev, [ag.id]: e.target.value }))}
                              placeholder={t('C:\\Updates\\KBxxxx.msu')}
                              style={{ flex: 1, fontSize: 11, direction: 'ltr', textAlign: 'left' }}
                            />
                            <Button
                              variant="secondary"
                              disabled={hotfixBusy !== null}
                              onClick={() => void queueHotfixInstall(ag.id, ag.hostname || ag.linked_asset?.name || ag.name)}
                              style={{ fontSize: 11, padding: '4px 10px', whiteSpace: 'nowrap' }}
                            >
                              {hotfixBusy === ag.id ? '…' : t('تثبيت .msu')}
                            </Button>
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>
                            {t('يتطلب وجود ملف .msu على الوكيل — يُثبّت عبر wusa.exe /quiet /norestart.')}
                          </div>
                        </div>
                      )}
                      {lastAt && <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{t('آخر قياس')}: {new Date(lastAt).toLocaleString('ar-SA')}</div>}
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
          <span>{t('خدمات Windows')} (Services - {fleetServices.length})</span>
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

      {/* Tab 1: Roles & Features (windows.features collector) */}
      {activeTab === 'roles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {fleetNet.length === 0 ? renderNoAgents() : fleetFeatures.length === 0 ? renderCollectorEmpty('features', 'windows.features') : (
            <>
              {/* Controls */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, maxWidth: 420 }}>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <Search size={16} style={{ position: 'absolute', right: 12, top: 10, color: 'var(--text-3)' }} />
                    <TextInput
                      value={rolesSearch}
                      onChange={(e) => setRolesSearch(e.target.value)}
                      placeholder={t('بحث في الأدوار والميزات أو الوكلاء...')}
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
                    {t('الكل')} ({fleetFeatures.length})
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
                        <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('الوكيل')}</th>
                        <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('إجراءات')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFeatures.map((f, i) => (
                        <tr key={`${f.agent.id}:${f.name}:${i}`} style={{ borderBottom: '1px solid var(--glass-rim-low)' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-1)' }}>{f.name}</div>
                          </td>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-3)' }}>
                            {f.name}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span className={`badge ${f.installed ? 'badge--success' : 'badge--neutral'}`} style={{ fontSize: 11 }}>
                              {f.installed ? t('مثبّت ونشط') : f.state || t('متاح للتثبيت')}
                            </span>
                          </td>
                          {agentCell(f.agent, f.completedAt)}
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {(['enable', 'disable'] as const).map((action) => {
                                const key = `${f.agentId}:${f.name}:${action}`;
                                const busy = featBusy === key;
                                return (
                                  <button
                                    key={action}
                                    type="button"
                                    disabled={featBusy !== null}
                                    onClick={() => queueFeatureToggle(f, action)}
                                    style={{
                                      fontSize: 11, padding: '4px 8px', borderRadius: 6, cursor: featBusy ? 'wait' : 'pointer',
                                      border: '1px solid var(--glass-rim)', background: 'var(--surface-card)', color: 'var(--text-2)',
                                    }}
                                  >
                                    {busy ? '…' : action === 'enable' ? t('تفعيل') : t('تعطيل')}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Tab 2: Windows Services (service.list collector — read-only) */}
      {activeTab === 'services' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {fleetNet.length === 0 ? renderNoAgents() : fleetServices.length === 0 ? renderCollectorEmpty('services', 'service.list') : (
            <>
              {/* Controls */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, maxWidth: 420 }}>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <Search size={16} style={{ position: 'absolute', right: 12, top: 10, color: 'var(--text-3)' }} />
                    <TextInput
                      value={serviceSearch}
                      onChange={(e) => setServiceSearch(e.target.value)}
                      placeholder={t('بحث في الخدمات أو الوكلاء (مثال: RpcSs, WinRM)...')}
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
                    {t('كافة الخدمات')} ({fleetServices.length})
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
                        <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('الوكيل')}</th>
                        <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('إجراءات')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredServices.map((s, i) => (
                        <tr key={`${s.agent.id}:${s.name}:${i}`} style={{ borderBottom: '1px solid var(--glass-rim-low)' }}>
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-1)' }}>{s.display || s.name}</div>
                          </td>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-3)' }}>
                            {s.name}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-2)' }}>
                            <span className="badge badge--neutral" style={{ fontSize: 10 }}>
                              {s.start || '—'}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span className={`badge ${isServiceRunning(s.status) ? 'badge--success' : 'badge--neutral'}`} style={{ fontSize: 11 }}>
                              {isServiceRunning(s.status) ? t('قيد التشغيل') : isServiceStopped(s.status) ? t('متوقفة') : (s.status || '—')}
                            </span>
                          </td>
                          {agentCell(s.agent, s.completedAt)}
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {(['start', 'stop', 'restart'] as const).map((action) => {
                                const key = `${s.agentId}:${s.name}:${action}`;
                                const busy = svcBusy === key;
                                return (
                                  <button
                                    key={action}
                                    type="button"
                                    disabled={svcBusy !== null}
                                    onClick={() => queueServiceControl(s, action)}
                                    style={{
                                      fontSize: 11, padding: '4px 8px', borderRadius: 6, cursor: svcBusy ? 'wait' : 'pointer',
                                      border: '1px solid var(--glass-rim)', background: 'var(--surface-card)', color: 'var(--text-2)',
                                    }}
                                  >
                                    {busy ? '…' : action === 'start' ? t('تشغيل') : action === 'stop' ? t('إيقاف') : t('إعادة تشغيل')}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Tab 3: Scheduled Tasks (scheduled.tasks collector) */}
      {activeTab === 'tasks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {fleetNet.length === 0 ? renderNoAgents() : fleetTasks.length === 0 ? renderCollectorEmpty('tasks', 'scheduled.tasks') : (
            <>
              <div style={{ position: 'relative', maxWidth: 420 }}>
                <Search size={16} style={{ position: 'absolute', right: 12, top: 10, color: 'var(--text-3)' }} />
                <TextInput
                  value={tasksSearch}
                  onChange={(e) => setTasksSearch(e.target.value)}
                  placeholder={t('بحث في المهام المجدولة أو الوكلاء...')}
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
                        <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('الوكيل')}</th>
                        <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('إجراءات')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTasks.map((tk, i) => (
                        <tr key={`${tk.agent.id}:${tk.name}:${tk.path}:${i}`} style={{ borderBottom: '1px solid var(--glass-rim-low)' }}>
                          <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13, color: 'var(--text-1)' }}>
                            {tk.name}
                          </td>
                          <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-3)' }}>
                            {tk.path || '—'}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span className={`badge ${tk.state === 'Ready' || tk.state === 'Running' ? 'badge--success' : 'badge--neutral'}`} style={{ fontSize: 11 }}>
                              {tk.state || '—'}
                            </span>
                          </td>
                          {agentCell(tk.agent, tk.completedAt)}
                          <td style={{ padding: '12px 16px' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {(['run', 'enable', 'disable'] as const).map((action) => {
                                const key = `${tk.agentId}:${tk.name}:${action}`;
                                const busy = taskBusy === key;
                                return (
                                  <button
                                    key={action}
                                    type="button"
                                    disabled={taskBusy !== null}
                                    onClick={() => queueTaskControl(tk, action)}
                                    style={{
                                      fontSize: 11, padding: '4px 8px', borderRadius: 6, cursor: taskBusy ? 'wait' : 'pointer',
                                      border: '1px solid var(--glass-rim)', background: 'var(--surface-card)', color: 'var(--text-2)',
                                    }}
                                  >
                                    {busy ? '…' : action === 'run' ? t('تشغيل') : action === 'enable' ? t('تفعيل') : t('تعطيل')}
                                  </button>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Tab 4: Windows Updates (hotfix.list collector) */}
      {activeTab === 'updates' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {fleetNet.length === 0 ? renderNoAgents() : fleetHotfixes.length === 0 ? renderCollectorEmpty('hotfixes', 'hotfix.list') : (
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
                      <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('الوكيل')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fleetHotfixes.map((h, i) => (
                      <tr key={`${h.agent.id}:${h.id}:${i}`} style={{ borderBottom: '1px solid var(--glass-rim-low)' }}>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>
                          {h.id}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-2)' }}>
                          {h.description || '—'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)' }}>
                          {h.installedOn || t('غير محدد')}
                        </td>
                        {agentCell(h.agent, h.completedAt)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Tab 5: Certificates — fleet cert.list collector + cert.remove write jobs, plus legacy local store */}
      {activeTab === 'certs' && (
        <>
          {fleetNet.length > 0 && (
            <Card style={{ padding: 22, border: '1px solid var(--glass-rim)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ShieldCheck size={18} style={{ color: 'var(--accent)' }} />
                  <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--text-1)' }}>{t('شهادات وكلاء أساس')}</h3>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('cert.list + حذف شهادات موقّع (cert.remove)')}</span>
                </div>
                <NavLink to="/agents" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>
                  {t('إدارة الوكلاء')} ←
                </NavLink>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
                {fleetNet.map((ag) => {
                  const entry = ag.certs;
                  const rows = entry && !entry.error ? asItemArray(entry.result, 'certificates', 'items', 'certs') : [];
                  const ref = agentRef(ag);
                  return (
                    <div key={ag.id} style={{ border: '1px solid var(--hairline)', borderRadius: 12, padding: '14px 16px', background: 'var(--glass-tint)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Bot size={15} style={{ color: 'var(--accent)' }} />
                          <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{ref.label}</span>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: ag.status === 'online' ? 'var(--paid-bg)' : 'var(--surface-glass-tint)', color: ag.status === 'online' ? 'var(--paid)' : 'var(--text-3)' }}>
                          {ag.status}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-telemetry)', direction: 'ltr', textAlign: 'left', marginBottom: 10 }}>
                        {ref.hostname}{rows.length ? ` · ${rows.length} ${t('شهادة')}` : ''}
                      </div>
                      {!entry ? (
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('لم يُرسل جامع الشهادات بعد — أرسله من صفحة الوكلاء (cert.list).')}</div>
                      ) : entry.error ? (
                        <div className="text-status-danger" style={{ fontSize: 11 }}>{entry.error}</div>
                      ) : rows.length === 0 ? (
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('لا شهادات في مخزن LocalMachine\\My.')}</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
                          {rows.slice(0, 20).map((c: any, i: number) => {
                            const subject = String(pickField(c, 'subject', 'Subject', 'friendly_name', 'FriendlyName') || '?');
                            const issuer = String(pickField(c, 'issuer', 'Issuer') || '');
                            const thumb = String(pickField(c, 'thumbprint', 'Thumbprint') || '');
                            const notAfter = String(pickField(c, 'not_after', 'NotAfter') || '');
                            const expired = notAfter ? new Date(notAfter) < new Date() : false;
                            const key = `${ag.id}:${thumb || i}`;
                            return (
                              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 10, padding: '5px 8px', borderRadius: 6, background: 'var(--surface-ground)' }}>
                                <span style={{ fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'left', flex: 1 }} title={`${subject} — ${issuer}`}>
                                  {subject}
                                </span>
                                <span style={{ display: 'flex', gap: 6, flexShrink: 0, color: 'var(--text-3)', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                  {notAfter && <span style={{ color: expired ? 'var(--unpaid)' : 'var(--text-3)' }}>{notAfter}</span>}
                                  {expired && <span style={{ color: 'var(--unpaid)', fontWeight: 700 }}>{t('منتهية')}</span>}
                                  {thumb && (
                                    <button
                                      type="button"
                                      disabled={certBusy !== null}
                                      onClick={() => void queueCertRemove(ag.id, thumb, subject, ref.label)}
                                      style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, cursor: certBusy ? 'wait' : 'pointer', border: '1px solid var(--glass-rim)', background: 'transparent', color: 'var(--status-danger, #dc2626)' }}
                                    >
                                      {certBusy === key ? '…' : t('حذف')}
                                    </button>
                                  )}
                                </span>
                              </div>
                            );
                          })}
                          {rows.length > 20 && <div style={{ fontSize: 10, color: 'var(--text-3)' }}>+{rows.length - 20} {t('شهادة أخرى')}</div>}
                          {entry.completed_at && (
                            <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{t('آخر قياس')}: {new Date(entry.completed_at).toLocaleString('ar-SA')}</div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

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
        </>
      )}
    </div>
  );
}
