/**
 * ASAAS Enterprise v3.0 - Sovereign Windows Server Management
 * Domain 6: Containers & Virtualization (إدارة حاويات Docker والآلات الافتراضية Hyper-V)
 * Zero-Mock Production with Real Windows Hyper-V vmms & Docker CLI
 */

import { useState, useEffect } from 'react';
import { Card, Button, Segmented, useToast } from '../asaas-ui';
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
  const [vmBusy, setVmBusy] = useState<string | null>(null);

  // Remote agent Docker containers — docker.containers collector + docker.container jobs.
  const [fleetDocker, setFleetDocker] = useState<any[]>([]);
  const [ctrBusy, setCtrBusy] = useState<string | null>(null);

  // Signed agent write job: start/stop/restart/pause/unpause a container.
  const queueContainerAction = async (agentId: string, container: string, hostName: string, action: 'start' | 'stop' | 'restart' | 'pause' | 'unpause') => {
    const key = `${agentId}:${container}:${action}`;
    if (!window.confirm(t(`تنفيذ ${action} على الحاوية ${container} في ${hostName}؟`))) return;
    setCtrBusy(key);
    try {
      await apiV1.createJob({ agent_id: agentId, job_type: 'docker.container', payload: { container, action } });
      toast(t('تم إرسال أمر الحاوية — ينفذ على الوكيل خلال ~15 ثانية'), 'success');
    } catch (err: any) {
      toast(err?.message || t('فشل إرسال الأمر'), 'error');
    } finally {
      setCtrBusy(null);
    }
  };

  // Signed agent write job: power action on a Hyper-V VM.
  const queueVmPower = async (agentId: string, vmName: string, hostName: string, action: 'start' | 'stop' | 'restart') => {
    const key = `${agentId}:${vmName}:${action}`;
    if (!window.confirm(t(`تنفيذ ${action} على الآلة ${vmName} في ${hostName}؟`))) return;
    setVmBusy(key);
    try {
      await apiV1.createJob({ agent_id: agentId, job_type: 'hyperv.power', payload: { vm_name: vmName, action } });
      toast(t('تم إرسال أمر الطاقة — ينفذ على الوكيل خلال ~15 ثانية'), 'success');
    } catch (err: any) {
      toast(err?.message || t('فشل إرسال الأمر'), 'error');
    } finally {
      setVmBusy(null);
    }
  };

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
          const dEntry = r?.results?.['docker.containers'] ?? null;
          let dArr: any[] = [];
          const dRaw = dEntry && !dEntry.error ? dEntry.result : null;
          const dSrc = Array.isArray(dRaw) ? dRaw : ((dRaw as any)?.containers ?? (dRaw as any)?.items ?? []);
          if (Array.isArray(dSrc)) dArr = dSrc.filter((x) => x && typeof x === 'object');
          return { id: ag.id, name: ag.name, hostname: ag.hostname, status: ag.status, entry, vms: arr, dEntry, containers: dArr };
        }),
      );
      setFleetVms(detailed);
      setFleetDocker(detailed);
    } catch (err: any) {
      setFleetVms([]);
      toast(err.message || t('فشل تحميل بيانات الحاويات من الوكلاء.'), 'error');
    }
  };

  useEffect(() => {
    fetchFleetVms();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [dockRes, hypRes] = await Promise.all([
        api.getDocker(),
        api.getHyperV(),
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
    <div className="page">
      {/* Header */}
      <div className="page-head-hero">
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
<Segmented
value={activeTab}
onChange={setActiveTab}
label={t('أقسام الحاويات')}
options={[
{ value: 'docker', label: t('حاويات Docker'), count: dockerData?.containers?.length || 0 },
{ value: 'hyperv', label: t('بيئة الافتراضية Hyper-V') },
]}
/>
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
                <table className="data-table">
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

          {/* ASAAS remote agent Docker containers — docker.containers + docker.container jobs */}
          {fleetDocker.length > 0 && (
            <Card style={{ padding: 22, border: '1px solid var(--glass-rim)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Boxes size={18} style={{ color: 'var(--accent)' }} />
                  <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--text-1)' }}>{t('حاويات وكلاء أساس')}</h3>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('docker.containers + أوامر حاويات موقعة (start/stop/restart/pause/unpause)')}</span>
                </div>
                <NavLink to="/agents" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>
                  {t('إدارة الوكلاء')} ←
                </NavLink>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                {fleetDocker.map((ag) => {
                  const entry = ag.dEntry;
                  const ctrs = entry && !entry.error ? ag.containers : [];
                  return (
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
                        {ag.hostname || ag.id.slice(0, 8)}{ctrs.length ? ` · ${ctrs.length} ${t('حاوية')}` : ''}
                      </div>
                      {!entry ? (
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('لم يُرسل جامع الحاويات بعد — أرسله من صفحة الوكلاء (docker.containers).')}</div>
                      ) : entry.error ? (
                        <div className="text-status-danger" style={{ fontSize: 11 }}>{entry.error}</div>
                      ) : ctrs.length === 0 ? (
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('لا حاويات أو Docker CLI غير متاح على هذا الوكيل.')}</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
                          {ctrs.slice(0, 30).map((c: any, i: number) => {
                            const cname = String(c.Names ?? c.names ?? c.Name ?? c.name ?? '?').replace(/^\//, '');
                            const cimg = String(c.Image ?? c.image ?? '');
                            const cstatus = String(c.Status ?? c.status ?? '');
                            const cstate = String(c.State ?? c.state ?? '');
                            const cports = String(c.Ports ?? c.ports ?? '');
                            const running = /^(running|up)/i.test(cstate) || /up/i.test(cstatus);
                            const paused = /paused/i.test(cstate) || /paused/i.test(cstatus);
                            const ctrKey = `${ag.id}:${cname}`;
                            const btn = (action: 'start' | 'stop' | 'restart' | 'pause' | 'unpause', label: string) => (
                              <button
                                key={action}
                                type="button"
                                disabled={ctrBusy !== null}
                                onClick={() => void queueContainerAction(ag.id, cname, ag.name || ag.hostname || ag.id.slice(0, 8), action)}
                                style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, cursor: ctrBusy ? 'wait' : 'pointer', border: '1px solid var(--glass-rim)', background: 'transparent', color: 'var(--accent)' }}
                              >
                                {ctrBusy === `${ctrKey}:${action}` ? '…' : label}
                              </button>
                            );
                            return (
                              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 10, padding: '5px 8px', borderRadius: 6, background: 'var(--surface-ground)' }}>
                                <span style={{ fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', direction: 'ltr', textAlign: 'left', flex: 1 }} title={`${cname} → ${cimg}`}>
                                  {cname}
                                </span>
                                <span style={{ display: 'flex', gap: 4, flexShrink: 0, color: 'var(--text-3)', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                  {cports && <span style={{ fontSize: 9 }}>{cports}</span>}
                                  <span style={{ color: running && !paused ? 'var(--paid)' : 'var(--text-3)' }}>
                                    {paused ? t('موقوفة') : running ? t('تعمل') : t('متوقفة')}
                                  </span>
                                  {running && !paused && btn('pause', t('إيقاف مؤقت'))}
                                  {paused && btn('unpause', t('استئناف'))}
                                  {!running && btn('start', t('تشغيل'))}
                                  {running && btn('stop', t('إيقاف'))}
                                  {running && btn('restart', t('إعادة'))}
                                </span>
                              </div>
                            );
                          })}
                          {ctrs.length > 30 && <div style={{ fontSize: 10, color: 'var(--text-3)' }}>+{ctrs.length - 30} {t('حاوية أخرى')}</div>}
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
                <table className="data-table">
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
                  <h3 style={{ fontSize: 15, fontWeight: 800, margin: 0, color: 'var(--text-1)' }}>{t('آلات وكلاء أساس الافتراضية')}</h3>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('hyperv.vms + أوامر طاقة موقعة (start/stop/restart)')}</span>
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
                              <span style={{ display: 'flex', gap: 4, flexShrink: 0, color: 'var(--text-3)', alignItems: 'center' }}>
                                {vmem !== '' && <span>{vmem} GB</span>}
                                {vcpu !== '' && <span>{typeof vcpu === 'number' ? `${Math.round(vcpu * 100)}%` : vcpu}</span>}
                                <span style={{ color: /running|running/i.test(vstate) ? 'var(--paid)' : 'var(--unpaid)' }}>{vstate || '—'}</span>
                              </span>
                            </div>
                          );
                        })}
                        {/* power actions */}
                        {ag.vms.slice(0, 30).map((vm: any, i: number) => {
                          const vname = String(vm.name ?? vm.Name ?? '');
                          if (!vname) return null;
                          const host = ag.name || ag.hostname || ag.id.slice(0, 8);
                          return (
                            <div key={`act-${i}`} style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                              {(['start', 'stop', 'restart'] as const).map((action) => {
                                const key = `${ag.id}:${vname}:${action}`;
                                return (
                                  <button
                                    key={action}
                                    type="button"
                                    disabled={vmBusy !== null}
                                    onClick={() => queueVmPower(ag.id, vname, host, action)}
                                    style={{ fontSize: 10, padding: '2px 8px', borderRadius: 5, cursor: vmBusy ? 'wait' : 'pointer', border: '1px solid var(--glass-rim)', background: 'var(--surface-card)', color: 'var(--text-2)' }}
                                  >
                                    {vmBusy === key ? '…' : action === 'start' ? t('تشغيل') : action === 'stop' ? t('إيقاف') : t('إعادة')}
                                  </button>
                                );
                              })}
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
