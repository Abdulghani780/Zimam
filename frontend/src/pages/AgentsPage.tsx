import { useEffect, useState } from 'react';
import { Card, Button, Modal, Field, Select, useToast, TableContainer, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmpty } from '../asaas-ui';
import { apiV1, type V1Agent, type V1AgentJob } from '../lib/apiV1';
import { Bot, Play, RefreshCw, Terminal } from 'lucide-react';

const JOB_TYPES = [
  { value: 'system.info', label: 'معلومات النظام' },
  { value: 'process.list', label: 'قائمة العمليات' },
  { value: 'service.list', label: 'قائمة الخدمات' },
  { value: 'disk.list', label: 'الأقراص' },
  { value: 'inventory.collect', label: 'جمع الجرد' },
  { value: 'session.list', label: 'جلسات ويندوز النشطة' },
];

const asArray = <T,>(res: unknown): T[] =>
  Array.isArray(res) ? (res as T[]) : Array.isArray((res as { agents?: T[]; jobs?: T[] })?.agents)
    ? (res as { agents: T[] }).agents
    : Array.isArray((res as { jobs?: T[] })?.jobs)
      ? (res as { jobs: T[] }).jobs
      : [];

export function AgentsPage() {
  const toast = useToast();
  const [agents, setAgents] = useState<V1Agent[]>([]);
  const [jobs, setJobs] = useState<V1AgentJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [jobModalAgent, setJobModalAgent] = useState<V1Agent | null>(null);
  const [jobType, setJobType] = useState('system.info');
  const [submitting, setSubmitting] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [a, j] = await Promise.all([apiV1.agents(), apiV1.jobs()]);
      setAgents(asArray<V1Agent>(a));
      setJobs(asArray<V1AgentJob>(j));
    } catch (err: any) {
      toast(err.message || 'فشل جلب بيانات الوكلاء', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const dispatchJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobModalAgent) return;
    setSubmitting(true);
    try {
      await apiV1.createJob({ agent_id: jobModalAgent.id, job_type: jobType, payload: {} });
      toast('تم إرسال المهمة الموقعة إلى الوكيل — ستظهر النتيجة خلال ~15 ثانية.', 'success');
      setJobModalAgent(null);
      setTimeout(fetchAll, 20000);
    } catch (err: any) {
      toast(err.message || 'فشل إرسال المهمة', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-hero" style={{ borderRadius: 16, padding: '24px 28px', background: 'linear-gradient(135deg, var(--glass-tint-strong), var(--surface-ground))', border: '1px solid var(--accent-soft)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', margin: '0 0 8px' }}>وكلاء الأصول (ASAAS Agents)</h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0, maxWidth: 800, lineHeight: 1.6 }}>
              وكلاء Windows خروجية فقط يُسجَّلون عبر مفتاح لمرة واحدة، ويستلمون مهاماً موقعة Ed25519 للقراءة فقط — لا يوجد تنفيذ أوامر كتابية عن بُعد.
            </p>
          </div>
          <Button size="sm" variant="glass" onClick={fetchAll} loading={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={13} /><span>تحديث</span>
          </Button>
        </div>
      </div>

      <Card title={`الوكلاء المسجلون (${agents.length})`} icon="users">
        <TableContainer>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الاسم</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>آخر ظهور</TableHead>
                <TableHead>الجرد</TableHead>
                <TableHead style={{ textAlign: 'end' }}>إجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {agents.length === 0 ? (
                <TableEmpty colSpan={5} message={loading ? 'جارٍ التحميل...' : 'لا يوجد وكلاء مسجلون. سجّل وكيلاً عبر POST /api/v1/agents/enroll.'} />
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
                  <TableCell style={{ textAlign: 'end' }}>
                    <Button size="sm" variant="glass" onClick={() => setJobModalAgent(a)} style={{ fontSize: 11, padding: '3px 8px' }}>
                      <Play size={11} style={{ marginInlineEnd: 4 }} />مهمة
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Card title="سجل المهام الموقعة" icon="vault" actions={<span style={{ fontSize: 12, color: 'var(--text-3)' }}>{jobs.length} مهمة</span>}>
        <TableContainer className="max-h-[380px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المهمة</TableHead>
                <TableHead>النوع</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>النتيجة</TableHead>
                <TableHead>الوقت</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.length === 0 ? (
                <TableEmpty colSpan={5} message="لا توجد مهام بعد." />
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

      {jobModalAgent && (
        <Modal open onClose={() => setJobModalAgent(null)} title={`إرسال مهمة موقعة إلى ${jobModalAgent.name || jobModalAgent.id}`}>
          <form onSubmit={dispatchJob} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="نوع المهمة (قراءة فقط)">
              {(id) => (
                <Select id={id} value={jobType} onChange={(e) => setJobType(e.target.value)}>
                  {JOB_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label} ({t.value})</option>)}
                </Select>
              )}
            </Field>
            <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
              تُوقَّع المهمة بتوقيع Ed25519 ولا ينفذها الوكيل إلا بعد التحقق من التوقيع. المهام الكتابية غير مدعومة.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <Button type="button" variant="ghost" onClick={() => setJobModalAgent(null)}>إلغاء</Button>
              <Button type="submit" variant="primary" loading={submitting}><Terminal size={13} style={{ marginInlineEnd: 4 }} />إرسال</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
