import { useEffect, useState } from 'react';
import { Card, Button, Modal, Field, Select, TextInput, useToast, TableContainer, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmpty } from '../zimam-ui';
import { apiV1, type V1Agent, type V1AgentJob, type V1Asset } from '../lib/apiV1';
import { Bot, ClipboardList, DownloadCloud, Play, Radar, RefreshCw, Terminal } from 'lucide-react';
import { t } from '../lib/i18n';

const JOB_TYPES = [
  { value: 'system.info', label: t('معلومات النظام') },
  { value: 'process.list', label: t('قائمة العمليات') },
  { value: 'service.list', label: t('قائمة الخدمات') },
  { value: 'disk.list', label: t('الأقراص') },
  { value: 'inventory.collect', label: t('جمع الجرد') },
  { value: 'session.list', label: t('جلسات ويندوز النشطة') },
  { value: 'network.info', label: t('معلومات الشبكة') },
  { value: 'eventlog.tail', label: t('أحداث سجل النظام') },
  { value: 'software.list', label: t('البرامج المثبتة') },
  { value: 'firewall.state', label: t('حالة جدار الحماية') },
  { value: 'agent.update', label: t('تحديث الوكيل') },
  { value: 'windows.features', label: t('أدوار وميزات ويندوز') },
  { value: 'scheduled.tasks', label: t('المهام المجدولة') },
  { value: 'local.users', label: t('مستخدمو الجهاز المحلي') },
  { value: 'shares.list', label: t('المشاركات الشبكية') },
  { value: 'hotfix.list', label: t('تحديثات ويندوز') },
];

// Read-only collector set dispatched by the "collect all" action.
// session.logoff and agent.update are intentionally excluded (not collectors).
const COLLECTOR_JOB_TYPES = [
  'system.info', 'process.list', 'service.list', 'disk.list',
  'inventory.collect', 'session.list', 'network.info',
  'eventlog.tail', 'software.list', 'firewall.state',
  'windows.features', 'scheduled.tasks', 'local.users',
  'shares.list', 'hotfix.list',
];

const asArray = <T,>(res: unknown): T[] =>
  Array.isArray(res) ? (res as T[])
    : Array.isArray((res as { agents?: T[]; jobs?: T[]; assets?: T[] })?.agents)
      ? (res as { agents: T[] }).agents
      : Array.isArray((res as { jobs?: T[]; assets?: T[] })?.jobs)
        ? (res as { jobs: T[] }).jobs
        : Array.isArray((res as { assets?: T[] })?.assets)
          ? (res as { assets: T[] }).assets
          : [];

export function AgentsPage() {
  const toast = useToast();
  const [agents, setAgents] = useState<V1Agent[]>([]);
  const [assets, setAssets] = useState<V1Asset[]>([]);
  const [jobs, setJobs] = useState<V1AgentJob[]>([]);
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [jobModalAgent, setJobModalAgent] = useState<V1Agent | null>(null);
  const [jobType, setJobType] = useState('system.info');
  const [submitting, setSubmitting] = useState(false);
  const [bundle, setBundle] = useState<Record<string, unknown> | null>(null);
  const [bundleFile, setBundleFile] = useState<File | null>(null);
  const [bundleVersion, setBundleVersion] = useState('');
  const [bundleSha, setBundleSha] = useState('');
  const [bundleBusy, setBundleBusy] = useState(false);
  const [resultsAgent, setResultsAgent] = useState<V1Agent | null>(null);
  const [latestResults, setLatestResults] = useState<Record<string, { job_id: string; completed_at: string | null; result: unknown; error: string | null }>>({});
  const [resultsLoading, setResultsLoading] = useState(false);

  const openResults = async (agent: V1Agent) => {
    setResultsAgent(agent);
    setLatestResults({});
    setResultsLoading(true);
    try {
      const res = await apiV1.agentLatestResults(agent.id);
      setLatestResults(res.results || {});
    } catch (err: any) {
      toast(err.message || t('فشل جلب نتائج الوكيل'), 'error');
      setResultsAgent(null);
    } finally {
      setResultsLoading(false);
    }
  };

  const sha256Hex = async (file: File) => {
    const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const pickBundle = async (file: File | null) => {
    setBundleFile(file);
    setBundleSha(file ? await sha256Hex(file) : '');
  };

  const uploadBundle = async () => {
    if (!bundleFile || !bundleVersion.trim() || !bundleSha) return;
    setBundleBusy(true);
    try {
      const res = await apiV1.uploadUpdateBundle(bundleFile, bundleVersion.trim(), bundleSha);
      toast(t('تم نشر حزمة التحديث — وجّه مهمة agent.update للوكلاء لتثبيتها.'), 'success');
      setBundle(res as Record<string, unknown>);
      setBundleFile(null);
      setBundleVersion('');
      setBundleSha('');
    } catch (err: any) {
      toast(err.message || t('فشل رفع الحزمة'), 'error');
    } finally {
      setBundleBusy(false);
    }
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [a, j, b, ast] = await Promise.all([
        apiV1.agents(), apiV1.jobs(), apiV1.updateBundleStatus().catch(() => null),
        apiV1.assets().catch(() => []),
      ]);
      setAgents(asArray<V1Agent>(a));
      setAssets(asArray<V1Asset>(ast));
      setJobs(asArray<V1AgentJob>(j));
      setBundle(b as Record<string, unknown> | null);
    } catch (err: any) {
      toast(err.message || t('فشل جلب بيانات الوكلاء'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const agentHostname = (a: V1Agent): string => {
    const inv = (a.inventory || {}) as Record<string, unknown>;
    return String(inv.hostname || '').toLowerCase();
  };

  const linkedAsset = (a: V1Agent): V1Asset | null => {
    const hn = agentHostname(a);
    if (!hn) return null;
    return assets.find((ast) => {
      const ah = String(ast.hostname || '').toLowerCase();
      return ah && (ah === hn || ah.includes(hn) || hn.includes(ah));
    }) || null;
  };

  const collectAll = async (agent: V1Agent) => {
    setCollectingId(agent.id);
    try {
      const results = await Promise.allSettled(
        COLLECTOR_JOB_TYPES.map((job_type) => apiV1.createJob({ agent_id: agent.id, job_type, payload: {} })),
      );
      const ok = results.filter((r) => r.status === 'fulfilled').length;
      if (ok === COLLECTOR_JOB_TYPES.length) {
        toast(t('تم إرسال كل مهام الجمع — ستظهر النتائج خلال ~30 ثانية في زر «نتائج».'), 'success');
      } else {
        toast(`${t('أُرسلت')} ${ok}/${COLLECTOR_JOB_TYPES.length} ${t('مهمة — بعضها فشل')}`, 'error');
      }
      setTimeout(fetchAll, 30000);
    } finally {
      setCollectingId(null);
    }
  };

  const dispatchJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobModalAgent) return;
    setSubmitting(true);
    try {
      await apiV1.createJob({ agent_id: jobModalAgent.id, job_type: jobType, payload: {} });
      toast(t('تم إرسال المهمة الموقعة إلى الوكيل — ستظهر النتيجة خلال ~15 ثانية.'), 'success');
      setJobModalAgent(null);
      setTimeout(fetchAll, 20000);
    } catch (err: any) {
      toast(err.message || t('فشل إرسال المهمة'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-hero" style={{ borderRadius: 16, padding: '24px 28px', background: 'linear-gradient(135deg, var(--glass-tint-strong), var(--surface-ground))', border: '1px solid var(--accent-soft)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', margin: '0 0 8px' }}>{t('وكلاء الأصول (ZIMAM Agents)')}</h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0, maxWidth: 800, lineHeight: 1.6 }}>
              {t('وكلاء Windows خروجية فقط يُسجَّلون عبر مفتاح لمرة واحدة، ويستلمون مهاماً موقعة Ed25519 للقراءة فقط — لا يوجد تنفيذ أوامر كتابية عن بُعد.')}
            </p>
          </div>
          <Button size="sm" variant="glass" onClick={fetchAll} loading={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={13} /><span>{t('تحديث')}</span>
          </Button>
        </div>
      </div>

      <Card title={`${t('الوكلاء المسجلون (')}${agents.length})`} icon="users">
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('الاسم')}</TableHead>
                <TableHead>{t('الحالة')}</TableHead>
                <TableHead>{t('آخر ظهور')}</TableHead>
                <TableHead>{t('الجرد')}</TableHead>
                <TableHead>{t('الأصل المرتبط')}</TableHead>
                <TableHead style={{ textAlign: 'end' }}>{t('إجراء')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.length === 0 ? (
                <TableEmpty colSpan={6} message={loading ? t('جارٍ التحميل...') : t('لا يوجد وكلاء مسجلون. سجّل وكيلاً عبر POST /api/v1/agents/enroll.')} />
              ) : agents.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-bold text-title">
                    <span className="inline-flex items-center gap-2"><Bot size={15} className="text-primary" />{a.name || a.id.slice(0, 8)}</span>
                  </TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${a.status === 'online' ? 'bg-status-safe-surface text-status-safe' : 'bg-surface-glass-tint text-muted'}`}>
                      {a.status || 'enrolled'}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted font-telemetry">
                    {a.last_seen_at ? new Date(a.last_seen_at).toLocaleString('ar-SA') : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted font-telemetry">
                    {a.inventory?.hostname ? String(a.inventory.hostname) : '—'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {(() => {
                      const ast = linkedAsset(a);
                      return ast ? (
                        <span className="text-title font-bold">{ast.name}<span className="text-muted font-telemetry" dir="ltr"> · {ast.hostname}</span></span>
                      ) : (
                        <span className="text-muted">—</span>
                      );
                    })()}
                  </TableCell>
                  <TableCell style={{ textAlign: 'end' }}>
                    <div style={{ display: 'inline-flex', gap: 6 }}>
                      <Button size="sm" variant="glass" onClick={() => collectAll(a)} loading={collectingId === a.id} title={t('تشغيل كل مهام الجمع دفعة واحدة')} style={{ fontSize: 11, padding: '3px 8px' }}>
                        <Radar size={11} style={{ marginInlineEnd: 4 }} />{t('قياسات')}
                      </Button>
                      <Button size="sm" variant="glass" onClick={() => openResults(a)} style={{ fontSize: 11, padding: '3px 8px' }}>
                        <ClipboardList size={11} style={{ marginInlineEnd: 4 }} />{t('نتائج')}
                      </Button>
                      <Button size="sm" variant="glass" onClick={() => setJobModalAgent(a)} style={{ fontSize: 11, padding: '3px 8px' }}>
                        <Play size={11} style={{ marginInlineEnd: 4 }} />{t('مهمة')}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Card title={t('حزمة التحديث الذاتي')} icon="vault">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0, lineHeight: 1.7 }}>
            {t('ارفع ملف Zimam.Agent.exe الجديد مرة واحدة، ثم أرسل مهمة agent.update موقعة — الوكيل يتحقق من البصمة SHA-256 ويطبّقها عند إعادة التشغيل.')}
          </p>
          {bundle?.available ? (
            <div style={{ fontSize: 12, color: 'var(--text-2)', background: 'var(--surface-glass-tint)', borderRadius: 10, padding: '10px 14px', fontFamily: 'var(--font-telemetry)' }}>
              {t('المنشور')}: v{String(bundle.version)} · {String(bundle.sha256).slice(0, 16)}… · {Math.round(Number(bundle.size_bytes) / 1048576)} MB · {String(bundle.uploaded_by)}
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{t('لا توجد حزمة منشورة حالياً.')}</div>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <Field label={t('ملف التحديث (.exe)')}>
              {() => (
                <input
                  type="file"
                  accept=".exe"
                  aria-label={t('ملف التحديث (.exe)')}
                  onChange={(e) => void pickBundle(e.target.files?.[0] ?? null)}
                  style={{ fontSize: 12, color: 'var(--text-2)' }}
                />
              )}
            </Field>
            <Field label={t('الإصدار')}>
              {(id) => <TextInput id={id} value={bundleVersion} onChange={(e) => setBundleVersion(e.target.value)} placeholder="1.1.0" dir="ltr" style={{ width: 110 }} />}
            </Field>
            <Button
              size="sm"
              variant="primary"
              loading={bundleBusy}
              disabled={!bundleFile || !bundleVersion.trim() || !bundleSha}
              onClick={uploadBundle}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <DownloadCloud size={14} />{t('نشر الحزمة')}
            </Button>
          </div>
          {bundleSha && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-telemetry)', wordBreak: 'break-all' }}>
              SHA-256: {bundleSha}
            </div>
          )}
        </div>
      </Card>

      <Card title={t('سجل المهام الموقعة')} icon="vault" actions={<span style={{ fontSize: 12, color: 'var(--text-3)' }}>{jobs.length} مهمة</span>}>
        <TableContainer className="max-h-[380px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('المهمة')}</TableHead>
                <TableHead>{t('النوع')}</TableHead>
                <TableHead>{t('الحالة')}</TableHead>
                <TableHead>{t('النتيجة')}</TableHead>
                <TableHead>{t('الوقت')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.length === 0 ? (
                <TableEmpty colSpan={5} message={t('لا توجد مهام بعد.')} />
              ) : jobs.map((j) => (
                <TableRow key={j.id}>
                  <TableCell className="font-telemetry text-xs text-muted">{j.id.slice(0, 8)}…</TableCell>
                  <TableCell className="text-xs font-bold text-title">{j.job_type}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded font-bold ${j.status === 'succeeded' ? 'bg-status-safe-surface text-status-safe' : j.status === 'failed' ? 'bg-status-danger-surface text-status-danger' : 'bg-surface-glass-tint text-muted'}`}>
                      {j.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted">
                    {j.result?.error ? <span className="text-status-danger">{j.result.error}</span> : j.result ? '✓' : '—'}
                  </TableCell>
                  <TableCell className="text-xs text-muted font-telemetry whitespace-nowrap">
                    {j.completed_at || j.created_at ? new Date((j.completed_at || j.created_at) as string).toLocaleString('ar-SA') : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {resultsAgent && (
        <Modal open onClose={() => setResultsAgent(null)} title={`${t('آخر نتائج مجمّعة — ')}${resultsAgent.name || resultsAgent.id}`} wide>
          {resultsLoading ? (
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>{t('جارٍ التحميل...')}</p>
          ) : Object.keys(latestResults).length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--text-3)' }}>{t('لا توجد نتائج ناجحة بعد — أرسل مهمة قراءة من زر «مهمة».')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '65vh', overflowY: 'auto' }}>
              {Object.entries(latestResults).map(([jobType, entry]) => (
                <div key={jobType} style={{ border: '1px solid var(--accent-soft)', borderRadius: 12, padding: '12px 14px', background: 'var(--glass-rim-low)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-1)', fontFamily: 'var(--font-telemetry)' }} dir="ltr">{jobType}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
                      {entry.completed_at ? new Date(entry.completed_at).toLocaleString('ar-SA') : '—'}
                    </span>
                  </div>
                  {entry.error ? (
                    <span className="text-status-danger" style={{ fontSize: 12 }}>{entry.error}</span>
                  ) : (
                    <pre
                      dir="ltr"
                      style={{
                        margin: 0,
                        fontSize: 11,
                        fontFamily: 'var(--font-telemetry)',
                        color: 'var(--text-2)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        maxHeight: 220,
                        overflowY: 'auto',
                        background: 'var(--surface-ground)',
                        borderRadius: 8,
                        padding: 10,
                      }}
                    >
                      {JSON.stringify(entry.result, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {jobModalAgent && (
        <Modal open onClose={() => setJobModalAgent(null)} title={`${t('إرسال مهمة موقعة إلى ')}${jobModalAgent.name || jobModalAgent.id}`}>
          <form onSubmit={dispatchJob} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label={t('نوع المهمة (قراءة فقط)')}>
              {(id) => (
                <Select id={id} value={jobType} onChange={(e) => setJobType(e.target.value)}>
                  {JOB_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label} ({t.value})</option>)}
                </Select>
              )}
            </Field>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
              {t('تُوقَّع المهمة بتوقيع Ed25519 ولا ينفذها الوكيل إلا بعد التحقق من التوقيع. المهام الكتابية غير مدعومة.')}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button type="button" variant="ghost" onClick={() => setJobModalAgent(null)}>{t('إلغاء')}</Button>
              <Button type="submit" variant="primary" loading={submitting}><Terminal size={13} style={{ marginInlineEnd: 4 }} />{t('إرسال')}</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
