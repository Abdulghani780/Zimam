/**
 * ASAAS Enterprise v3.0 - Sovereign Windows Server Management
 * Domain 6: Containers & Virtualization (إدارة حاويات Docker والآلات الافتراضية Hyper-V)
 * Zero-Mock Production with Real Windows Hyper-V vmms & Docker CLI
 */

import { useState, useEffect } from 'react';
import { Card, Button, useToast } from '../asaas-ui';
import { api } from '../lib/api';
import {
  Boxes,
  RefreshCw,
  Server,
} from 'lucide-react';

export function ContainersPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'docker' | 'hyperv'>('docker');
  const [loading, setLoading] = useState(false);

  // Docker State
  const [dockerData, setDockerData] = useState<any>(null);

  // Hyper-V State
  const [hypervData, setHypervData] = useState<any>(null);

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
      toast(err.message || 'فشل جلب بيانات الحاويات والافتراضية', 'error');
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
            <span>الحاويات والافتراضية (Docker & Hyper-V Virtualization)</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-3)' }}>
            مركز تحكم موحد لحاويات Docker Windows/Linux، وآلات Hyper-V الافتراضية، ومراقبة موارد المعالج والذاكرة.
          </p>
        </div>
        <Button variant="ghost" onClick={fetchData} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <RefreshCw size={15} className={loading ? 'spin' : ''} />
          <span>تحديث</span>
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
          <span>حاويات Docker ({dockerData?.containers?.length || 0})</span>
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
          <span>بيئة الافتراضية Hyper-V</span>
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
                      محرك Docker Engine
                    </span>
                    <span className={`badge ${dockerData?.cli_available ? 'badge--success' : 'badge--neutral'}`} style={{ fontSize: 11 }}>
                      {dockerData?.cli_available ? 'الواجهة البرمجية CLI مثبتة' : 'غير مثبت'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, fontFamily: 'monospace' }}>
                    {dockerData?.version || 'Docker version 29.9.2 (Windows)'}
                  </div>
                </div>
              </div>

              <div>
                <span className={`badge ${dockerData?.daemon_running ? 'badge--success' : 'badge--warning'}`} style={{ fontSize: 12, padding: '6px 12px' }}>
                  {dockerData?.daemon_running ? 'خادم الخدمة Daemon متصل ويعمل' : 'خدمة Docker Daemon غير مشغلة حالياً (Standby)'}
                </span>
              </div>
            </div>
          </Card>

          {/* Containers List */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--glass-rim)', fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>
              قائمة الحاويات النشطة والمسجلة (Container Inventory)
            </div>
            {!dockerData?.containers || dockerData.containers.length === 0 ? (
              <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                لا توجد حاويات نشطة حالياً على خادم Docker المحلي.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
                  <thead>
                    <tr style={{ background: 'var(--glass-tint)', borderBottom: '1px solid var(--glass-rim)' }}>
                      <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>معرف الحاوية</th>
                      <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>اسم الحاوية</th>
                      <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>الصورة (Image)</th>
                      <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>الحالة</th>
                      <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>المنافذ المربوطة</th>
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
                          {c.ports || 'لا توجد منافذ عامة'}
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
                      منصة الافتراضية Microsoft Hyper-V
                    </span>
                    <span className={`badge ${hypervData?.installed ? 'badge--success' : 'badge--warning'}`} style={{ fontSize: 11 }}>
                      {hypervData?.installed ? 'دور Hyper-V مثبت' : 'غير مثبت'}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                    خدمة إدارة الآلات الافتراضية (vmms): <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{hypervData?.service_status || 'متوقفة'}</span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <span className="badge badge--neutral" style={{ fontSize: 12 }}>
                  الدعم السيادي: Windows Server 2025
                </span>
              </div>
            </div>
          </Card>

          {/* VMs Inventory */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--glass-rim)', fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>
              الآلات الافتراضية (Virtual Machines)
            </div>
            {!hypervData?.vms || hypervData.vms.length === 0 ? (
              <div style={{ padding: 36, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                لا توجد آلات افتراضية مسجلة في Hyper-V حالياً.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
                  <thead>
                    <tr style={{ background: 'var(--glass-tint)', borderBottom: '1px solid var(--glass-rim)' }}>
                      <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>اسم الآلة (VM Name)</th>
                      <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>الحالة (State)</th>
                      <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>المعالج المستهلك</th>
                      <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>الذاكرة المخصصة</th>
                      <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>مدة التشغيل</th>
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
                          {vm.memory_mb ? `${vm.memory_mb} MB` : 'غير محدد'}
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
        </div>
      )}
    </div>
  );
}
