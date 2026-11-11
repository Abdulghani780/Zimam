/**
 * ASAAS Enterprise v3.0 - Sovereign Windows Server Management
 * Domain 5: Development (بيئات المطورين، إدارة المشاريع، وتوجيه المنافذ الذكي)
 * Zero-Mock Production with Real Windows Multi-Tenant & Smart Port Orchestration
 */

import { useState, useEffect } from 'react';
import { Card, Button, Modal, TextInput, Select, useToast } from '../asaas-ui';
import { api } from '../lib/api';
import {
  Code,
  FolderGit2,
  Play,
  Square,
  Trash2,
  Plus,
  RefreshCw,
  ExternalLink,
  Radio,
  Sliders,
  ShieldCheck,
  Layers,
} from 'lucide-react';

export function DevelopmentPage() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'projects' | 'orchestrator' | 'quotas' | 'gateway'>('projects');
  const [loading, setLoading] = useState(false);

  // Projects State
  const [projects, setProjects] = useState<any[]>([]);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [newProjName, setNewProjName] = useState('');
  const [newProjRuntime, setNewProjRuntime] = useState('react');
  const [newProjPort, setNewProjPort] = useState<number | undefined>(undefined);
  const [submittingProj, setSubmittingProj] = useState(false);

  // Port Orchestrator State
  const [probePort, setProbePort] = useState(3000);
  const [probeProjectName, setProbeProjectName] = useState('Frontend-App');
  const [probeResult, setProbeResult] = useState<any>(null);
  const [probing, setProbing] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);

  // Quotas State
  const [quotas, setQuotas] = useState<any>({
    cpu_limit: 4,
    ram_limit_mb: 4096,
    disk_limit_gb: 50,
    max_containers: 5,
    max_projects: 5,
  });
  const [savingQuotas, setSavingQuotas] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projRes, confRes, quotRes] = await Promise.all([
        api.getDeveloperProjects().catch(() => ({ ok: false, projects: [] })),
        api.getConflictsList().catch(() => ({ ok: false, conflicts: [] })),
        api.getQuotasConfig().catch(() => null),
      ]);

      setProjects(projRes?.projects || []);
      setConflicts(confRes?.conflicts || []);
      if (quotRes?.quotas) {
        const q = quotRes.quotas;
        setQuotas({
          cpu_limit: q.cpu_limit ?? q.max_cpu_percent ?? 4,
          ram_limit_mb: q.ram_limit_mb ?? q.max_memory_mb ?? 4096,
          disk_limit_gb: q.disk_limit_gb ?? q.max_disk_gb ?? 50,
          max_containers: q.max_containers ?? 5,
          max_projects: q.max_projects ?? 5,
        });
      }
    } catch (err: any) {
      toast(err.message || 'فشل جلب بيانات بيئات المطورين', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjName) {
      toast('يرجى إدخال اسم المشروع', 'error');
      return;
    }
    setSubmittingProj(true);
    try {
      const res = await api.createDeveloperProject({
        name: newProjName,
        runtime: newProjRuntime,
        port: newProjPort ? Number(newProjPort) : undefined,
      });
      if (res.ok) {
        toast(`تم إنشاء مساحة المشروع [${newProjName}] وتخصيص المنفذ ${res.port} بنجاح.`, 'success');
        setProjectModalOpen(false);
        setNewProjName('');
        setNewProjPort(undefined);
        fetchData();
      } else {
        toast(res.error || 'فشل إنشاء المشروع', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ أثناء تسجيل المشروع', 'error');
    } finally {
      setSubmittingProj(false);
    }
  };

  const handleStartProject = async (id: string, name: string) => {
    try {
      const res = await api.startDeveloperProject(id);
      if (res.ok) {
        toast(`تم تشغيل خدمة المشروع [${name}] على المنفذ ${res.port || 'المخصص'}.`, 'success');
        fetchData();
      } else {
        toast(res.error || 'فشل تشغيل المشروع', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ في تشغيل المشروع', 'error');
    }
  };

  const handleStopProject = async (id: string, name: string) => {
    try {
      const res = await api.stopDeveloperProject(id);
      if (res.ok) {
        toast(`تم إيقاف المشروع [${name}] بنجاح.`, 'success');
        fetchData();
      } else {
        toast(res.error || 'فشل إيقاف المشروع', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ في إيقاف المشروع', 'error');
    }
  };

  const handleDeleteProject = async (id: string, name: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف مساحة عمل المشروع [${name}]؟`)) return;
    try {
      const res = await api.deleteDeveloperProject(id);
      if (res.ok) {
        toast(`تم حذف المشروع [${name}] وتحرير المنفذ.`, 'success');
        fetchData();
      } else {
        toast(res.error || 'فشل حذف المشروع', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ في حذف المشروع', 'error');
    }
  };

  const handleProbePort = async (e: React.FormEvent) => {
    e.preventDefault();
    setProbing(true);
    setProbeResult(null);
    try {
      const res = await api.allocatePortProbe(probePort, probeProjectName);
      setProbeResult(res);
      if (res.ok && res.assigned_port === probePort) {
        toast(`المنفذ ${probePort} شاغر ومتاح للحجز الذري!`, 'success');
      } else if (res.ok) {
        toast(`تم رصد تعارض على المنفذ ${probePort}، وتم تخصيص المنفذ البديل ${res.assigned_port} تلقائياً.`, 'info');
      }
    } catch (err: any) {
      toast(err.message || 'فشل فحص المنفذ', 'error');
    } finally {
      setProbing(false);
    }
  };

  const handleSaveQuotas = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingQuotas(true);
    try {
      const res = await api.saveQuotasConfig(quotas);
      if (res.ok) {
        toast('تم تحديث سياسات وحصص استهلاك المطورين بنجاح.', 'success');
      } else {
        toast(res.error || 'فشل حفظ الحصص', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ أثناء حفظ الحصص', 'error');
    } finally {
      setSavingQuotas(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Code size={24} style={{ color: 'var(--accent)' }} />
            <span>بيئات المطورين وحوكمة المشاريع (Multi-Tenant Workspaces)</span>
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-3)' }}>
            إدارة مساحات عمل المطورين، عزل المنافذ الذري (Zero-Collision)، بوابات التوجيه السحابية، وضبط حصص الموارد.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="ghost" onClick={fetchData} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>تحديث</span>
          </Button>
          <Button variant="primary" onClick={() => setProjectModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} />
            <span>إنشاء مشروع جديد</span>
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--glass-rim)', paddingBottom: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => setActiveTab('projects')}
          style={{
            background: activeTab === 'projects' ? 'var(--accent-soft)' : 'transparent',
            color: activeTab === 'projects' ? 'var(--accent)' : 'var(--text-3)',
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
          <FolderGit2 size={16} />
          <span>مشاريع المطورين النشطة ({projects.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orchestrator')}
          style={{
            background: activeTab === 'orchestrator' ? 'var(--accent-soft)' : 'transparent',
            color: activeTab === 'orchestrator' ? 'var(--accent)' : 'var(--text-3)',
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
          <Radio size={16} />
          <span>منسق المنافذ الذكي (Smart Port Sentinel)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('quotas')}
          style={{
            background: activeTab === 'quotas' ? 'var(--accent-soft)' : 'transparent',
            color: activeTab === 'quotas' ? 'var(--accent)' : 'var(--text-3)',
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
          <Sliders size={16} />
          <span>حصص الموارد وعزل الأداء (Quotas)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('gateway')}
          style={{
            background: activeTab === 'gateway' ? 'var(--accent-soft)' : 'transparent',
            color: activeTab === 'gateway' ? 'var(--accent)' : 'var(--text-3)',
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
          <Layers size={16} />
          <span>بوابة التطبيقات السحابية (Gateway Routes)</span>
        </button>
      </div>

      {/* Tab 1: Projects List */}
      {activeTab === 'projects' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {projects.length === 0 ? (
            <Card style={{ padding: 40, textAlign: 'center' }}>
              <FolderGit2 size={40} style={{ color: 'var(--text-3)', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>لا توجد مشاريع مسجلة حالياً</div>
              <p style={{ fontSize: 13, color: 'var(--text-3)', maxWidth: 400, margin: '8px auto 16px' }}>
                ابدأ بتسجيل أول بيئة عمل للمطورين مع تخصيص منافذ ذري وعزل كامل لمسار التشغيل.
              </p>
              <Button variant="primary" onClick={() => setProjectModalOpen(true)}>
                إنشاء مشروع جديد الآن
              </Button>
            </Card>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16 }}>
              {projects.map((p) => {
                const isRunning = p.status === 'running';
                const appUrl = `http://${window.location.hostname}:${p.port}`;
                return (
                  <Card key={p.id} style={{ padding: 18, border: '1px solid var(--glass-rim)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--glass-tint)', border: '1px solid var(--glass-rim)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                            <Code size={18} />
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-1)' }}>{p.name}</div>
                            <span className="badge badge--neutral" style={{ fontSize: 10, textTransform: 'uppercase' }}>
                              {p.runtime}
                            </span>
                          </div>
                        </div>
                        <span className={`badge ${isRunning ? 'badge--success' : 'badge--neutral'}`} style={{ fontSize: 11 }}>
                          {isRunning ? 'قيد التشغيل' : 'متوقف'}
                        </span>
                      </div>

                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 12, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                        المسار: {p.path}
                      </div>

                      <div style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--glass-tint)', border: '1px solid var(--glass-rim-low)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>المنفذ المحجوز (TCP):</span>
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, color: 'var(--accent)', fontSize: 13 }}>
                          :{p.port}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--glass-rim-low)', paddingTop: 12 }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {!isRunning ? (
                          <Button variant="primary" onClick={() => handleStartProject(p.id, p.name)} style={{ fontSize: 12, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Play size={13} />
                            <span>تشغيل</span>
                          </Button>
                        ) : (
                          <Button variant="secondary" onClick={() => handleStopProject(p.id, p.name)} style={{ fontSize: 12, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--status-danger)' }}>
                            <Square size={13} />
                            <span>إيقاف</span>
                          </Button>
                        )}
                        {isRunning && (
                          <a
                            href={appUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '6px 12px',
                              borderRadius: 6,
                              background: 'var(--glass-tint)',
                              border: '1px solid var(--glass-rim)',
                              color: 'var(--accent)',
                              textDecoration: 'none',
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            <ExternalLink size={13} />
                            <span>فتح التطبيق</span>
                          </a>
                        )}
                      </div>

                      <Button
                        variant="ghost"
                        onClick={() => handleDeleteProject(p.id, p.name)}
                        style={{ color: 'var(--status-danger)', padding: 6 }}
                        title="حذف المشروع"
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Smart Port Orchestrator */}
      {activeTab === 'orchestrator' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card style={{ padding: 20 }}>
            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-1)', marginBottom: 6 }}>
              فحص التوفر الذري وتخصيص المنافذ الخالية من التعارض (Atomic Socket Probe)
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 16px' }}>
              يقوم المحرك بفحص جدول استماع TCP ومحاولة الربط الفعلي بمقبس النواة (Socket Bind). في حال انشغال المنفذ، يتم اقتراح وتخصيص منفذ بديل في نطاق المطورين (3000-3999).
            </p>

            <form onSubmit={handleProbePort} style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>المنفذ المطلوب فحصه</label>
                <TextInput type="number" value={probePort} onChange={(e) => setProbePort(parseInt(e.target.value) || 3000)} />
              </div>
              <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>اسم المشروع المستهدف</label>
                <TextInput value={probeProjectName} onChange={(e) => setProbeProjectName(e.target.value)} />
              </div>
              <Button variant="primary" type="submit" disabled={probing} style={{ height: 40, padding: '0 20px' }}>
                {probing ? 'جارٍ الفحص الذري...' : 'فحص وتخصيص المنفذ'}
              </Button>
            </form>

            {probeResult && (
              <div style={{ marginTop: 16, padding: 14, borderRadius: 8, background: 'var(--glass-tint)', border: '1px solid var(--glass-rim)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <ShieldCheck size={20} style={{ color: 'var(--status-safe)' }} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-1)' }}>
                      المنفذ المخصص بنجاح: <span style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>:{probeResult.assigned_port}</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      {probeResult.available ? 'المنفذ الأصلي متاح وشاغر بالكامل' : `تم حل التعارض تلقائياً عبر تخصيص المنفذ البديل :${probeResult.assigned_port}`}
                    </div>
                  </div>
                </div>
                <span className="badge badge--success">جاهز للربط والتوجيه</span>
              </div>
            )}
          </Card>

          {/* Conflict History */}
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--glass-rim)', fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>
              سجل رصد التعارضات وإعادة التوجيه (Collision Detection Log)
            </div>
            {conflicts.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
                لم يتم تسجيل أي تعارضات غير محلولة في المنظومة.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
                  <thead>
                    <tr style={{ background: 'var(--glass-tint)', borderBottom: '1px solid var(--glass-rim)' }}>
                      <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>المنفذ المتنازع عليه</th>
                      <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>المشروع</th>
                      <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>نوع التعارض</th>
                      <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>المنفذ البديل المخصص</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conflicts.map((c, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--glass-rim-low)' }}>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--status-danger)' }}>
                          :{c.requested_port}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-1)' }}>
                          {c.project_name || 'تطبيق مطور'}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)' }}>
                          {c.conflict_type || 'TCP_LISTENER_COLLISION'}
                        </td>
                        <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, color: 'var(--status-safe)' }}>
                          :{c.allocated_port}
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

      {/* Tab 3: Quotas */}
      {activeTab === 'quotas' && (
        <Card style={{ padding: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-1)', marginBottom: 6 }}>
            حوكمة حصص الموارد لمشاريع المطورين (Resource Quotas & Throttling)
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '0 0 16px' }}>
            تحديد سقف الموارد الأقصى المسموح به لكل مساحة عمل مطور على Windows Server، لمنع استنزاف السيرفر وحماية العمليات الإنتاجية.
          </p>

          <form onSubmit={handleSaveQuotas} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>الحد الأقصى لحصة المعالج (CPU Limit)</label>
              <TextInput
                type="number"
                value={quotas.cpu_limit}
                onChange={(e) => setQuotas({ ...quotas, cpu_limit: parseFloat(e.target.value) || 4 })}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>الحد الأقصى للذاكرة العشوائية (RAM MB)</label>
              <TextInput
                type="number"
                value={quotas.ram_limit_mb}
                onChange={(e) => setQuotas({ ...quotas, ram_limit_mb: parseInt(e.target.value) || 4096 })}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>الحد الأقصى للتخزين (Disk Space GB)</label>
              <TextInput
                type="number"
                value={quotas.disk_limit_gb}
                onChange={(e) => setQuotas({ ...quotas, disk_limit_gb: parseFloat(e.target.value) || 50 })}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>الحد الأقصى للحاويات المتزامنة</label>
              <TextInput
                type="number"
                value={quotas.max_containers}
                onChange={(e) => setQuotas({ ...quotas, max_containers: parseInt(e.target.value) || 5 })}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>الحد الأقصى لعدد المشاريع</label>
              <TextInput
                type="number"
                value={quotas.max_projects}
                onChange={(e) => setQuotas({ ...quotas, max_projects: parseInt(e.target.value) || 5 })}
              />
            </div>

            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
              <Button variant="primary" type="submit" disabled={savingQuotas}>
                {savingQuotas ? 'جارٍ الحفظ...' : 'حفظ وتطبيق سياسة الحصص'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Tab 4: Gateway Routes */}
      {activeTab === 'gateway' && (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--glass-rim)', fontWeight: 700, fontSize: 14, color: 'var(--text-1)' }}>
            جدول الوصول المباشر لبيئات المطورين (Direct Port Routing Map)
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'start' }}>
              <thead>
                <tr style={{ background: 'var(--glass-tint)', borderBottom: '1px solid var(--glass-rim)' }}>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>رابط الوصول المباشر</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>الهدف المحلي (Upstream)</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>اسم المشروع</th>
                  <th style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', fontWeight: 700 }}>طريقة الوصول</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => {
                  const directUrl = p.port ? `http://${window.location.hostname}:${p.port}` : '';
                  return (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--glass-rim-low)' }}>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, fontSize: 13 }}>
                        {directUrl ? (
                          <a
                            href={directUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                            dir="ltr"
                          >
                            {directUrl}
                          </a>
                        ) : (
                          <span style={{ color: 'var(--text-3)' }}>لم يتم تخصيص منفذ بعد</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: 13, color: 'var(--text-2)' }}>
                        {p.port ? `http://127.0.0.1:${p.port}` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>
                        {p.name}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span className="badge badge--success" style={{ fontSize: 11 }}>
                          Port-Based Direct Access
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal: New Project Wizard */}
      <Modal open={projectModalOpen} onClose={() => setProjectModalOpen(false)} title="معالج إنشاء بيئة مطور جديدة">
        <form onSubmit={handleCreateProject} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>اسم المشروع أو التطبيق</label>
            <TextInput value={newProjName} onChange={(e) => setNewProjName(e.target.value)} placeholder="مثال: my-dashboard" required />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>بيئة التشغيل (Runtime / Framework)</label>
            <Select value={newProjRuntime} onChange={(e) => setNewProjRuntime(e.target.value)}>
              <option value="react">React / Vite</option>
              <option value="nextjs">Next.js (App Router)</option>
              <option value="nodejs">Node.js Express API</option>
              <option value="python">Python FastAPI / Flask</option>
              <option value="golang">Go HTTP Service</option>
              <option value="docker">Docker Compose Workspace</option>
            </Select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>المنفذ المفضل (اتركه فارغاً للتخصيص التلقائي الخالي من التعارض)</label>
            <TextInput
              type="number"
              value={newProjPort || ''}
              onChange={(e) => setNewProjPort(e.target.value ? parseInt(e.target.value) : undefined)}
              placeholder="تلقائي (نطاق 3000-3999)"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <Button variant="ghost" type="button" onClick={() => setProjectModalOpen(false)}>إلغاء</Button>
            <Button variant="primary" type="submit" disabled={submittingProj}>
              {submittingProj ? 'جارٍ الإنشاء والتخصيص...' : 'تأكيد وإنشاء البيئة'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
