/**
 * ASAAS Server Control v2.5 - Screens _11 & _13 & PAM
 * دليل الخوادم والبنية التحتية السيادية + بطاقة الفحص الميداني وتفاصيل الخادم
 * Strict implementation of Stitch Prototypes _11 & _13
 */

import { useState, useEffect } from 'react';
import { Button, Modal, Field, TextInput, Glass, useToast } from '../asaas-ui';
import { api, type AssetItem } from '../lib/api';
import { apiV1, type V1Asset } from '../lib/apiV1';
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
import { t } from '../lib/i18n';

const toAssetItem = (a: V1Asset): AssetItem => ({
  id: a.id,
  name: a.name,
  host: a.hostname,
  type: String(a.metadata?.asset_type || a.platform || '—'),
  port: a.port ?? 0,
  protocol: a.protocol ?? undefined,
  status: a.status || 'unknown',
  latency_ms: 0,
  last_check: '—',
});

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

  const fetchAssets = async () => {
    try {
      const res = await apiV1.assets();
      const raw = Array.isArray(res) ? res : (res as { assets?: V1Asset[] })?.assets || [];
      setAssets(raw.map(toAssetItem));
    } catch {
      setAssets([]);
    }
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleConnectBastion = (a: AssetItem) => {
    const protocol = (a.protocol || 'RDP').toUpperCase();
    const port = a.port || (protocol === 'RDP' ? 3389 : 22);
    const url = `/api/bastion/connect?host=${encodeURIComponent(a.host)}&port=${encodeURIComponent(String(port))}&name=${encodeURIComponent(a.name)}&username=Administrator&protocol=${encodeURIComponent(protocol)}`;
    window.open(url, '_blank');
    toast(`${t('تم إرسال طلب جلسة ')}${protocol}${t(' للأصل [')}${a.name}${t('] عبر بوابة الحصن.')}`, 'success');
  };

  const handleTrimServer = async (a: AssetItem) => {
    try {
      const res = await api.trimGovernor();
      if (res && res.ok) {
        const rec = res.reclaimed_mb ?? (res as any)?.result?.reclaimed_mb ?? 0;
        if (rec > 0) {
          toast(`${t('تم تفريغ ذاكرة الخادم [')}${a.name}${t('] بنجاح — تم استرداد ')}${rec} MB.`, 'success');
        } else {
          toast(res.message || `${t('ذاكرة الخادم [')}${a.name}${t('] محسنة بالكامل بالفعل.')}`, 'success');
        }
      } else {
        toast((res as any)?.error || t('فشل تفريغ ذاكرة الخادم.'), 'error');
      }
    } catch (err: any) {
      toast(err.message || t('خطأ أثناء تنفيذ تفريغ الذاكرة'), 'error');
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
      await apiV1.createAsset({
        name,
        hostname: host,
        platform: type.toLowerCase().includes('windows') ? 'windows' : 'linux',
        port: Number(port) || null,
        protocol: type.toLowerCase().includes('windows') ? 'rdp' : 'ssh',
        metadata: { asset_type: type },
      });
      toast(t('تم تسجيل الخادم الجديد بنجاح.'), 'success');
      setModalOpen(false);
      setName('');
      setHost('');
      fetchAssets();
    } catch (err: any) {
      toast(err.message || t('خطأ'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const matchesTab = (a: AssetItem, tab: 'all' | 'windows' | 'linux' | 'db' | 'k8s') => {
    if (tab === 'all') return true;
    if (tab === 'windows') return a.type.toLowerCase().includes('windows');
    if (tab === 'linux') return a.type.toLowerCase().includes('ubuntu') || a.type.toLowerCase().includes('debian') || a.type.toLowerCase().includes('linux');
    if (tab === 'db') return a.type.toLowerCase().includes('postgres') || a.type.toLowerCase().includes('sql') || a.port === 5432 || a.port === 1433;
    if (tab === 'k8s') return a.type.toLowerCase().includes('k8s') || a.type.toLowerCase().includes('container');
    return true;
  };

  const filteredAssets = assets.filter((a) => matchesTab(a, activeTab));

  return (
    <div className="page">
      {/* Product page header */}
      <div className="page-hero"
        style={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 16,
          background: 'linear-gradient(135deg, var(--glass-tint-strong) 0%, var(--surface-ground) 100%)',
          border: '1px solid var(--accent-soft)',
          boxShadow: '0 12px 32px var(--shadow-soft)',
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
                  background: 'var(--paid-bg)',
                  color: 'var(--paid)',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <CheckCircle2 size={13} />
                {assets.length ? `${assets.length}${t(' أصل مسجل من Control Plane')}` : t('لا توجد أصول مسجلة بعد')}
              </span>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: 9999, whiteSpace: 'nowrap',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                Control Plane / Agent heartbeat
              </span>
            </div>

            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>
              {t('دليل وإدارة قائمة الخوادم ومؤشرات النبض')} (Servers &amp; Assets Directory)
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0, maxWidth: 840, lineHeight: 1.6 }}>
              {t('مراقبة حالة الأصول المسجلة عبر Agent heartbeat، مع تجهيز الاتصال لرموز جلسات قصيرة العمر دون كشف كلمات السر للمتصفح.')}
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
              <span>{t('إعادة الفحص الميداني')}</span>
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setModalOpen(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={14} />
              <span>{t('إضافة خادم جديد')}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Filter Tabs (Stitch _11 L10-L15) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid var(--accent-soft)', paddingBottom: 12 }}>
        {[
          { key: 'all', label: `${t('الكل (')}${assets.length})` },
          { key: 'windows', label: `${t('خوادم ويندوز (')}${assets.filter((a) => matchesTab(a, 'windows')).length})` },
          { key: 'linux', label: `${t('خوادم لينكس (')}${assets.filter((a) => matchesTab(a, 'linux')).length})` },
          { key: 'db', label: `${t('قواعد البيانات (')}${assets.filter((a) => matchesTab(a, 'db')).length})` },
          { key: 'k8s', label: `${t('حاويات K8s (')}${assets.filter((a) => matchesTab(a, 'k8s')).length})` },
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
              background: activeTab === tab.key ? 'var(--accent-soft)' : 'var(--glass-rim-low)',
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
              border: '1px solid var(--accent-soft)',
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
                    background: 'var(--accent-soft)',
                    border: '1px solid var(--accent-soft)',
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
                  color: a.status === 'online' ? 'var(--paid)' : 'var(--unpaid)',
                  background: a.status === 'online' ? 'var(--paid-bg)' : 'var(--unpaid-bg)',
                  padding: '3px 8px',
                  borderRadius: 9999, whiteSpace: 'nowrap',
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: a.status === 'online' ? 'var(--paid)' : 'var(--unpaid)' }} />
                <span dir="ltr">{a.status || 'unknown'}</span>
              </span>
            </div>

            {/* Real asset state reported by the backend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: 'var(--text-3)' }}>{t('حالة الأصل:')}</span>
                <span style={{ fontWeight: 700, color: 'var(--text-1)', fontFamily: 'var(--font)' }} dir="ltr">{a.status || 'unknown'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: 'var(--text-3)' }}>{t('آخر فحص مسجل:')}</span>
                <span style={{ fontWeight: 700, color: 'var(--text-1)', fontFamily: 'var(--font)' }} dir="ltr">{a.last_check || '—'}</span>
              </div>
            </div>

            {/* System Info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)' }}>
              <span>{t('النظام:')} <strong style={{ color: 'var(--text-2)' }}>{a.type}</strong></span>
              <span>{t('الاستجابة:')} <strong style={{ color: 'var(--paid)', fontFamily: 'var(--font)' }}><span dir="ltr">{a.latency_ms > 0 ? `${a.latency_ms} ms` : t('غير متاح')}</span></strong></span>
            </div>

            {/* Action buttons (Stitch _11) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--glass-rim-low)' }}>
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleConnectBastion(a)}
                style={{ flex: 1, padding: '4px 8px', fontSize: 11 }}
              >
                <Zap size={12} />
                <span>{t('اتصال Bastion')}</span>
              </Button>
              <Button
                size="sm"
                variant="glass"
                onClick={() => handleTrimServer(a)}
                style={{ padding: '4px 8px', fontSize: 11 }}
                title={t('تفريغ ذاكرة الخادم')}
              >
                <span>{t('تفريغ Trim')}</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => openServerDrawer(a)}
                style={{ padding: '4px 8px', fontSize: 11 }}
                title={t('بطاقة الفحص الميداني')}
              >
                <span>{t('فحص ميداني')}</span>
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
            background: 'var(--shadow-soft)',
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
              background: 'var(--surface-ground)',
              borderTop: '2px solid var(--accent)',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              padding: '28px 32px',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              boxShadow: '0 -10px 40px var(--shadow-soft)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{t('نافذة تفاصيل الخادم المنبثقة السفلية')}</span>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>
                  {t('بطاقة الفحص الميداني وتفاصيل الخادم:')}
                  <span style={{ color: 'var(--accent)', fontFamily: 'var(--font)', display: 'block', fontSize: 18 }}>
                    {selectedServer.name}
                  </span>
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                style={{
                  background: 'var(--glass-rim-low)',
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

            {/* Telemetry Grid — no agent-linked metrics exist yet, show honest state */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14 }}>
              {[
                { label: t('المعالج والأنوية'), value: '—' },
                { label: t('الذاكرة المادية RAM'), value: '—' },
                { label: t('التخزين'), value: '—' },
                { label: t('حركة الشبكة والكمون'), value: selectedServer.latency_ms > 0 ? `${selectedServer.latency_ms} ms` : '—' },
              ].map((m) => (
                <div key={m.label} style={{ padding: 14, borderRadius: 10, background: 'var(--glass-rim-low)', border: '1px solid var(--accent-soft)' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{m.label}</span>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', marginTop: 4 }}>{m.value}</div>
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('لا تتوفر قياسات — تتطلب وكيلاً مرتبطاً بالأصل')}</span>
                </div>
              ))}
            </div>

            {/* Core Services Section — not collected yet */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
                {t('الخدمات النشطة — غير متاحة')}
              </h4>
              <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
                {t('لا تُجمع بيانات الخدمات بعد. عندما يرتبط وكيلاً ASAAS بهذا الأصل عبر /api/v1/agents وتُنفَّذ مهمة service.list موقعة ستظهر النتائج الحقيقية هنا.')}
              </p>
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
                <span>{t('طلب جلسة عبر السياسة')}</span>
              </Button>
              <Button
                size="sm"
                variant="glass"
                onClick={() => handleTrimServer(selectedServer)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Cpu size={14} />
                <span>{t('تفريغ خمول الذاكرة Working Set Trim')}</span>
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
                <span>{t('فحص المنافذ Scan Ports')}</span>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setDrawerOpen(false)}
                style={{ marginInlineStart: 'auto' }}
              >
                {t('إغلاق النافذة')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add New Asset */}
      {modalOpen && (
        <Modal onClose={() => setModalOpen(false)} title={t('إضافة خادم جديد للبنية التحتية السيادية')}>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label={t('اسم الخادم (Server Hostname)')}>
              {(id) => (
                <TextInput
                  id={id}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('مثال: SRV-APP-PROD-03')}
                  required
                />
              )}
            </Field>

            <Field label={t('عنوان IP أو اسم النطاق (IP / FQDN)')}>
              {(id) => (
                <TextInput
                  id={id}
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder={t('مثال: 10.0.1.50')}
                  required
                />
              )}
            </Field>

            <Field label={t('نوع نظام التشغيل')}>
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

            <Field label={t('المنفذ الرئيسي (Port)')}>
              {(id) => (
                <TextInput
                  id={id}
                  type="number"
                  value={String(port)}
                  onChange={(e) => setPort(Number(e.target.value))}
                  placeholder={t('3389 أو 22')}
                  required
                />
              )}
            </Field>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
              <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>
                {t('إلغاء')}
              </Button>
              <Button type="submit" variant="primary" loading={submitting}>
                {t('تسجيل الخادم')}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
