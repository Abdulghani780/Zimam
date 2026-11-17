/**
 * ASAAS Enterprise v3.0 - Sovereign Windows Server Management
 * Domain 6: Containers & Virtualization (إدارة حاويات Docker والآلات الافتراضية Hyper-V)
 * Zero-Mock Production with Real Windows Hyper-V vmms & Docker CLI
 */

import { useState, useEffect } from 'react';
import { Card, Button, useToast } from '../asaas-ui';
import { api } from '../lib/api';
import { apiV1 } from '../lib/apiV1';
import { NavLink } from 'react-router-dom';
import {
  Boxes,
  RefreshCw,
  Server,
  Bot,
} from 'lucide-react';
import { t } from '../lib/i18n';

export function ContainersPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'docker' | 'hyperv'>('docker');
  const [loading, setLoading] = useState(false);

  // Docker State
  const [dockerData, setDockerData] = useState<any>(null);

  // Hyper-V State
  const [hypervData, setHypervData] = useState<any>(null);

  // Remote agent Hyper-V VMs — read-only hyperv.vms collector results.
  const [fleetVms, setFleetVms] = useState<any[]>([]);

  const fetchFleetVms = async () => {
    try {
      const fleetRes = await apiV1.fleetSummary();
      if (!fleetRes?.agents?.length) { setFleetVms([]); return; }
      const detailed = await Promise.all(
        fleetRes.agents.map(async (ag) => {
          const r = await apiV1.agentLatestResults(ag.id).catch(() => null);
          const entry = r?.results?.['hyperv.vms'] ?? null;
          let arr: any[] = [];
          const raw = entry && !entry.error ? entry.result : null;
          const src = Array.isArray(raw) ? raw : ((raw as any)?.vms ?? (raw as any)?.items ?? []);
          if (Array.isArray(src)) arr = src.filter((x) => x && typeof x === 'object');
          return { id: ag.id, name: ag.name, hostname: ag.hostname, status: ag.status, entry, vms: arr };
        }),
      );
      setFleetVms(detailed);
    } catch {
      setFleetVms([]);
    }
  };

  useEffect(() => {
    fetchFleetVms();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dockRes, hypRes] = await Promise.all([
        api.getDocker().catch(() => null),
        api.getHyperV().catch(() => null),
      ]);
      setDockerData(dockRes);
      setHypervData(hypRes);
    } catch (err: any) {
      toast(err.message || t('فشل جلب بيانات الحاويات والافتراضية'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Boxes size={24} style={{ color: 'var(--accent)' }} />
            <span>{t('الحاويات والافتراضية (Docker & Hyper-V Virtualization)')}</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-3)' }}>
            {t('مركز تحكم موحد لحاويات Docker Windows/Linux، وآلات Hyper-V الافتراضية، ومراقبة موارد المعالج والذاكرة.')}
          </p>
        </div>
        <Button variant="ghost" onClick={fetchData} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          <span>{t('تحديث')}</span>
        </Button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--glass-rim)', paddingBottom: 8 }}>
        <button
          type="button"
          onClick={() => setActiveTab('docker')}
          style={{
            background: activeTab === 'docker' ? 'var(--accent-soft)' : 'transparent',
            color: activeTab === 'docker' ? 'var(--accent)' : 'var(--text-3)',
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
          <Boxes size={16} />
          <span>{t('حاويات Docker')} ({dockerData?.containers?.length || 0})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('hyperv')}
          style={{
            background: activeTab === 'hyperv' ? 'var(--accent-soft)' : 'transparent',
            color: activeTab === 'hyperv' ? 'var(--accent)' : 'var(--text-3)',
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
          <span>{t('بيئة الافتراضية Hyper-V')}</span>
        </button>
      </div>

      {/* Tab 1: Docker */}
      {activeTab === 'docker' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Docker Engine Status Card */}
          <Card style={{ padding: 18, border: '1px solid var(--glass-rim)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(212,160,23,0.12)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                  <Boxes size={22} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)' }}>
                      {t('محرك Docker Engine')}
                    </span>
                    <span className={`badge ${dockerData?.cli_available ? 'badge--success' : 'badge--neutral'}`} style={{ fontSize: 11 }}>
                      {dockerData?.cli_available ? t('الواجهة البرمجية CLI مثبتة') : t('غير مثبت')}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, fontFamily: 'monospace' }}>
                    {dockerData?.version || '—'}
                  </div>
                </div>
              </div>

              <div>
                <span className={`badge ${dockerData?.daemon_running ? 'badge--success' : 'badge--warning'}`} style={{ fontSize: 12, padding: '6px 12px' }}>
                  {dockerData?.daemon_running ? t('خادم الخدمة Daemon متصل ويعمل') : t('خدمة Docker Daemon غير مشغلة حالياً (Standby)')}
                </span>
              </div>
            </div>
          </Card>

          {/* Containers List */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--glass-rim)', fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>
              {t('قائمة الحاويات النشطة والمسجلة (Container Inventory)')}
            </div>
            {!dockerData?.containers || dockerData.containers.length === 0 ? (
              <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                {t('لا توجد حاويات نشطة حالياً على خادم Docker المحلي.')}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
                  <thead>
                    <tr style={{ background: 'var(--glass-tint)', borderBottom: '1px solid var(--glass-rim)' }}>
                      <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('معرف الحاوية')}</th>
                      <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('اسم الحاوية')}</th>
                      <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('الصورة (Image)')}</th>
                      <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('الحالة')}</th>
                      <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('المنافذ المربوطة')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dockerData.containers.map((c: any) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--glass-rim-low)' }}>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--accent)' }}>
                          {c.id.substring(0, 12)}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13, color: 'var(--text-1)' }}>
                          {c.name}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-2)' }}>
                          {c.image}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className={`badge ${c.status.includes('Up') ? 'badge--success' : 'badge--neutral'}`} style={{ fontSize: 11 }}>
                            {c.status}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 12, color: 'var(--text-3)' }}>
                          {c.ports || t('لا توجد منافذ عامة')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab 2: Hyper-V */}
      {activeTab === 'hyperv' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Hyper-V Host Status */}
          <Card style={{ padding: 18, border: '1px solid var(--glass-rim)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(212,160,23,0.12)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                  <Server size={22} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)' }}>
                      {t('منصة الافتراضية Microsoft Hyper-V')}
                    </span>
                    <span className={`badge ${hypervData?.installed ? 'badge--success' : 'badge--warning'}`} style={{ fontSize: 11 }}>
                      {hypervData?.installed ? t('دور Hyper-V مثبت') : t('غير مثبت')}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                    {t('خدمة إدارة الآلات الافتراضية (vmms):')} <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{hypervData?.service_status || t('متوقفة')}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <span className="badge badge--neutral" style={{ fontSize: 12 }}>
                  {t('الدعم السيادي: Windows Server 2025')}
                </span>
              </div>
            </div>
          </Card>

          {/* VMs Inventory */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--glass-rim)', fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>
              {t('الآلات الافتراضية (Virtual Machines)')}
            </div>
            {!hypervData?.vms || hypervData.vms.length === 0 ? (
              <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                {t('لا توجد آلات افتراضية مسجلة في Hyper-V حالياً.')}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
                  <thead>
                    <tr style={{ background: 'var(--glass-tint)', borderBottom: '1px solid var(--glass-rim)' }}>
                      <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('اسم الآلة (VM Name)')}</th>
                      <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('الحالة (State)')}</th>
                      <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('المعالج المستهلك')}</th>
                      <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('الذاكرة المخصصة')}</th>
                      <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>{t('مدة التشغيل')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hypervData.vms.map((vm: any, i: number) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--glass-rim-low)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: 13, color: 'var(--text-1)' }}>
                          {vm.name}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span className={`badge ${vm.state === 'Running' ? 'badge--success' : 'badge--neutral'}`} style={{ fontSize: 11 }}>
                            {vm.state}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-2)' }}>
                          {vm.cpu_usage || '0%'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-2)' }}>
                          {vm.memory_mb ? `${vm.memory_mb} MB` : t('غير محدد')}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)' }}>
                          {vm.uptime || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* ASAAS remote agent Hyper-V VMs — read-only hyperv.vms collector */}
          {fleetVms.length > 0 && (
            <Card style={{ padding: 22, border: '1px solid var(--glass-rim)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Server size={18} style={{ color: 'var(--accent)' }} />
                  <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--text-1)' }}>{t('آلات وكلاء أساس الافتراضية (قراءة فقط)')}</h3>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('hyperv.vms حقيقية: آلات Hyper-V على كل وكيل')}</span>
                </div>
                <NavLink to="/agents" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>
                  {t('إدارة الوكلاء')} ←
                </NavLink>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                {fleetVms.map((ag) => (
                  <div key={ag.id} style={{ border: '1px solid var(--hairline)', borderRadius: 12, padding: '14px 16px', background: 'var(--glass-tint)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Bot size={15} style={{ color: 'var(--accent)' }} />
                        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{ag.name}</span>
                      </div>
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: ag.status === 'online' ? 'var(--paid-bg)' : 'var(--surface-glass-tint)', color: ag.status === 'online' ? 'var(--paid)' : 'var(--text-3)' }}>
                        {ag.status}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-telemetry)', direction: 'ltr', textAlign: 'left', marginBottom: 10 }}>
                      {ag.hostname || ag.id.slice(0, 8)}{ag.vms.length ? ` · ${ag.vms.length} ${t('آلة')}` : ''}
                    </div>
                    {!ag.entry ? (
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('لم يُرسل جامع الآلات بعد — أرسله من صفحة الوكلاء.')}</div>
                    ) : ag.entry.error ? (
                      <div className="text-status-danger" style={{ fontSize: 11 }}>{ag.entry.error}</div>
                    ) : ag.vms.length === 0 ? (
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('لا آلات افتراضية أو Hyper-V غير متاح على هذا الوكيل.')}</div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
                        {ag.vms.slice(0, 30).map((vm: any, i: number) => {
                          const vname = String(vm.name ?? vm.Name ?? '?');
                          const vstate = String(vm.state ?? vm.State ?? '');
                          const vmem = vm.memory_assigned_gb ?? vm.MemoryAssigned ?? '';
                          const vcpu = vm.cpu_usage ?? vm.ProcessorUsage ?? '';
                          return (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 10, padding: '5px 8px', borderRadius: 6, background: 'var(--surface-ground)' }}>
                              <span style={{ fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'left' }} title={vname}>{vname}</span>
                              <span style={{ display: 'flex', gap: 6, flexShrink: 0, color: 'var(--text-3)' }}>
                                {vmem !== '' && <span>{vmem} GB</span>}
                                {vcpu !== '' && <span>{typeof vcpu === 'number' ? `${Math.round(vcpu * 100)}%` : vcpu}</span>}
                                <span style={{ color: /running|running/i.test(vstate) ? 'var(--paid)' : 'var(--unpaid)' }}>{vstate || '—'}</span>
                              </span>
                            </div>
                          );
                        })}
                        {ag.vms.length > 30 && <div style={{ fontSize: 10, color: 'var(--text-3)' }}>+{ag.vms.length - 30} {t('آلة أخرى')}</div>}
                        {ag.entry.completed_at && (
                          <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{t('آخر قياس')}: {new Date(ag.entry.completed_at).toLocaleString('ar-SA')}</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
