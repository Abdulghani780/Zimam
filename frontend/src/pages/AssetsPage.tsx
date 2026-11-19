/**
 * ASAAS v2.5 - Screens _11 & _13 & PAM
 * دليل الخوادم والبنية التحتية السيادية + بطاقة الفحص الميداني وتفاصيل الخادم
 * Strict implementation of Stitch Prototypes _11 & _13
 */

import { useState, useEffect } from 'react';
import { Button, Modal, Field, TextInput, Glass, Segmented, useToast } from '../asaas-ui';
import { api, type AssetItem } from '../lib/api';
import { apiV1, type V1Asset, type V1Account, type V1Agent } from '../lib/apiV1';
import { RemoteSession } from '../components/RemoteSession';
import {
  Server,
  Plus,
  CheckCircle2,
  Cpu,
  Radio,
  Zap,
  X,
  RefreshCw,
  MonitorPlay,
  KeyRound,
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

  // Direct remote session (guacd gateway) state
  const [sessionAsset, setSessionAsset] = useState<AssetItem | null>(null);
  const [sessionAccounts, setSessionAccounts] = useState<V1Account[]>([]);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionProtocol, setSessionProtocol] = useState<string>('rdp');

  // Agent telemetry linked to the open drawer asset (matched by hostname)
  const [drawerAgent, setDrawerAgent] = useState<V1Agent | null>(null);
  const [drawerResults, setDrawerResults] = useState<Record<string, { completed_at: string | null; result: unknown; error: string | null }>>({});
  const [drawerResultsLoading, setDrawerResultsLoading] = useState(false);

  const fetchAssets = async () => {
    try {
      const res = await apiV1.assets();
      const raw = Array.isArray(res) ? res : (res as { assets?: V1Asset[] })?.assets || [];
      setAssets(raw.map(toAssetItem));
    } catch (err: any) {
      setAssets([]);
      toast(err.message || t('تعذر تحميل الأصول.'), 'error');
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

  const handleDirectSession = async (a: AssetItem) => {
    try {
      const res = await apiV1.accounts();
      const all = Array.isArray(res) ? res : (res as { accounts?: V1Account[] })?.accounts || [];
      const matches = all.filter(
        (acc) => acc.asset_id === a.id && ['rdp', 'ssh', 'telnet', 'vnc'].includes(String(acc.protocol || '').toLowerCase()),
      );
      if (matches.length === 0) {
        toast(t('لا توجد حسابات مرتبطة بهذا الأصل — أضف حساباً من صفحة الخزنة أولاً.'), 'error');
        return;
      }
      setSessionAsset(a);
      setSessionAccounts(matches);
      setSessionToken(null);
    } catch {
      toast(t('تعذّر تحميل الحسابات المرتبطة بالأصل.'), 'error');
    }
  };

  const startSession = async (account: V1Account) => {
    if (!sessionAsset) return;
    const protocol = String(account.protocol || 'rdp').toLowerCase();
    try {
      const res = await apiV1.createConnectionToken({
        asset_id: sessionAsset.id,
        account_id: account.id,
        protocol: protocol as 'rdp' | 'ssh' | 'telnet' | 'vnc',
        actions: ['connect'],
      });
      const token = res?.token;
      if (!token) throw new Error('no token');
      setSessionProtocol(protocol);
      setSessionToken(token);
    } catch (err: any) {
      toast(err?.message || t('فشل إصدار رمز الجلسة — تحقق من سياسات الوصول والبوابة.'), 'error');
    }
  };

  const closeSession = () => {
    setSessionAsset(null);
    setSessionAccounts([]);
    setSessionToken(null);
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

  const uninstallSoftware = async (programName: string) => {
    if (!drawerAgent) return;
    if (!window.confirm(`${t('إلغاء تثبيت «')}${programName}${t('» على الوكيل (إلغاء صامت). متابعة؟')}`)) return;
    try {
      await apiV1.createJob({ agent_id: drawerAgent.id, job_type: 'software.uninstall', payload: { name: programName } });
      toast(t('تم إرسال مهمة إلغاء التثبيت — ينفذ على الوكيل خلال ~15 ثانية.'), 'success');
    } catch (err: any) {
      toast(err.message || t('فشل إرسال مهمة إلغاء التثبيت'), 'error');
    }
  };

  const openServerDrawer = async (a: AssetItem) => {
    setSelectedServer(a);
    setDrawerOpen(true);
    setDrawerAgent(null);
    setDrawerResults({});
    setDrawerResultsLoading(true);
    try {
      const agentsRes = await apiV1.agents();
      const all = Array.isArray(agentsRes) ? agentsRes : (agentsRes as { agents?: V1Agent[] })?.agents || [];
      const host = a.host.toLowerCase();
      const match = all.find((ag) => {
        const inv = (ag.inventory || {}) as Record<string, unknown>;
        const hn = String(inv.hostname || '').toLowerCase();
        return hn && (hn === host || host.includes(hn) || hn.includes(host));
      });
      if (match) {
        setDrawerAgent(match);
        const res = await apiV1.agentLatestResults(match.id);
        const rr = { ...res.results };
        // Normalize software.list payloads ({software:[...]}|{programs:[...]}) to a bare array for the table renderer.
        const sw = rr['software.list'];
        if (sw && !Array.isArray(sw.result) && sw.result && typeof sw.result === 'object') {
          const inner = (sw.result as Record<string, unknown>).software ?? (sw.result as Record<string, unknown>).programs ?? (sw.result as Record<string, unknown>).items;
          if (Array.isArray(inner)) rr['software.list'] = { ...sw, result: inner };
        }
        setDrawerResults(rr);
      }
    } catch (err: any) {
      toast(err.message || t('تعذر تحميل قياسات الوكيل للأصل.'), 'error');
    } finally {
      setDrawerResultsLoading(false);
    }
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

      {/* 2. Filter Tabs */}
<Segmented
value={activeTab}
onChange={(v) => setActiveTab(v as typeof activeTab)}
label={t('تصفية الأصول')}
options={[
{ value: 'all', label: t('الكل'), count: assets.length },
{ value: 'windows', label: t('خوادم ويندوز'), count: assets.filter((a) => matchesTab(a, 'windows')).length },
{ value: 'linux', label: t('خوادم لينكس'), count: assets.filter((a) => matchesTab(a, 'linux')).length },
{ value: 'db', label: t('قواعد البيانات'), count: assets.filter((a) => matchesTab(a, 'db')).length },
{ value: 'k8s', label: t('حاويات K8s'), count: assets.filter((a) => matchesTab(a, 'k8s')).length },
]}
/>
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
                variant="glass"
                onClick={() => handleDirectSession(a)}
                style={{ padding: '4px 8px', fontSize: 11 }}
                title={t('جلسة عن بُعد عبر البوابة')}
              >
                <MonitorPlay size={12} />
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

            {/* Agent-collected telemetry (real job results, hostname-matched) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
                {t('قياسات الوكيل المجمّعة')}
                {drawerAgent && (
                  <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginInlineStart: 8 }} dir="ltr">
                    {drawerAgent.name}
                  </span>
                )}
              </h4>
              {drawerResultsLoading ? (
                <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>{t('جارٍ تحميل قياسات الوكيل...')}</p>
              ) : !drawerAgent ? (
                <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
                  {t('لا يوجد وكيل ASAAS مطابق لاسم المضيف — ثبّت وكيلاً على هذا الخادم لتظهر القياسات الحقيقية هنا.')}
                </p>
              ) : Object.keys(drawerResults).length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
                  {t('الوكيل مرتبط لكن لا توجد نتائج مهام بعد — أرسل مهام جمع من صفحة الوكلاء.')}
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
                  {Object.entries(drawerResults).map(([jobType, entry]) => (
                    <details key={jobType} style={{ border: '1px solid var(--accent-soft)', borderRadius: 10, padding: '10px 12px', background: 'var(--glass-rim-low)' }}>
                      <summary style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-1)', cursor: 'pointer', fontFamily: 'var(--font-telemetry)' }} dir="ltr">
                        {jobType}
                        <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 400, marginInlineStart: 8 }}>
                          {entry.completed_at ? new Date(entry.completed_at).toLocaleString('ar-SA') : ''}
                        </span>
                      </summary>
                      {entry.error ? (
                        <span className="text-status-danger" style={{ fontSize: 11, display: 'block', marginTop: 6 }}>{entry.error}</span>
                      ) : jobType === 'software.list' && Array.isArray(entry.result) ? (
                        <div style={{ marginTop: 8, maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {(entry.result as any[]).slice(0, 60).map((sw: any, i: number) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 10, padding: '4px 6px', borderRadius: 6, background: 'var(--surface-ground)' }}>
                              <span style={{ fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {String(sw?.name || sw?.Name || sw?.DisplayName || '?')}
                              </span>
                              <span style={{ color: 'var(--text-3)', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 6 }} dir="ltr">
                                {String(sw?.version || sw?.Version || '')}{sw?.publisher || sw?.Publisher ? ` · ${String(sw.publisher || sw.Publisher).slice(0, 30)}` : ''}
                                {drawerAgent && (
                                  <button
                                    type="button"
                                    onClick={() => uninstallSoftware(String(sw?.name || sw?.Name || sw?.DisplayName || ''))}
                                    title={t('إلغاء تثبيت')}
                                    style={{ fontSize: 9, padding: '1px 6px', borderRadius: 6, border: '1px solid var(--status-danger, #e5484d)', background: 'transparent', color: 'var(--status-danger, #e5484d)', cursor: 'pointer', fontWeight: 700 }}
                                  >
                                    {t('إلغاء')}
                                  </button>
                                )}
                              </span>
                            </div>
                          ))}
                          {(entry.result as any[]).length > 60 && (
                            <div style={{ fontSize: 10, color: 'var(--text-3)' }}>+{(entry.result as any[]).length - 60} {t('برنامج آخر')}</div>
                          )}
                        </div>
                      ) : (
                        <pre dir="ltr" style={{ margin: '8px 0 0', fontSize: 10, fontFamily: 'var(--font-telemetry)', color: 'var(--text-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 180, overflowY: 'auto' }}>
                          {JSON.stringify(entry.result, null, 2)}
                        </pre>
                      )}
                    </details>
                  ))}
                </div>
              )}
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

      {/* Direct remote session overlay: account picker → live guacd session */}
      {sessionAsset && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1200,
            background: 'var(--surface-ground)',
            display: 'flex',
            flexDirection: 'column',
            padding: 20,
            gap: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>
                {t('جلسة عن بُعد —')}{' '}
                <span style={{ color: 'var(--accent)' }}>{sessionAsset.name}</span>
              </h2>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }} dir="ltr">
                {sessionAsset.host}:{sessionAsset.port}
              </span>
            </div>
            <Button size="sm" variant="ghost" onClick={closeSession}>
              <X size={16} /> {t('إنهاء الجلسة')}
            </Button>
          </div>

          {!sessionToken ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Glass thick style={{ padding: 28, maxWidth: 520, width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <KeyRound size={20} style={{ color: 'var(--accent)' }} />
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>
                    {t('اختر الحساب لبدء الجلسة')}
                  </h3>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
                  {t('سيُصدر رمز اتصال لمرة واحدة قصير العمر — بيانات الاعتماد لا تغادر الخادم.')}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sessionAccounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => startSession(acc)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                        padding: '12px 16px',
                        borderRadius: 12,
                        border: '1px solid var(--accent-soft)',
                        background: 'var(--glass-rim-low)',
                        color: 'var(--text-1)',
                        cursor: 'pointer',
                        fontSize: 14,
                        fontWeight: 600,
                        textAlign: 'start',
                      }}
                    >
                      <span>{acc.name || acc.username}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }} dir="ltr">{acc.protocol}</span>
                    </button>
                  ))}
                </div>
              </Glass>
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <RemoteSession
                protocol={sessionProtocol}
                token={sessionToken}
                onClose={closeSession}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
