/**
 * ASAAS Enterprise v3.0 - Sovereign Windows Server Management
 * Domain 8: Network & Storage (إدارة الأقراص، وحدات التخزين، مشاركات SMB، مستعرض الملفات، المحولات، الجدار الناري والتشخيص)
 * Zero-Mock Production with Real Windows Physical Disks, Volumes, NetAdapters & Firewall
 */

import { useState, useEffect, useMemo } from 'react';
import { Card, Button, Modal, TextInput, useToast } from '../asaas-ui';
import { api } from '../lib/api';
import { apiV1 } from '../lib/apiV1';
import {
  HardDrive,
  Bot,
  Network,
  Shield,
  FolderTree,
  Share2,
  Activity,
  Search,
  Plus,
  Trash2,
  RefreshCw,
  Folder,
  File,
  Radio,
  Wifi,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { t } from '../lib/i18n';

type ResultEntry = { job_id: string; completed_at: string | null; result: unknown; error: string | null };

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

// PowerShell collectors serialize a single row as a bare object, not a
// one-element array — wrap it. Wrapper objects ({count, items,...}) are skipped.
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

interface AgentRef {
  id: string;
  label: string;
  status: string;
  hostname: string;
}

interface FleetAgentInfo {
  id: string;
  name: string;
  status: string;
  hostname?: string | null;
  linked_asset: { id: string; name: string; hostname: string } | null;
  sharesEntry: ResultEntry | null;
  shareRows: any[];
  diskEntry: ResultEntry | null;
  driveRows: { drive: string; totalGb: number | null; freeGb: number | null }[];
  physEntry: ResultEntry | null;
  physRows: any[];
}

function agentRefOf(ag: FleetAgentInfo): AgentRef {
  return {
    id: ag.id,
    label: ag.linked_asset?.name || ag.name,
    status: ag.status,
    hostname: ag.hostname || ag.linked_asset?.hostname || ag.id.slice(0, 8),
  };
}

// disk.list payload: [{name:"C:\\", total_gb, free_gb}] per agent.
function driveRows(result: unknown): { drive: string; totalGb: number | null; freeGb: number | null }[] {
  return asItemArray(result, 'disks', 'drives', 'items', 'volumes').map((d) => {
    const total = Number(pickField(d, 'total_gb', 'totalGB', 'total', 'size_gb', 'size'));
    const free = Number(pickField(d, 'free_gb', 'freeGB', 'free', 'available_gb', 'available'));
    return {
      drive: String(pickField(d, 'name', 'drive', 'drive_letter', 'letter', 'device', 'mount') || '?'),
      totalGb: Number.isFinite(total) ? total : null,
      freeGb: Number.isFinite(free) ? free : null,
    };
  });
}

type DriveFleetRow = ReturnType<typeof driveRows>[number] & { agent: AgentRef; completedAt: string | null };

export function NetworkStoragePage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'disks' | 'volumes' | 'shares' | 'explorer' | 'adapters' | 'firewall' | 'diagnostics'>('disks');
  const [loading, setLoading] = useState(false);

  // 1. Disks & Volumes
  const [disks, setDisks] = useState<any[]>([]);

  // 2. SMB Shares
  const [shares, setShares] = useState<any[]>([]);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [newShareName, setNewShareName] = useState('');
  const [newSharePath, setNewSharePath] = useState('');
  const [agentShareBusy, setAgentShareBusy] = useState<string | null>(null);
  const [diskStateBusy, setDiskStateBusy] = useState<string | null>(null);

  // Signed agent write job: set a physical disk online/offline/read-only.
  const queueDiskState = async (agentId: string, diskNumber: number, hostName: string, action: 'online' | 'offline' | 'readonly' | 'clear-readonly') => {
    const key = `${agentId}:${diskNumber}:${action}`;
    if (!window.confirm(t(`تنفيذ ${action} على القرص ${diskNumber} في ${hostName}؟`))) return;
    setDiskStateBusy(key);
    try {
      await apiV1.createJob({ agent_id: agentId, job_type: 'disk.state', payload: { disk_number: diskNumber, action } });
      toast(t('تم إرسال أمر القرص — ينفذ على الوكيل خلال ~15 ثانية'), 'success');
    } catch (err: any) {
      toast(err?.message || t('فشل إرسال الأمر'), 'error');
    } finally {
      setDiskStateBusy(null);
    }
  };

  // Signed agent write job: delete an SMB share on its host agent.
  const queueAgentShareDelete = async (agentId: string, shareName: string, hostName: string) => {
    const key = `${agentId}:${shareName}`;
    if (!window.confirm(t(`حذف المشاركة ${shareName} على ${hostName}؟`))) return;
    setAgentShareBusy(key);
    try {
      await apiV1.createJob({ agent_id: agentId, job_type: 'share.control', payload: { action: 'delete', name: shareName } });
      toast(t('تم إرسال أمر الحذف — ينفذ على الوكيل خلال ~15 ثانية'), 'success');
    } catch (err: any) {
      toast(err?.message || t('فشل إرسال الأمر'), 'error');
    } finally {
      setAgentShareBusy(null);
    }
  };
  // Remote agent share creation state
  const [agentShareCreate, setAgentShareCreate] = useState<{ agent: any; name: string; path: string; desc: string } | null>(null);
  const [agentShareCreateBusy, setAgentShareCreateBusy] = useState(false);

  const submitAgentShareCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentShareCreate) return;
    const { agent, name, path, desc } = agentShareCreate;
    if (!name.trim() || !path.trim()) {
      toast(t('أدخل اسم المشاركة والمسار المحلي على الوكيل'), 'error');
      return;
    }
    if (!window.confirm(t(`إنشاء مشاركة SMB «${name.trim()}» → ${path.trim()} على ${agent.linked_asset?.name || agent.name || agent.hostname || agent.id.slice(0, 8)}؟`))) return;
    setAgentShareCreateBusy(true);
    try {
      await apiV1.createJob({
        agent_id: agent.id,
        job_type: 'share.control',
        payload: { action: 'create', name: name.trim(), path: path.trim(), description: desc.trim() },
      });
      toast(t('تم إرسال مهمة إنشاء المشاركة — ينفذ على الوكيل خلال ~15 ثانية.'), 'success');
      setAgentShareCreate(null);
      setTimeout(fetchFleetAgents, 20000);
    } catch (err: any) {
      toast(err.message || t('فشل إرسال مهمة إنشاء المشاركة'), 'error');
    } finally {
      setAgentShareCreateBusy(false);
    }
  };

  const [newShareDesc, setNewShareDesc] = useState('');
  const [submittingShare, setSubmittingShare] = useState(false);

  // 3. File Explorer
  const [currentPath, setCurrentPath] = useState('C:\\');
  const [explorerData, setExplorerData] = useState<any>(null);

  // 4. Adapters
  const [adapters, setAdapters] = useState<any[]>([]);

  // 5. Firewall
  const [firewallStatus, setFirewallStatus] = useState<any>(null);
  const [firewallRules, setFirewallRules] = useState<any[]>([]);
  const [firewallSearch, setFirewallSearch] = useState('');
  const [togglingRule, setTogglingRule] = useState<string | null>(null);

  // 6. Diagnostics (Ping & TCP)
  const [pingHost, setPingHost] = useState('1.1.1.1');
  const [pingResult, setPingResult] = useState<any>(null);
  const [pinging, setPinging] = useState(false);

  const [tcpHost, setTcpHost] = useState('127.0.0.1');
  const [tcpPort, setTcpPort] = useState(8765);
  const [tcpResult, setTcpResult] = useState<any>(null);
  const [testingTcp, setTestingTcp] = useState(false);

  // Remote agent fleet data — read-only shares.list + disk.list collectors.
  const [fleetAgents, setFleetAgents] = useState<FleetAgentInfo[]>([]);

  const fetchFleetAgents = async () => {
    try {
      const fleetRes = await apiV1.fleetSummary();
      if (!fleetRes?.agents?.length) { setFleetAgents([]); return; }
      const detailed = await Promise.all(
        fleetRes.agents.map(async (ag) => {
          let sharesEntry: ResultEntry | null = null;
          let diskEntry: ResultEntry | null = null;
          let physEntry: ResultEntry | null = null;
          const r = await apiV1.agentLatestResults(ag.id).catch(() => null);
          sharesEntry = r?.results?.['shares.list'] ?? null;
          diskEntry = r?.results?.['disk.list'] ?? null;
          physEntry = r?.results?.['disk.physical'] ?? null;
          const shareRows = sharesEntry && !sharesEntry.error
            ? asItemArray(sharesEntry.result, 'shares', 'items')
            : [];
          const drives = diskEntry && !diskEntry.error ? driveRows(diskEntry.result) : [];
          const physRows = physEntry && !physEntry.error
            ? asItemArray(physEntry.result, 'disks', 'items')
            : [];
          return {
            id: ag.id,
            name: ag.name,
            status: ag.status,
            hostname: ag.hostname ?? null,
            linked_asset: ag.linked_asset ?? null,
            sharesEntry,
            shareRows,
            diskEntry,
            driveRows: drives,
            physEntry,
            physRows,
          };
        }),
      );
      setFleetAgents(detailed);
    } catch {
      setFleetAgents([]);
    }
  };

  useEffect(() => {
    fetchFleetAgents();
    const timer = window.setInterval(fetchFleetAgents, 60000);
    return () => window.clearInterval(timer);
  }, []);

  const fleetShares = useMemo(
    () => fleetAgents.filter((ag) => ag.sharesEntry || ag.shareRows.length > 0),
    [fleetAgents],
  );
  const fleetVolumes = useMemo<DriveFleetRow[]>(() => fleetAgents.flatMap((ag) => {
    const entry = ag.diskEntry;
    if (!entry || entry.error) return [];
    const ref = agentRefOf(ag);
    return driveRows(entry.result).map((d) => ({ ...d, agent: ref, completedAt: entry.completed_at }));
  }), [fleetAgents]);

  const fetchDisks = async () => {
    try {
      const res = await api.getDisks();
      setDisks(res?.disks || []);
    } catch {}
  };

  const fetchShares = async () => {
    try {
      const res = await api.getSmbShares();
      setShares(res?.shares || []);
    } catch {}
  };

  const fetchExplorer = async (targetPath = currentPath) => {
    try {
      const res = await api.browseFiles(targetPath);
      setExplorerData(res);
      if (res?.current_path) {
        setCurrentPath(res.current_path);
      }
    } catch (err: any) {
      toast(err.message || t('فشل استعراض المجلد'), 'error');
    }
  };

  const fetchAdapters = async () => {
    try {
      const res = await api.getNetworkAdapters();
      setAdapters(res?.adapters || []);
    } catch {}
  };

  const fetchFirewall = async () => {
    try {
      const [st, rl] = await Promise.all([
        api.getFirewallStatus().catch(() => null),
        api.getFirewallRulesList().catch(() => ({ rules: [] })),
      ]);
      setFirewallStatus(st);
      setFirewallRules(rl?.rules || []);
    } catch {}
  };

  const loadTabData = async () => {
    setLoading(true);
    if (activeTab === 'disks') await fetchDisks();
    else if (activeTab === 'shares') await fetchShares();
    else if (activeTab === 'explorer') await fetchExplorer();
    else if (activeTab === 'adapters') await fetchAdapters();
    else if (activeTab === 'firewall') await fetchFirewall();
    setLoading(false);
  };

  useEffect(() => {
    loadTabData();
  }, [activeTab]);

  const handleCreateShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShareName || !newSharePath) {
      toast(t('يرجى إدخال اسم المشاركة والمسار المحلي'), 'error');
      return;
    }
    setSubmittingShare(true);
    try {
      const res = await api.createSmbShare({
        name: newShareName,
        path: newSharePath,
        description: newShareDesc,
      });
      if (res.ok) {
        toast(`${t('تم إنشاء مشاركة SMB [\\\\\\\\SRV-LOCAL\\\\')}${newShareName}${t('] بنجاح.')}`, 'success');
        setShareModalOpen(false);
        setNewShareName('');
        setNewSharePath('');
        fetchShares();
      } else {
        toast(res.error || t('فشل إنشاء المشاركة'), 'error');
      }
    } catch (err: any) {
      toast(err.message || t('خطأ أثناء إنشاء المشاركة'), 'error');
    } finally {
      setSubmittingShare(false);
    }
  };

  const handleDeleteShare = async (name: string) => {
    if (!window.confirm(`${t('هل أنت متأكد من حذف مشاركة الشبكة [')}${name}${t(']؟')}`)) return;
    try {
      const res = await api.deleteSmbShare(name);
      if (res.ok) {
        toast(`${t('تمت إزالة مشاركة SMB [')}${name}${t('] بنجاح.')}`, 'success');
        fetchShares();
      } else {
        toast(res.error || t('فشل حذف المشاركة'), 'error');
      }
    } catch (err: any) {
      toast(err.message || t('خطأ أثناء حذف المشاركة'), 'error');
    }
  };

  const handleToggleFirewallRule = async (ruleName: string, currentEnabled: boolean) => {
    setTogglingRule(ruleName);
    try {
      const res = await api.toggleFirewallRule(ruleName, !currentEnabled);
      if (res.ok) {
        toast(`${t('تم ')}${!currentEnabled ? t('تفعيل') : t('تعطيل')}${t(' قاعدة الجدار الناري بنجاح.')}`, 'success');
        fetchFirewall();
      } else {
        toast(res.error || t('فشل تغيير حالة القاعدة'), 'error');
      }
    } catch (err: any) {
      toast(err.message || t('خطأ في الجدار الناري'), 'error');
    } finally {
      setTogglingRule(null);
    }
  };

  const handleRunPing = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinging(true);
    setPingResult(null);
    try {
      const res = await api.pingHost(pingHost, 4);
      setPingResult(res);
      if (res.ok && res.packet_loss_percent === 0) {
        toast(`${t('تم الاتصال بالهدف [')}${pingHost}${t('] بنجاح، زمن الاستجابة: ')}${res.avg_latency_ms}ms`, 'success');
      } else {
        toast(`${t('استجابة غير مكتملة أو فقدان حزم للهدف [')}${pingHost}]`, 'error');
      }
    } catch (err: any) {
      toast(err.message || t('فشل تنفيذ اختبار Ping'), 'error');
    } finally {
      setPinging(false);
    }
  };

  const handleTestTcp = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestingTcp(true);
    setTcpResult(null);
    try {
      const res = await api.testTcpPort(tcpHost, tcpPort);
      setTcpResult(res);
      if (res.connected) {
        toast(`${t('المنفذ [')}${tcpPort}${t('] على المضيف [')}${tcpHost}${t('] مفتوح وجاهز للاستقبال!')}`, 'success');
      } else {
        toast(`${t('المنفذ [')}${tcpPort}${t('] على المضيف [')}${tcpHost}${t('] مغلق أو لا يستجيب.')}`, 'error');
      }
    } catch (err: any) {
      toast(err.message || t('فشل اختبار مقبس TCP'), 'error');
    } finally {
      setTestingTcp(false);
    }
  };

  const filteredRules = firewallRules.filter((r) =>
    (r.display_name || '').toLowerCase().includes(firewallSearch.toLowerCase()) ||
    (r.name || '').toLowerCase().includes(firewallSearch.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <HardDrive size={24} style={{ color: 'var(--accent)' }} />
            <span>{t('التخزين والشبكات (Storage, Shares & Network Core)')}</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-3)' }}>
            {t('إدارة متكاملة للأقراص الفيزيائية، وحدات التخزين، مشاركات SMB، مستعرض ملفات السيرفر، محولات الشبكة، والجدار الناري.')}
          </p>
        </div>
        <Button variant="ghost" onClick={() => { void fetchFleetAgents(); void loadTabData(); }} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          <span>{t('تحديث')}</span>
        </Button>
      </div>

      {/* ASAAS remote agent shares — read-only shares.list collector data */}
      {fleetShares.length > 0 && (
        <Card style={{ padding: 22, border: '1px solid var(--glass-rim)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Share2 size={18} style={{ color: 'var(--accent)' }} />
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--text-1)' }}>{t('مشاركات وكلاء أساس')}</h3>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('shares.list + إنشاء/حذف مشاركات موقّع')}</span>
            </div>
            <NavLink to="/agents" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>
              {t('إدارة الوكلاء')} ←
            </NavLink>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
            {fleetShares.map((ag) => (
              <div key={ag.id} style={{ border: '1px solid var(--hairline)', borderRadius: 12, padding: '14px 16px', background: 'var(--glass-tint)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{ag.linked_asset?.name || ag.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: ag.status === 'online' ? 'var(--paid-bg)' : 'var(--surface-glass-tint)', color: ag.status === 'online' ? 'var(--paid)' : 'var(--text-3)' }}>
                    {ag.status}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-telemetry)', direction: 'ltr', textAlign: 'left' }}>
                    {ag.hostname || ag.linked_asset?.hostname || ag.id.slice(0, 8)}{ag.shareRows.length ? ` · ${ag.shareRows.length} ${t('مشاركة')}` : ''}
                  </div>
                  <button
                    type="button"
                    disabled={agentShareBusy !== null || agentShareCreateBusy}
                    onClick={() => setAgentShareCreate({ agent: ag, name: '', path: '', desc: '' })}
                    style={{ fontSize: 10, padding: '2px 10px', borderRadius: 999, cursor: 'pointer', border: '1px solid var(--accent)', background: 'var(--accent-soft)', color: 'var(--accent)', fontWeight: 700, whiteSpace: 'nowrap' }}
                  >
                    + {t('مشاركة')}
                  </button>
                </div>
                {!ag.sharesEntry ? (
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('لم يُرسل جامع المشاركات بعد — أرسله من صفحة الوكلاء.')}</div>
                ) : ag.sharesEntry.error ? (
                  <div className="text-status-danger" style={{ fontSize: 11 }}>{ag.sharesEntry.error}</div>
                ) : ag.shareRows.length === 0 ? (
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('لا مشاركات SMB أو نتيجة غير معروفة.')}</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
                    {ag.shareRows.slice(0, 40).map((s: any, i: number) => {
                      const sname = String(s.name ?? s.Name ?? '?');
                      const spath = String(s.path ?? s.Path ?? '');
                      const sdesc = String(s.description ?? s.Description ?? '');
                      const users = s.users ?? s.CurrentUsers ?? '';
                      return (
                        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 10, padding: '5px 8px', borderRadius: 6, background: 'var(--surface-ground)' }}>
                          <span style={{ fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'left' }} title={`${sname} → ${spath}`}>
                            \\{ag.hostname || ag.linked_asset?.hostname || ag.name}\{sname}
                          </span>
                          <span style={{ display: 'flex', gap: 6, flexShrink: 0, color: 'var(--text-3)', alignItems: 'center' }}>
                            {users !== '' && users !== null && <span style={{ fontSize: 9 }}>{t('مستخدمون')}: {users}</span>}
                            {sdesc && <span style={{ fontSize: 9 }}>{sdesc}</span>}
                            <button
                              type="button"
                              disabled={agentShareBusy !== null}
                              onClick={() => queueAgentShareDelete(ag.id, sname, ag.linked_asset?.name || ag.name || ag.hostname || ag.id.slice(0, 8))}
                              style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, cursor: agentShareBusy ? 'wait' : 'pointer', border: '1px solid var(--glass-rim)', background: 'transparent', color: 'var(--status-danger, #dc2626)' }}
                            >
                              {agentShareBusy === `${ag.id}:${sname}` ? '…' : t('حذف')}
                            </button>
                          </span>
                        </div>
                      );
                    })}
                    {ag.shareRows.length > 40 && <div style={{ fontSize: 10, color: 'var(--text-3)' }}>+{ag.shareRows.length - 40} {t('مشاركة أخرى')}</div>}
                    {ag.sharesEntry.completed_at && (
                      <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{t('آخر قياس')}: {new Date(ag.sharesEntry.completed_at).toLocaleString('ar-SA')}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--glass-rim)', paddingBottom: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setActiveTab('disks')}
          style={{
            background: activeTab === 'disks' ? 'var(--accent-soft)' : 'transparent',
            color: activeTab === 'disks' ? 'var(--accent)' : 'var(--text-3)',
            border: 'none',
            padding: '8px 14px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <HardDrive size={15} />
          <span>{t('الأقراص الفيزيائية')} (Disks - {disks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('volumes')}
          style={{
            background: activeTab === 'volumes' ? 'var(--accent-soft)' : 'transparent',
            color: activeTab === 'volumes' ? 'var(--accent)' : 'var(--text-3)',
            border: 'none',
            padding: '8px 14px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <HardDrive size={15} />
          <span>{t('وحدات التخزين')} ({fleetVolumes.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('shares')}
          style={{
            background: activeTab === 'shares' ? 'var(--accent-soft)' : 'transparent',
            color: activeTab === 'shares' ? 'var(--accent)' : 'var(--text-3)',
            border: 'none',
            padding: '8px 14px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Share2 size={15} />
          <span>{t('مشاركات SMB (File Shares)')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('explorer')}
          style={{
            background: activeTab === 'explorer' ? 'var(--accent-soft)' : 'transparent',
            color: activeTab === 'explorer' ? 'var(--accent)' : 'var(--text-3)',
            border: 'none',
            padding: '8px 14px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <FolderTree size={15} />
          <span>{t('مستعرض ملفات السيرفر (Explorer)')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('adapters')}
          style={{
            background: activeTab === 'adapters' ? 'var(--accent-soft)' : 'transparent',
            color: activeTab === 'adapters' ? 'var(--accent)' : 'var(--text-3)',
            border: 'none',
            padding: '8px 14px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Network size={15} />
          <span>{t('محولات الشبكة (Adapters)')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('firewall')}
          style={{
            background: activeTab === 'firewall' ? 'var(--accent-soft)' : 'transparent',
            color: activeTab === 'firewall' ? 'var(--accent)' : 'var(--text-3)',
            border: 'none',
            padding: '8px 14px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Shield size={15} />
          <span>{t('الجدار الناري (Firewall)')}</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('diagnostics')}
          style={{
            background: activeTab === 'diagnostics' ? 'var(--accent-soft)' : 'transparent',
            color: activeTab === 'diagnostics' ? 'var(--accent)' : 'var(--text-3)',
            border: 'none',
            padding: '8px 14px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Activity size={15} />
          <span>{t('فحص وتشخيص الشبكة (Ping & TCP)')}</span>
        </button>
      </div>

      {/* Fleet physical disks — disk.physical collector + disk.state write jobs */}
      {activeTab === 'disks' && fleetAgents.length > 0 && (
        <Card style={{ padding: 22, border: '1px solid var(--glass-rim)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <HardDrive size={18} style={{ color: 'var(--accent)' }} />
              <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--text-1)' }}>{t('أقراص وكلاء أساس الفيزيائية')}</h3>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('disk.physical + أوامر حالة موقعة (online/offline/readonly)')}</span>
            </div>
            <NavLink to="/agents" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>
              {t('إدارة الوكلاء')} ←
            </NavLink>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
            {fleetAgents.map((ag) => {
              const entry = ag.physEntry;
              const rows = entry && !entry.error ? ag.physRows : [];
              const ref = agentRefOf(ag);
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
                    {ref.hostname}{rows.length ? ` · ${rows.length} ${t('قرص')}` : ''}
                  </div>
                  {!entry ? (
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('لم يُرسل جامع الأقراص بعد — أرسله من صفحة الوكلاء (disk.physical).')}</div>
                  ) : entry.error ? (
                    <div className="text-status-danger" style={{ fontSize: 11 }}>{entry.error}</div>
                  ) : rows.length === 0 ? (
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('لا أقراص فيزيائية أو Get-Disk غير متاح.')}</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
                      {rows.slice(0, 20).map((d: any, i: number) => {
                        const dnum = Number(pickField(d, 'Number', 'number', 'disk_number') ?? i);
                        const dname = String(pickField(d, 'FriendlyName', 'friendly_name', 'Model', 'model') || `Disk ${dnum}`);
                        const dsize = pickField(d, 'size_gb', 'Size');
                        const health = String(pickField(d, 'HealthStatus', 'health_status', 'OperationalStatus', 'operational_status') || '');
                        const offline = d.IsOffline === true || d.is_offline === true || /offline|not present/i.test(String(pickField(d, 'OperationalStatus', 'operational_status')));
                        const readonly = d.IsReadOnly === true || d.is_read_only === true;
                        const key = `${ag.id}:${dnum}`;
                        const btn = (action: 'online' | 'offline' | 'readonly' | 'clear-readonly', label: string) => (
                          <button
                            key={action}
                            type="button"
                            disabled={diskStateBusy !== null}
                            onClick={() => void queueDiskState(ag.id, dnum, ref.label, action)}
                            style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, cursor: diskStateBusy ? 'wait' : 'pointer', border: '1px solid var(--glass-rim)', background: 'transparent', color: 'var(--accent)' }}
                          >
                            {diskStateBusy === `${key}:${action}` ? '…' : label}
                          </button>
                        );
                        return (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 10, padding: '5px 8px', borderRadius: 6, background: 'var(--surface-ground)' }}>
                            <span style={{ fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'left', flex: 1 }} title={dname}>
                              {offline ? '○ ' : ''}{dname}
                            </span>
                            <span style={{ display: 'flex', gap: 4, flexShrink: 0, color: 'var(--text-3)', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                              {dsize !== '' && <span>{dsize} GB</span>}
                              <span style={{ color: /healthy|ok/i.test(health) ? 'var(--paid)' : 'var(--unpaid)' }}>{health || '—'}</span>
                              {readonly && <span style={{ color: 'var(--unpaid)' }}>{t('للقراءة فقط')}</span>}
                              {offline ? btn('online', t('توصيل')) : btn('offline', t('فصل'))}
                              {readonly ? btn('clear-readonly', t('إزالة RO')) : btn('readonly', 'RO')}
                            </span>
                          </div>
                        );
                      })}
                      {rows.length > 20 && <div style={{ fontSize: 10, color: 'var(--text-3)' }}>+{rows.length - 20} {t('قرص آخر')}</div>}
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

      {/* Tab 1: Physical Disks */}"

      {activeTab === 'disks' && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--glass-rim)', fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>
            {t('الأقراص الفيزيائية المتصلة (Windows Physical Disks via Get-Disk)')}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
              <thead>
                <tr style={{ background: 'var(--glass-tint)', borderBottom: '1px solid var(--glass-rim)' }}>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('رقم القرص')}</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('الموديل / FriendlyName')}</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('السعة الإجمالية')}</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('نوع الناقل (Bus)')}</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('نمط التقسيم')}</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('الحالة الصحية')}</th>
                </tr>
              </thead>
              <tbody>
                {disks.map((d, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--glass-rim-low)' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent)' }}>
                      Disk {d.number ?? d.Number ?? i}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13, color: 'var(--text-1)' }}>
                      {d.model || d.FriendlyName || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-2)' }}>
                      {d.size_gb ? `${d.size_gb} GB` : t('غير محدد')}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)' }}>
                      {d.bus_type || d.BusType || '—'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)' }}>
                      {d.partition_style || d.PartitionStyle || '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className={`badge ${/healthy|ok/i.test(String(d.health_status || d.HealthStatus || '')) ? 'badge--success' : 'badge--neutral'}`} style={{ fontSize: 11 }}>
                        {d.health_status || d.HealthStatus || '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 2: Volumes */}
      {activeTab === 'volumes' && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--glass-rim)', fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>
            {t('وحدات التخزين عبر وكلاء أساس (disk.list — بيانات حية لكل وكيل)')}
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
              <thead>
                <tr style={{ background: 'var(--glass-tint)', borderBottom: '1px solid var(--glass-rim)' }}>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('الوحدة')}</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('الوكيل')}</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('السعة الإجمالية')}</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('المساحة المتاحة')}</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('نسبة الشغور')}</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('آخر قياس')}</th>
                </tr>
              </thead>
              <tbody>
                {fleetVolumes.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '24px 16px', textAlign: 'center', fontSize: 13, color: 'var(--text-3)' }}>
                      {t('لا توجد بيانات أقراص — أرسل job_type=«disk.list» من صفحة الوكلاء ثم انتظر النتيجة.')}
                    </td>
                  </tr>
                )}
                {fleetVolumes.map((v, i) => {
                  const freePercent = v.totalGb != null && v.freeGb != null && v.totalGb > 0
                    ? Math.round((v.freeGb / v.totalGb) * 100)
                    : null;
                  return (
                    <tr key={`${v.agent.id}-${v.drive}-${i}`} style={{ borderBottom: '1px solid var(--glass-rim-low)' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 800, fontSize: 14, color: 'var(--accent)' }}>
                        {v.drive}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)' }}>{v.agent.label}</span>
                        <span style={{ display: 'block', fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--font-telemetry)', direction: 'ltr', textAlign: 'left' }}>{v.agent.hostname}</span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-2)' }}>
                        {v.totalGb != null ? `${v.totalGb.toFixed(1)} GB` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-2)' }}>
                        {v.freeGb != null ? `${v.freeGb.toFixed(1)} GB` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {freePercent == null ? (
                          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>—</span>
                        ) : (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
                          <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${freePercent}%`, background: freePercent > 20 ? 'var(--status-safe)' : 'var(--status-danger)' }} />
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace' }}>{freePercent}%</span>
                        </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 11, color: 'var(--text-3)' }}>
                        {v.completedAt ? new Date(v.completedAt).toLocaleString('ar-SA') : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 3: SMB Shares */}
      {activeTab === 'shares' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button variant="primary" onClick={() => setShareModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={15} />
              <span>{t('إنشاء مشاركة SMB جديدة')}</span>
            </Button>
          </div>

          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
                <thead>
                  <tr style={{ background: 'var(--glass-tint)', borderBottom: '1px solid var(--glass-rim)' }}>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('اسم المشاركة (Share Name)')}</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('المسار المحلي (Local Path)')}</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('الوصف')}</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('الحالة')}</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700, textAlign: 'end' }}>{t('الإجراءات')}</th>
                  </tr>
                </thead>
                <tbody>
                  {shares.map((s) => (
                    <tr key={s.name} style={{ borderBottom: '1px solid var(--glass-rim-low)' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: 'var(--accent)' }}>
                        \\SRV-LOCAL\{s.name}
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-2)' }}>
                        {s.path}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)' }}>
                        {s.description || t('مشاركة شبكة')}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className="badge badge--success" style={{ fontSize: 11 }}>
                          Online
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'end' }}>
                        {!s.name.endsWith('$') && (
                          <Button
                            variant="ghost"
                            onClick={() => handleDeleteShare(s.name)}
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
        </div>
      )}

      {/* Tab 4: File Explorer */}
      {activeTab === 'explorer' && (
        <Card style={{ padding: 18 }}>
          {/* Breadcrumbs & Drive Quick Access */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontFamily: 'monospace', color: 'var(--text-1)' }}>
              <Folder size={16} style={{ color: 'var(--accent)' }} />
              <span>{t('المسار الحالي:')}</span>
              <span style={{ padding: '4px 8px', borderRadius: 4, background: 'var(--glass-tint)', border: '1px solid var(--glass-rim)' }}>
                {currentPath}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <Button variant="secondary" onClick={() => fetchExplorer('C:\\')} style={{ fontSize: 11, padding: '4px 10px' }}>C:\</Button>
              <Button variant="secondary" onClick={() => fetchExplorer('D:\\')} style={{ fontSize: 11, padding: '4px 10px' }}>D:\</Button>
              {explorerData?.parent_path && (
                <Button variant="primary" onClick={() => fetchExplorer(explorerData.parent_path)} style={{ fontSize: 11, padding: '4px 10px' }}>
                  {t('المجلد الأعلى ..')}
                </Button>
              )}
            </div>
          </div>

          {/* Directory Content Table */}
          <div style={{ overflowX: 'auto', maxHeight: '500px', border: '1px solid var(--glass-rim)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ background: 'var(--surface-ground)', borderBottom: '1px solid var(--glass-rim)' }}>
                  <th style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('الاسم')}</th>
                  <th style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('النوع')}</th>
                  <th style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('الحجم')}</th>
                  <th style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('تاريخ التعديل')}</th>
                </tr>
              </thead>
              <tbody>
                {(explorerData?.items || []).map((item: any, i: number) => {
                  const isDir = item.is_directory;
                  return (
                    <tr
                      key={i}
                      onClick={() => isDir && fetchExplorer(item.full_path)}
                      style={{
                        borderBottom: '1px solid var(--glass-rim-low)',
                        cursor: isDir ? 'pointer' : 'default',
                        background: isDir ? 'rgba(212,160,23,0.02)' : 'transparent',
                      }}
                      className={isDir ? 'hover:bg-glass-tint' : ''}
                    >
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          {isDir ? (
                            <Folder size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                          ) : (
                            <File size={16} style={{ color: 'var(--text-3)', flexShrink: 0 }} />
                          )}
                          <span style={{ fontWeight: isDir ? 700 : 500, fontSize: 13, color: isDir ? 'var(--text-1)' : 'var(--text-2)' }}>
                            {item.name}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-3)' }}>
                        {isDir ? t('مجلد (Directory)') : t('ملف (File)')}
                      </td>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-2)' }}>
                        {isDir ? '-' : (item.size_mb ? `${item.size_mb} MB` : (item.size_bytes ? `${Math.round(item.size_bytes / 1024)} KB` : '0 KB'))}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-3)' }}>
                        {item.modified || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Tab 5: Adapters */}
      {activeTab === 'adapters' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {adapters.map((a, i) => (
            <Card key={i} style={{ padding: 18, border: '1px solid var(--glass-rim)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Network size={20} style={{ color: 'var(--accent)' }} />
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-1)' }}>{a.name || '—'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{a.description || a.InterfaceDescription}</div>
                  </div>
                </div>
                <span className={`badge ${a.status === 'Up' ? 'badge--success' : 'badge--neutral'}`}>
                  {a.status || '—'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, borderTop: '1px solid var(--glass-rim-low)', paddingTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-3)' }}>{t('عنوان IPv4:')}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-1)' }}>
                    {a.ipv4 || a.IPAddress || '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-3)' }}>{t('عنوان MAC الفيزيائي:')}</span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-2)' }}>
                    {a.mac_address || a.MacAddress || '—'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-3)' }}>{t('سرعة الرابط (Link Speed):')}</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    {a.link_speed || a.LinkSpeed || '—'}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Tab 6: Firewall */}
      {activeTab === 'firewall' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Firewall Profiles Card */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <Card style={{ padding: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{t('ملف النطاق (Domain Profile)')}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--status-safe)', marginTop: 4 }}>
                {firewallStatus?.domain_profile?.enabled ? t('مفعّل ونشط') : t('مفعّل')}
              </div>
            </Card>
            <Card style={{ padding: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{t('الملف الخاص (Private Profile)')}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--status-safe)', marginTop: 4 }}>
                {firewallStatus?.private_profile?.enabled ? t('مفعّل ونشط') : t('مفعّل')}
              </div>
            </Card>
            <Card style={{ padding: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{t('الملف العام (Public Profile)')}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--status-safe)', marginTop: 4 }}>
                {firewallStatus?.public_profile?.enabled ? t('مفعّل ونشط') : t('مفعّل')}
              </div>
            </Card>
          </div>

          {/* Firewall Rules List */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--glass-rim)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>
                {t('قواعد جدار الحماية (Windows Firewall Rules via NetSecurity)')}
              </span>
              <div style={{ position: 'relative', width: 280 }}>
                <Search size={15} style={{ position: 'absolute', right: 10, top: 9, color: 'var(--text-3)' }} />
                <TextInput
                  value={firewallSearch}
                  onChange={(e) => setFirewallSearch(e.target.value)}
                  placeholder={t('بحث في القواعد...')}
                  style={{ paddingRight: 32, height: 34, fontSize: 12 }}
                />
              </div>
            </div>

            <div style={{ overflowX: 'auto', maxHeight: '500px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ background: 'var(--surface-ground)', borderBottom: '1px solid var(--glass-rim)' }}>
                    <th style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('اسم القاعدة')}</th>
                    <th style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('الاتجاه (Direction)')}</th>
                    <th style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('الإجراء')}</th>
                    <th style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('الحالة')}</th>
                    <th style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700, textAlign: 'end' }}>{t('تبديل الحالة')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRules.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--glass-rim-low)' }}>
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)' }}>{r.display_name || r.name}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-3)' }}>{r.name}</div>
                      </td>
                      <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-2)' }}>
                        {r.direction || 'Inbound'}
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <span className={`badge ${r.action === 'Allow' ? 'badge--success' : 'badge--danger'}`} style={{ fontSize: 10 }}>
                          {r.action || 'Allow'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px' }}>
                        <span className={`badge ${r.enabled ? 'badge--success' : 'badge--neutral'}`} style={{ fontSize: 10 }}>
                          {r.enabled ? t('مفعلة') : t('معطلة')}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'end' }}>
                        <Button
                          variant="ghost"
                          disabled={togglingRule === r.name}
                          onClick={() => handleToggleFirewallRule(r.name, r.enabled)}
                          style={{ fontSize: 11, padding: '4px 8px' }}
                        >
                          {r.enabled ? t('تعطيل') : t('تفعيل')}
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

      {/* Tab 7: Diagnostics */}
      {activeTab === 'diagnostics' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
          {/* ICMP Ping Tester */}
          <Card style={{ padding: 18 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-1)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Radio size={18} style={{ color: 'var(--accent)' }} />
              <span>{t('فحص الاستجابة (ICMP Ping Diagnostic)')}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 14px' }}>
              {t('إرسال حزم صدى ICMP حقيقية للتحقق من الاتصال عبر طبقة الشبكة وحساب زمن الوصول بالمللي ثانية.')}
            </p>

            <form onSubmit={handleRunPing} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>{t('عنوان المضيف أو IP')}</label>
                <TextInput value={pingHost} onChange={(e) => setPingHost(e.target.value)} placeholder={t('مثال: 1.1.1.1 أو google.com')} required />
              </div>
              <Button variant="primary" type="submit" disabled={pinging}>
                {pinging ? t('جارٍ إرسال الحزم...') : t('بدء فحص Ping')}
              </Button>
            </form>

            {pingResult && (
              <div style={{ marginTop: 14, padding: 12, borderRadius: 6, background: 'var(--glass-tint)', border: '1px solid var(--glass-rim)', fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-3)' }}>{t('متوسط زمن الاستجابة:')}</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace' }}>{pingResult.avg_latency_ms} ms</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-3)' }}>{t('نسبة فقدان الحزم:')}</span>
                  <span style={{ fontWeight: 700, color: pingResult.packet_loss_percent === 0 ? 'var(--status-safe)' : 'var(--status-danger)', fontFamily: 'monospace' }}>
                    {pingResult.packet_loss_percent}%
                  </span>
                </div>
              </div>
            )}
          </Card>

          {/* TCP Socket Tester */}
          <Card style={{ padding: 18 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-1)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Wifi size={18} style={{ color: 'var(--accent)' }} />
              <span>{t('فحص مقبس المنفذ (TCP Port Probe)')}</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 14px' }}>
              {t('إنشاء مصافحة ثلاثية TCP حقيقية (SYN/ACK) للتحقق من فتح واستجابة منفذ الخدمة على الهدف.')}
            </p>

            <form onSubmit={handleTestTcp} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>{t('المضيف المستهدف')}</label>
                <TextInput value={tcpHost} onChange={(e) => setTcpHost(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>{t('رقم المنفذ (TCP Port)')}</label>
                <TextInput type="number" value={tcpPort} onChange={(e) => setTcpPort(parseInt(e.target.value) || 80)} required />
              </div>
              <Button variant="primary" type="submit" disabled={testingTcp}>
                {testingTcp ? t('جارٍ فحص المقبس...') : t('بدء فحص مقبس TCP')}
              </Button>
            </form>

            {tcpResult && (
              <div style={{ marginTop: 14, padding: 12, borderRadius: 6, background: 'var(--glass-tint)', border: '1px solid var(--glass-rim)', fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-3)' }}>{t('حالة المنفذ:')}</span>
                  <span className={`badge ${tcpResult.connected ? 'badge--success' : 'badge--danger'}`}>
                    {tcpResult.connected ? t('مفتوح ومتصل (Connected)') : t('مغلق أو محجوب (Refused/Timeout)')}
                  </span>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Modal: Create SMB Share */}
      <Modal open={shareModalOpen} onClose={() => setShareModalOpen(false)} title={t('إنشاء مشاركة شبكة SMB جديدة')}>
        <form onSubmit={handleCreateShare} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>{t('اسم المشاركة (Share Name)')}</label>
            <TextInput value={newShareName} onChange={(e) => setNewShareName(e.target.value)} placeholder={t('مثال: ProjectsData')} required />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>{t('المسار المحلي على القرص (Local Path)')}</label>
            <TextInput value={newSharePath} onChange={(e) => setNewSharePath(e.target.value)} placeholder={t('مثال: C:\\Shares\\Projects')} required />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>{t('الوصف التوضيحي')}</label>
            <TextInput value={newShareDesc} onChange={(e) => setNewShareDesc(e.target.value)} placeholder={t('مشاركة بيانات مشاريع المطورين')} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <Button variant="ghost" type="button" onClick={() => setShareModalOpen(false)}>{t('إلغاء')}</Button>
            <Button variant="primary" type="submit" disabled={submittingShare}>
              {submittingShare ? t('جارٍ الإنشاء...') : t('إنشاء المشاركة')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Create SMB Share on remote agent */}
      <Modal open={agentShareCreate !== null} onClose={() => setAgentShareCreate(null)} title={t('إنشاء مشاركة SMB على وكيل')}>
        <form onSubmit={submitAgentShareCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
            {agentShareCreate ? `${t('الوكيل: ')}${agentShareCreate.agent.linked_asset?.name || agentShareCreate.agent.name || agentShareCreate.agent.hostname || agentShareCreate.agent.id.slice(0, 8)}` : ''}
          </p>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>
            {t('اسم المشاركة')}
            <TextInput value={agentShareCreate?.name ?? ''} onChange={(e) => setAgentShareCreate((c) => c ? { ...c, name: e.target.value } : c)} placeholder={t('مثال: ProjectsData')} required dir="ltr" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>
            {t('المسار المحلي على الوكيل')}
            <TextInput value={agentShareCreate?.path ?? ''} onChange={(e) => setAgentShareCreate((c) => c ? { ...c, path: e.target.value } : c)} placeholder="C:\Shares\Data" required dir="ltr" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>
            {t('الوصف (اختياري)')}
            <TextInput value={agentShareCreate?.desc ?? ''} onChange={(e) => setAgentShareCreate((c) => c ? { ...c, desc: e.target.value } : c)} placeholder={t('وصف المشاركة')} dir="auto" />
          </label>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button variant="ghost" type="button" onClick={() => setAgentShareCreate(null)}>{t('إلغاء')}</Button>
            <Button variant="primary" type="submit" loading={agentShareCreateBusy}>{t('إنشاء المشاركة')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
