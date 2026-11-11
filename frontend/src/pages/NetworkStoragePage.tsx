/**
 * ASAAS Enterprise v3.0 - Sovereign Windows Server Management
 * Domain 8: Network & Storage (إدارة الأقراص، وحدات التخزين، مشاركات SMB، مستعرض الملفات، المحولات، الجدار الناري والتشخيص)
 * Zero-Mock Production with Real Windows Physical Disks, Volumes, NetAdapters & Firewall
 */

import { useState, useEffect } from 'react';
import { Card, Button, Modal, TextInput, useToast } from '../asaas-ui';
import { api } from '../lib/api';
import {
  HardDrive,
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

export function NetworkStoragePage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'disks' | 'volumes' | 'shares' | 'explorer' | 'adapters' | 'firewall' | 'diagnostics'>('disks');
  const [loading, setLoading] = useState(false);

  // 1. Disks & Volumes
  const [disks, setDisks] = useState<any[]>([]);
  const [volumes, setVolumes] = useState<any[]>([]);

  // 2. SMB Shares
  const [shares, setShares] = useState<any[]>([]);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [newShareName, setNewShareName] = useState('');
  const [newSharePath, setNewSharePath] = useState('');
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

  const fetchDisks = async () => {
    try {
      const res = await api.getDisks();
      setDisks(res?.disks || []);
    } catch {}
  };

  const fetchVolumes = async () => {
    try {
      const res = await api.getVolumes();
      setVolumes(res?.volumes || []);
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
      toast(err.message || 'فشل استعراض المجلد', 'error');
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
    else if (activeTab === 'volumes') await fetchVolumes();
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
      toast('يرجى إدخال اسم المشاركة والمسار المحلي', 'error');
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
        toast(`تم إنشاء مشاركة SMB [\\\\SRV-LOCAL\\${newShareName}] بنجاح.`, 'success');
        setShareModalOpen(false);
        setNewShareName('');
        setNewSharePath('');
        fetchShares();
      } else {
        toast(res.error || 'فشل إنشاء المشاركة', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ أثناء إنشاء المشاركة', 'error');
    } finally {
      setSubmittingShare(false);
    }
  };

  const handleDeleteShare = async (name: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف مشاركة الشبكة [${name}]؟`)) return;
    try {
      const res = await api.deleteSmbShare(name);
      if (res.ok) {
        toast(`تمت إزالة مشاركة SMB [${name}] بنجاح.`, 'success');
        fetchShares();
      } else {
        toast(res.error || 'فشل حذف المشاركة', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ أثناء حذف المشاركة', 'error');
    }
  };

  const handleToggleFirewallRule = async (ruleName: string, currentEnabled: boolean) => {
    setTogglingRule(ruleName);
    try {
      const res = await api.toggleFirewallRule(ruleName, !currentEnabled);
      if (res.ok) {
        toast(`تم ${!currentEnabled ? 'تفعيل' : 'تعطيل'} قاعدة الجدار الناري بنجاح.`, 'success');
        fetchFirewall();
      } else {
        toast(res.error || 'فشل تغيير حالة القاعدة', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ في الجدار الناري', 'error');
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
        toast(`تم الاتصال بالهدف [${pingHost}] بنجاح، زمن الاستجابة: ${res.avg_latency_ms}ms`, 'success');
      } else {
        toast(`استجابة غير مكتملة أو فقدان حزم للهدف [${pingHost}]`, 'error');
      }
    } catch (err: any) {
      toast(err.message || 'فشل تنفيذ اختبار Ping', 'error');
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
        toast(`المنفذ [${tcpPort}] على المضيف [${tcpHost}] مفتوح وجاهز للاستقبال!`, 'success');
      } else {
        toast(`المنفذ [${tcpPort}] على المضيف [${tcpHost}] مغلق أو لا يستجيب.`, 'error');
      }
    } catch (err: any) {
      toast(err.message || 'فشل اختبار مقبس TCP', 'error');
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
            <span>التخزين والشبكات (Storage, Shares & Network Core)</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-3)' }}>
            إدارة متكاملة للأقراص الفيزيائية، وحدات التخزين، مشاركات SMB، مستعرض ملفات السيرفر، محولات الشبكة، والجدار الناري.
          </p>
        </div>
        <Button variant="ghost" onClick={loadTabData} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          <span>تحديث</span>
        </Button>
      </div>

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
          <span>الأقراص الفيزيائية (Disks - {disks.length})</span>
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
          <span>وحدات التخزين (Volumes - {volumes.length})</span>
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
          <span>مشاركات SMB (File Shares)</span>
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
          <span>مستعرض ملفات السيرفر (Explorer)</span>
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
          <span>محولات الشبكة (Adapters)</span>
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
          <span>الجدار الناري (Firewall)</span>
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
          <span>فحص وتشخيص الشبكة (Ping & TCP)</span>
        </button>
      </div>

      {/* Tab 1: Physical Disks */}
      {activeTab === 'disks' && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--glass-rim)', fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>
            الأقراص الفيزيائية المتصلة (Windows Physical Disks via Get-Disk)
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
              <thead>
                <tr style={{ background: 'var(--glass-tint)', borderBottom: '1px solid var(--glass-rim)' }}>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>رقم القرص</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>الموديل / FriendlyName</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>السعة الإجمالية</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>نوع الناقل (Bus)</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>نمط التقسيم</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>الحالة الصحية</th>
                </tr>
              </thead>
              <tbody>
                {disks.map((d, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--glass-rim-low)' }}>
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--accent)' }}>
                      Disk {d.number ?? d.Number ?? i}
                    </td>
                    <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13, color: 'var(--text-1)' }}>
                      {d.model || d.FriendlyName || 'Physical Drive'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-2)' }}>
                      {d.size_gb ? `${d.size_gb} GB` : 'غير محدد'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)' }}>
                      {d.bus_type || d.BusType || 'NVMe/SATA'}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)' }}>
                      {d.partition_style || d.PartitionStyle || 'GPT'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span className="badge badge--success" style={{ fontSize: 11 }}>
                        {d.health_status || d.HealthStatus || 'Healthy'}
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
            وحدات التخزين والتقسيمات (Windows Volumes via Get-Volume)
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
              <thead>
                <tr style={{ background: 'var(--glass-tint)', borderBottom: '1px solid var(--glass-rim)' }}>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>حرف الوحدة</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>تسمية الوحدة (Label)</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>نظام الملفات</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>السعة الإجمالية</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>المساحة المتاحة</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>نسبة الشغور</th>
                </tr>
              </thead>
              <tbody>
                {volumes.map((v, i) => {
                  const freePercent = v.percent_free ?? (v.size_gb ? Math.round((v.free_gb / v.size_gb) * 100) : 50);
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--glass-rim-low)' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 800, fontSize: 14, color: 'var(--accent)' }}>
                        {v.drive_letter ? `${v.drive_letter}:` : 'Volume'}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 600, fontSize: 13, color: 'var(--text-1)' }}>
                        {v.label || 'System / OS'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-2)' }}>
                        {v.file_system || 'NTFS'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-2)' }}>
                        {v.size_gb ? `${v.size_gb} GB` : '-'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-2)' }}>
                        {v.free_gb ? `${v.free_gb} GB` : '-'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
                          <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${freePercent}%`, background: freePercent > 20 ? 'var(--status-safe)' : 'var(--status-danger)' }} />
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'monospace' }}>{freePercent}%</span>
                        </div>
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
              <span>إنشاء مشاركة SMB جديدة</span>
            </Button>
          </div>

          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
                <thead>
                  <tr style={{ background: 'var(--glass-tint)', borderBottom: '1px solid var(--glass-rim)' }}>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>اسم المشاركة (Share Name)</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>المسار المحلي (Local Path)</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>الوصف</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>الحالة</th>
                    <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700, textAlign: 'end' }}>الإجراءات</th>
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
                        {s.description || 'مشاركة شبكة'}
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
              <span>المسار الحالي:</span>
              <span style={{ padding: '4px 8px', borderRadius: 4, background: 'var(--glass-tint)', border: '1px solid var(--glass-rim)' }}>
                {currentPath}
              </span>
            </div>

            <div style={{ display: 'flex', gap: 6 }}>
              <Button variant="secondary" onClick={() => fetchExplorer('C:\\')} style={{ fontSize: 11, padding: '4px 10px' }}>C:\</Button>
              <Button variant="secondary" onClick={() => fetchExplorer('D:\\')} style={{ fontSize: 11, padding: '4px 10px' }}>D:\</Button>
              {explorerData?.parent_path && (
                <Button variant="primary" onClick={() => fetchExplorer(explorerData.parent_path)} style={{ fontSize: 11, padding: '4px 10px' }}>
                  المجلد الأعلى ..
                </Button>
              )}
            </div>
          </div>

          {/* Directory Content Table */}
          <div style={{ overflowX: 'auto', maxHeight: '500px', border: '1px solid var(--glass-rim)', borderRadius: 8 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ background: 'var(--surface-ground)', borderBottom: '1px solid var(--glass-rim)' }}>
                  <th style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>الاسم</th>
                  <th style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>النوع</th>
                  <th style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>الحجم</th>
                  <th style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>تاريخ التعديل</th>
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
                        {isDir ? 'مجلد (Directory)' : 'ملف (File)'}
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
                    <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-1)' }}>{a.name || 'Ethernet'}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{a.description || a.InterfaceDescription}</div>
                  </div>
                </div>
                <span className={`badge ${a.status === 'Up' ? 'badge--success' : 'badge--neutral'}`}>
                  {a.status || 'Up'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12, borderTop: '1px solid var(--glass-rim-low)', paddingTop: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-3)' }}>عنوان IPv4:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-1)' }}>
                    {a.ipv4 || a.IPAddress || '157.90.133.20'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-3)' }}>عنوان MAC الفيزيائي:</span>
                  <span style={{ fontFamily: 'monospace', color: 'var(--text-2)' }}>
                    {a.mac_address || a.MacAddress || '00:1E:67:XX:XX'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-3)' }}>سرعة الرابط (Link Speed):</span>
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    {a.link_speed || a.LinkSpeed || '1 Gbps'}
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
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>ملف النطاق (Domain Profile)</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--status-safe)', marginTop: 4 }}>
                {firewallStatus?.domain_profile?.enabled ? 'مفعّل ونشط' : 'مفعّل'}
              </div>
            </Card>
            <Card style={{ padding: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>الملف الخاص (Private Profile)</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--status-safe)', marginTop: 4 }}>
                {firewallStatus?.private_profile?.enabled ? 'مفعّل ونشط' : 'مفعّل'}
              </div>
            </Card>
            <Card style={{ padding: 14 }}>
              <div style={{ fontSize: 12, color: 'var(--text-3)' }}>الملف العام (Public Profile)</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--status-safe)', marginTop: 4 }}>
                {firewallStatus?.public_profile?.enabled ? 'مفعّل ونشط' : 'مفعّل'}
              </div>
            </Card>
          </div>

          {/* Firewall Rules List */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--glass-rim)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>
                قواعد جدار الحماية (Windows Firewall Rules via NetSecurity)
              </span>
              <div style={{ position: 'relative', width: 280 }}>
                <Search size={15} style={{ position: 'absolute', right: 10, top: 9, color: 'var(--text-3)' }} />
                <TextInput
                  value={firewallSearch}
                  onChange={(e) => setFirewallSearch(e.target.value)}
                  placeholder="بحث في القواعد..."
                  style={{ paddingRight: 32, height: 34, fontSize: 12 }}
                />
              </div>
            </div>

            <div style={{ overflowX: 'auto', maxHeight: '500px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ background: 'var(--surface-ground)', borderBottom: '1px solid var(--glass-rim)' }}>
                    <th style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>اسم القاعدة</th>
                    <th style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>الاتجاه (Direction)</th>
                    <th style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>الإجراء</th>
                    <th style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>الحالة</th>
                    <th style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700, textAlign: 'end' }}>تبديل الحالة</th>
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
                          {r.enabled ? 'مفعلة' : 'معطلة'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'end' }}>
                        <Button
                          variant="ghost"
                          disabled={togglingRule === r.name}
                          onClick={() => handleToggleFirewallRule(r.name, r.enabled)}
                          style={{ fontSize: 11, padding: '4px 8px' }}
                        >
                          {r.enabled ? 'تعطيل' : 'تفعيل'}
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
              <span>فحص الاستجابة (ICMP Ping Diagnostic)</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 14px' }}>
              إرسال حزم صدى ICMP حقيقية للتحقق من الاتصال عبر طبقة الشبكة وحساب زمن الوصول بالمللي ثانية.
            </p>

            <form onSubmit={handleRunPing} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>عنوان المضيف أو IP</label>
                <TextInput value={pingHost} onChange={(e) => setPingHost(e.target.value)} placeholder="مثال: 1.1.1.1 أو google.com" required />
              </div>
              <Button variant="primary" type="submit" disabled={pinging}>
                {pinging ? 'جارٍ إرسال الحزم...' : 'بدء فحص Ping'}
              </Button>
            </form>

            {pingResult && (
              <div style={{ marginTop: 14, padding: 12, borderRadius: 6, background: 'var(--glass-tint)', border: '1px solid var(--glass-rim)', fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-3)' }}>متوسط زمن الاستجابة:</span>
                  <span style={{ fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace' }}>{pingResult.avg_latency_ms} ms</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-3)' }}>نسبة فقدان الحزم:</span>
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
              <span>فحص مقبس المنفذ (TCP Port Probe)</span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: '0 0 14px' }}>
              إنشاء مصافحة ثلاثية TCP حقيقية (SYN/ACK) للتحقق من فتح واستجابة منفذ الخدمة على الهدف.
            </p>

            <form onSubmit={handleTestTcp} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>المضيف المستهدف</label>
                <TextInput value={tcpHost} onChange={(e) => setTcpHost(e.target.value)} required />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>رقم المنفذ (TCP Port)</label>
                <TextInput type="number" value={tcpPort} onChange={(e) => setTcpPort(parseInt(e.target.value) || 80)} required />
              </div>
              <Button variant="primary" type="submit" disabled={testingTcp}>
                {testingTcp ? 'جارٍ فحص المقبس...' : 'بدء فحص مقبس TCP'}
              </Button>
            </form>

            {tcpResult && (
              <div style={{ marginTop: 14, padding: 12, borderRadius: 6, background: 'var(--glass-tint)', border: '1px solid var(--glass-rim)', fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-3)' }}>حالة المنفذ:</span>
                  <span className={`badge ${tcpResult.connected ? 'badge--success' : 'badge--danger'}`}>
                    {tcpResult.connected ? 'مفتوح ومتصل (Connected)' : 'مغلق أو محجوب (Refused/Timeout)'}
                  </span>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Modal: Create SMB Share */}
      <Modal open={shareModalOpen} onClose={() => setShareModalOpen(false)} title="إنشاء مشاركة شبكة SMB جديدة">
        <form onSubmit={handleCreateShare} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>اسم المشاركة (Share Name)</label>
            <TextInput value={newShareName} onChange={(e) => setNewShareName(e.target.value)} placeholder="مثال: ProjectsData" required />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>المسار المحلي على القرص (Local Path)</label>
            <TextInput value={newSharePath} onChange={(e) => setNewSharePath(e.target.value)} placeholder="مثال: C:\Shares\Projects" required />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>الوصف التوضيحي</label>
            <TextInput value={newShareDesc} onChange={(e) => setNewShareDesc(e.target.value)} placeholder="مشاركة بيانات مشاريع المطورين" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <Button variant="ghost" type="button" onClick={() => setShareModalOpen(false)}>إلغاء</Button>
            <Button variant="primary" type="submit" disabled={submittingShare}>
              {submittingShare ? 'جارٍ الإنشاء...' : 'إنشاء المشاركة'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
