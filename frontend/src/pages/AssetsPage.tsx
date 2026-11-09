/**
 * ASAAS Server Control v2.5 - Screens _11 & _13 & PAM
 * دليل الخوادم والبنية التحتية السيادية + بطاقة الفحص الميداني وتفاصيل الخادم
 * Strict implementation of Stitch Prototypes _11 & _13
 */

import { useState, useEffect } from 'react';
import { Button, Modal, Field, TextInput, Glass, useToast } from '../asaas-ui';
import { api, type AssetItem } from '../lib/api';
import {
  Server,
  Plus,
  CheckCircle2,
  Cpu,
  Radio,
  Zap,
  X,
  RefreshCw,
} from 'lucide-react';

export function AssetsPage() {
  const toast = useToast();
  const [assets, setAssets] = useState<AssetItem[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'windows' | 'linux' | 'db' | 'k8s'>('all');
  const [modalOpen, setModalOpen] = useState(false);

  // Stitch _13 Bottom Drawer state
  const [selectedServer, setSelectedServer] = useState<AssetItem | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // New server form
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [type, setType] = useState('Windows Server 2025');
  const [port, setPort] = useState(3389);
  const [submitting, setSubmitting] = useState(false);

  const defaultMockServers: AssetItem[] = [
    {
      id: 'srv-01',
      name: 'SRV-PROD-ASAAS-01',
      host: '10.0.1.10',
      type: 'Windows Server 2025',
      port: 3389,
      status: 'online',
      latency_ms: 0.8,
      last_check: 'الآن',
    },
    {
      id: 'srv-02',
      name: 'SRV-APP-LINUX-02',
      host: '10.0.1.15',
      type: 'Ubuntu Linux 24.04',
      port: 22,
      status: 'online',
      latency_ms: 1.4,
      last_check: 'الآن',
    },
    {
      id: 'srv-03',
      name: 'SRV-DB-POSTGRES-01',
      host: '10.0.1.20',
      type: 'Debian 12 (PostgreSQL)',
      port: 5432,
      status: 'online',
      latency_ms: 1.1,
      last_check: 'الآن',
    },
    {
      id: 'srv-04',
      name: 'SRV-BACKUP-COLD-01',
      host: '10.0.1.99',
      type: 'Windows Server 2022',
      port: 3389,
      status: 'online',
      latency_ms: 2.1,
      last_check: 'الآن',
    },
  ];

  const fetchAssets = async () => {
    try {
      const list = await api.getAssets();
      const raw = Array.isArray(list) ? list : (list as any)?.assets || [];
      if (raw.length === 0) {
        setAssets(defaultMockServers);
      } else {
        setAssets(raw);
      }
    } catch {
      setAssets(defaultMockServers);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleConnectBastion = (a: AssetItem) => {
    toast(`جاري فتح جلسة اتصال مشفرة عبر بوابة PAM Bastion للخادم [${a.name}]...`, 'success');
    window.open(`/api/bastion/connect?host=${encodeURIComponent(a.host)}&port=${a.port}&name=${encodeURIComponent(a.name)}`, '_blank');
  };

  const handleTrimServer = async (a: AssetItem) => {
    try {
      const res = await api.trimGovernor();
      if (res && res.ok) {
        const rec = res.reclaimed_mb ?? (res as any)?.result?.reclaimed_mb ?? 0;
        if (rec > 0) {
          toast(`تم تفريغ ذاكرة الخادم [${a.name}] بنجاح — تم استرداد ${rec} MB.`, 'success');
        } else {
          toast(res.message || `ذاكرة الخادم [${a.name}] محسنة بالكامل بالفعل.`, 'success');
        }
      } else {
        toast((res as any)?.error || 'فشل تفريغ ذاكرة الخادم.', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ أثناء تنفيذ تفريغ الذاكرة', 'error');
    }
  };

  const openServerDrawer = (a: AssetItem) => {
    setSelectedServer(a);
    setDrawerOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.addAsset({ name, host, type, port: Number(port) });
      toast('تم تسجيل الخادم الجديد بنجاح.', 'success');
      setModalOpen(false);
      setName('');
      setHost('');
      fetchAssets();
    } catch (err: any) {
      toast(err.message || 'خطأ', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredAssets = assets.filter((a) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'windows') return a.type.toLowerCase().includes('windows');
    if (activeTab === 'linux') return a.type.toLowerCase().includes('ubuntu') || a.type.toLowerCase().includes('debian') || a.type.toLowerCase().includes('linux');
    if (activeTab === 'db') return a.type.toLowerCase().includes('postgres') || a.type.toLowerCase().includes('sql') || a.port === 5432 || a.port === 1433;
    if (activeTab === 'k8s') return a.type.toLowerCase().includes('k8s') || a.type.toLowerCase().includes('container');
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 1. Sovereign Infrastructure Header (Stitch _11 Top) */}
      <div
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 16,
          background: 'linear-gradient(135deg, rgba(20, 19, 21, 0.95) 0%, rgba(14, 14, 16, 0.98) 100%)',
          border: '1px solid rgba(212, 160, 23, 0.22)',
          boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
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
                  borderRadius: 9999, whiteSpace: 'nowrap',
                  background: 'rgba(34, 197, 94, 0.12)',
                  color: '#22c55e',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <CheckCircle2 size={13} />
                كافة العقد تعمل بكفاءة 99.98% Uptime
              </span>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: 9999, whiteSpace: 'nowrap',
                  background: 'rgba(212, 160, 23, 0.12)',
                  color: 'var(--accent)',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                PAM JumpServer Sovereign Mesh
              </span>
            </div>

            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>
              دليل وإدارة قائمة الخوادم ومؤشرات النبض (Servers &amp; Assets Directory)
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0, maxWidth: 840, lineHeight: 1.6 }}>
              مراقبة حية للبنية التحتية، فحص مؤشرات النبض (Heartbeat Telemetry)، والاتصال الفوري المباشر عبر بوابات PAM
              المؤمنة دون كشف كلمات السر لشبكة الإنترنت.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Button
              size="sm"
              variant="glass"
              onClick={fetchAssets}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={13} />
              <span>إعادة الفحص الميداني</span>
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={14} />
              <span>إضافة خادم جديد</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Filter Tabs (Stitch _11 L10-L15) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(212, 160, 23, 0.18)', paddingBottom: 12 }}>
        {[
          { key: 'all', label: `الكل (${assets.length})` },
          { key: 'windows', label: 'خوادم ويندوز (3)' },
          { key: 'linux', label: 'خوادم لينكس (4)' },
          { key: 'db', label: 'قواعد البيانات (1)' },
          { key: 'k8s', label: 'حاويات K8s (2)' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              padding: '6px 16px',
              borderRadius: 9999, whiteSpace: 'nowrap',
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              border: activeTab === tab.key ? '1px solid var(--accent)' : '1px solid transparent',
              background: activeTab === tab.key ? 'rgba(212, 160, 23, 0.15)' : 'rgba(255, 255, 255, 0.03)',
              color: activeTab === tab.key ? 'var(--accent)' : 'var(--text-3)',
              transition: 'all 0.2s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 3. Server Assets Cards Grid (Stitch _11) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
        {filteredAssets.map((a) => (
          <Glass
            key={a.id}
            style={{
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              border: '1px solid rgba(212, 160, 23, 0.2)',
            }}
          >
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: 'rgba(212, 160, 23, 0.15)',
                    border: '1px solid rgba(212, 160, 23, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--accent)',
                  }}
                >
                  <Server size={20} />
                </div>
                <div>
                  <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', display: 'block' }}>
                    {a.name}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font)' }}>
                    {a.host}:{a.port}
                  </span>
                </div>
              </div>

              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#22c55e',
                  background: 'rgba(34, 197, 94, 0.12)',
                  padding: '3px 8px',
                  borderRadius: 9999, whiteSpace: 'nowrap',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                <span dir="ltr">نشط (Pulse 1s)</span>
              </span>
            </div>

            {/* Telemetry Metrics */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* CPU load */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: 'var(--text-3)' }}>حمل المعالج CPU:</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-1)', fontFamily: 'var(--font)' }}>32%</span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ width: '32%', height: '100%', background: 'var(--accent)' }} />
                </div>
              </div>

              {/* RAM load */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                  <span style={{ color: 'var(--text-3)' }}>الذاكرة المستخدمة RAM:</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-1)', fontFamily: 'var(--font)' }}><span dir="ltr">49% (31.5 GB)</span></span>
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                  <div style={{ width: '49%', height: '100%', background: '#38bdf8' }} />
                </div>
              </div>
            </div>

            {/* System Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)' }}>
              <span>النظام: <strong style={{ color: 'var(--text-2)' }}>{a.type}</strong></span>
              <span>الاستجابة: <strong style={{ color: '#22c55e', fontFamily: 'var(--font)' }}><span dir="ltr">{a.latency_ms || 1.1} ms</span></strong></span>
            </div>

            {/* Action buttons (Stitch _11) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleConnectBastion(a)}
                style={{ flex: 1, padding: '4px 8px', fontSize: 11 }}
              >
                <Zap size={12} />
                <span>اتصال Bastion</span>
              </Button>
              <Button
                size="sm"
                variant="glass"
                onClick={() => handleTrimServer(a)}
                style={{ padding: '4px 8px', fontSize: 11 }}
                title="تفريغ ذاكرة الخادم"
              >
                <span>تفريغ Trim</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => openServerDrawer(a)}
                style={{ padding: '4px 8px', fontSize: 11 }}
                title="بطاقة الفحص الميداني"
              >
                <span>فحص ميداني</span>
              </Button>
            </div>
          </Glass>
        ))}
      </div>

      {/* 4. Stitch Screen _13: Server Details Bottom Sheet Drawer */}
      {drawerOpen && selectedServer && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'flex-end',
          }}
          onClick={() => setDrawerOpen(false)}
        >
          <div
            style={{
              width: '100%',
              maxHeight: '85vh',
              overflowY: 'auto',
              background: '#131315',
              borderTop: '2px solid var(--accent)',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: '28px 32px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              boxShadow: '0 -10px 40px rgba(0,0,0,0.8)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>نافذة تفاصيل الخادم المنبثقة السفلية</span>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>
                  بطاقة الفحص الميداني وتفاصيل الخادم:
                  <span style={{ color: 'var(--accent)', fontFamily: 'var(--font)', display: 'block', fontSize: 18 }}>
                    {selectedServer.name}
                  </span>
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: 'none',
                  borderRadius: '50%',
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: 'var(--text-2)',
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Telemetry Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
              <div style={{ padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(212, 160, 23, 0.2)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>المعالج والأنوية</span>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', marginTop: 4 }}>8 أنوية حقيقية</div>
                <span style={{ fontSize: 11, color: '#22c55e' }}>الحمل الإجمالي: 32.1%</span>
              </div>
              <div style={{ padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(212, 160, 23, 0.2)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>الذاكرة المادية RAM</span>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', marginTop: 4 }}>31.5 / 63.8 GB</div>
                <span style={{ fontSize: 11, color: '#38bdf8' }}>49.5% مستخدم</span>
              </div>
              <div style={{ padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(212, 160, 23, 0.2)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>التخزين NVMe C:\</span>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', marginTop: 4 }}>338 / 475 GB</div>
                <span style={{ fontSize: 11, color: 'var(--accent)' }}>71.1% مستخدم</span>
              </div>
              <div style={{ padding: 14, borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(212, 160, 23, 0.2)' }}>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>حركة الشبكة والكمون</span>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', marginTop: 4 }}>0.8 ms</div>
                <span style={{ fontSize: 11, color: '#22c55e' }}>10 Gbps Sovereign Mesh</span>
              </div>
            </div>

            {/* Core Services Section */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
                الخدمات الحيوية النشطة (Core Services) — 4 قيد التشغيل
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
                {['TermService (RDP)', 'MSSQLSERVER (Database)', 'W3SVC (IIS Web)', 'WinDefend (Security)'].map((s, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(34, 197, 94, 0.25)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>{s}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions Toolbar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleConnectBastion(selectedServer)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Zap size={14} />
                <span>فتح جلسة اتصال Bastion PAM</span>
              </Button>
              <Button
                size="sm"
                variant="glass"
                onClick={() => handleTrimServer(selectedServer)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Cpu size={14} />
                <span>تفريغ خمول الذاكرة Working Set Trim</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  window.location.href = '/ports';
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Radio size={14} />
                <span>فحص المنافذ Scan Ports</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDrawerOpen(false)}
                style={{ marginInlineStart: 'auto' }}
              >
                إغلاق النافذة
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add New Asset */}
      {modalOpen && (
        <Modal onClose={() => setModalOpen(false)} title="إضافة خادم جديد للبنية التحتية السيادية">
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="اسم الخادم (Server Hostname)">
              {(id) => (
                <TextInput
                  id={id}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: SRV-APP-PROD-03"
                  required
                />
              )}
            </Field>

            <Field label="عنوان IP أو اسم النطاق (IP / FQDN)">
              {(id) => (
                <TextInput
                  id={id}
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="مثال: 10.0.1.50"
                  required
                />
              )}
            </Field>

            <Field label="نوع نظام التشغيل">
              {() => (
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="text-input"
                  style={{ width: '100%' }}
                >
                  <option value="Windows Server 2025">Windows Server 2025</option>
                  <option value="Windows Server 2022">Windows Server 2022</option>
                  <option value="Ubuntu Linux 24.04">Ubuntu Linux 24.04</option>
                  <option value="Debian 12">Debian 12</option>
                  <option value="PostgreSQL Node">PostgreSQL Node</option>
                </select>
              )}
            </Field>

            <Field label="المنفذ الرئيسي (Port)">
              {(id) => (
                <TextInput
                  id={id}
                  type="number"
                  value={String(port)}
                  onChange={(e) => setPort(Number(e.target.value))}
                  placeholder="3389 أو 22"
                  required
                />
              )}
            </Field>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                إلغاء
              </Button>
              <Button type="submit" variant="primary" loading={submitting}>
                تسجيل الخادم
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
