/**
 * ASAAS Server Control v2.5 - Screen JIT Elevation
 * مركز اعتماد وترقية الصلاحيات المؤقتة (Just-In-Time Elevation Center)
 * Strict implementation of Stitch Prototype jit_elevation
 */

import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Card, Button, Glass, Field, TextInput, useToast } from '../asaas-ui';
import {
  CheckCircle2,
  Clock,
  KeyRound,
  Send,
  ShieldCheck,
  XCircle,
  UserCheck,
} from 'lucide-react';

type JitStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'PENDING' | 'REJECTED';

interface JitGrant {
  id: string;
  user: string;
  target: string;
  role: string;
  ticket: string;
  duration_mins: number;
  remaining_sec: number;
  status: JitStatus;
  approver?: string;
  created_at?: string;
}

const statusLabel = (status: JitStatus): string => {
  switch (status) {
    case 'ACTIVE':
      return 'نشطة ACTIVE';
    case 'PENDING':
      return 'بانتظار الاعتماد PENDING';
    case 'REJECTED':
      return 'مرفوضة REJECTED';
    case 'REVOKED':
      return 'مسحوبة REVOKED';
    default:
      return 'منتهية EXPIRED';
  }
};

const statusColor = (status: JitStatus): { color: string; background: string } => {
  switch (status) {
    case 'ACTIVE':
      return { color: 'var(--paid)', background: 'var(--paid-bg)' };
    case 'PENDING':
      return { color: 'var(--partial)', background: 'var(--partial-bg)' };
    case 'REJECTED':
    case 'REVOKED':
      return { color: 'var(--unpaid)', background: 'var(--unpaid-bg)' };
    default:
      return { color: 'var(--text-3)', background: 'var(--glass-rim-low)' };
  }
};

export function JitElevationPage() {
  const toast = useToast();
  const [grants, setGrants] = useState<JitGrant[]>([]);
  const [currentRole, setCurrentRole] = useState<string>('viewer');
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const [targetRole, setTargetRole] = useState('Local Administrator');
  const [durationMins, setDurationMins] = useState(30);
  const [reason, setReason] = useState('طوارئ صيانة قواعد البيانات - تذكرة CHG-9840');
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = currentRole === 'admin';
  const pendingGrants = grants.filter((g) => g.status === 'PENDING');

  const fetchGrants = async () => {
    try {
      const res = await api.getJitGrants();
      if (res && res.ok && Array.isArray(res.grants)) {
        setGrants(res.grants.map((g: any) => ({
          id: g.id || `jit-${Math.random()}`,
          user: g.user || '—',
          target: g.target || '—',
          role: g.role || g.target_role || '—',
          ticket: g.reason || g.ticket || '—',
          duration_mins: g.duration_mins ?? 0,
          remaining_sec: g.status === 'PENDING' ? 0 : (g.remaining_sec ?? 0),
          status: (g.status || 'ACTIVE') as JitStatus,
          approver: g.approver || '',
          created_at: g.created_at || '',
        })));
      }
    } catch {
      // ignore
    }
  };

  const fetchIdentity = async () => {
    try {
      const res = await api.getCurrentUser();
      if (res && res.ok && res.user) setCurrentRole(res.user.role || 'viewer');
    } catch {
      // viewer remains the safe default
    }
  };

  useEffect(() => {
    fetchGrants();
    fetchIdentity();
    const poll = setInterval(fetchGrants, 10_000);
    const timer = setInterval(() => {
      setGrants((prev) =>
        prev.map((g) => {
          if (g.status !== 'ACTIVE') return g;
          const next = Math.max(0, g.remaining_sec - 1);
          return {
            ...g,
            remaining_sec: next,
            status: next <= 0 ? ('EXPIRED' as JitStatus) : g.status,
          };
        })
      );
    }, 1000);
    return () => {
      clearInterval(timer);
      clearInterval(poll);
    };
  }, []);

  const handleRevoke = async (id: string, user: string) => {
    try {
      const res = await api.revokeJitElevation(id);
      if (res && res.ok) {
        toast(res.message || `تم سحب الصلاحيات المؤقتة للمستخدم [${user}] فوراً.`, 'success');
        fetchGrants();
      } else {
        toast((res as any)?.error || 'فشل سحب الصلاحيات.', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ أثناء سحب الصلاحيات', 'error');
    }
  };

  const handleDecision = async (id: string, approve: boolean, user: string) => {
    setDecidingId(id);
    try {
      const res = await api.approveJitElevation(id, approve);
      if (res && res.ok) {
        toast(
          res.message || (approve
            ? `تم اعتماد طلب الترقية المؤقتة للمستخدم [${user}].`
            : `تم رفض طلب الترقية المؤقتة للمستخدم [${user}].`),
          approve ? 'success' : 'info',
        );
        fetchGrants();
      } else {
        toast(res?.error || 'فشل تنفيذ قرار الاعتماد.', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ أثناء تنفيذ قرار الاعتماد', 'error');
    } finally {
      setDecidingId(null);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.requestJitElevation({
        role: targetRole,
        reason,
        duration_mins: durationMins,
      });
      if (res && res.ok) {
        toast(res.message || `تم تسجيل طلب الترقية المؤقتة لمدة (${durationMins} دقيقة).`, 'success');
        fetchGrants();
      } else {
        toast((res as any)?.error || 'فشل اعتماد طلب الترقية المؤقتة.', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'فشل تقديم طلب الترقية المؤقتة', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const formatRemaining = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

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
                  borderRadius: 9999,
                  background: 'var(--paid-bg)',
                  color: 'var(--paid)',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <CheckCircle2 size={13} />
                صلاحيات مؤقتة مرتبطة بسياسة الوصول
              </span>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: 9999,
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {isAdmin ? 'اعتماد مدير النظام مفعّل' : 'يتطلب اعتماد مدير النظام'}
              </span>
            </div>

              <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>
                طلبات الصلاحيات المؤقتة (JIT)
              </h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0, maxWidth: 840, lineHeight: 1.6 }}>
              منح صلاحيات إدارية مؤقتة محددة بزمن صارم وتجريد الحسابات تلقائياً بمجرد انتهاء المهمة أو انقضاء المؤقت،
              مع تسجيل كافة الأنشطة بجلسة التحقيق الجنائي لمنع مخاطر الحسابات الإدارية الدائمة.
            </p>
          </div>
        </div>
      </div>

      {/* Pending approvals: non-admin requests wait for an explicit admin decision. */}
      {pendingGrants.length > 0 && (
        <Card
          title="طلبات الترقية بانتظار اعتماد مدير النظام (Pending Approvals)"
          icon="clock"
          actions={
            <span style={{ fontSize: 12, color: 'var(--partial)', fontWeight: 700 }}>
              {pendingGrants.length} طلب معلق
            </span>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pendingGrants.map((g) => (
              <div
                key={g.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: 'var(--partial-bg)',
                  border: '1px solid var(--partial)',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 220 }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-1)' }}>
                    {g.user} → {g.role}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text-2)' }}>
                    المدة المطلوبة: {g.duration_mins} دقيقة — المبرر: {g.ticket}
                  </span>
                  {g.created_at && (
                    <span style={{ fontSize: 10, color: 'var(--text-3)' }}>
                      تاريخ الطلب: {new Date(g.created_at).toLocaleString('ar-SA')}
                    </span>
                  )}
                </div>
                {isAdmin ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Button
                      size="sm"
                      variant="primary"
                      loading={decidingId === g.id}
                      onClick={() => handleDecision(g.id, true, g.user)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                    >
                      <UserCheck size={13} />
                      <span>اعتماد</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={decidingId === g.id}
                      onClick={() => handleDecision(g.id, false, g.user)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--unpaid)' }}
                    >
                      <XCircle size={13} />
                      <span>رفض</span>
                    </Button>
                  </div>
                ) : (
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--partial)' }}>
                    <ShieldCheck size={13} style={{ marginInlineEnd: 4, verticalAlign: 'middle' }} />
                    بانتظار قرار مدير النظام
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 2. Top Grid: Request Form (5 cols) & Active Grants (7 cols) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, minmax(0, 1fr))', gap: 20 }}>
        {/* Form: Request Temporary Elevation (5 cols) */}
        <div style={{ gridColumn: 'span 5', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Glass style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'var(--accent-soft)',
                  border: '1px solid var(--accent-soft)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent)',
                }}
              >
                <KeyRound size={20} />
              </div>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
                  طلب ترقية صلاحيات مؤقتة في الوقت الفعلي
                </h2>
                <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                  {isAdmin ? 'اعتماد فوري بصلاحية مدير النظام' : 'طلب يتطلب اعتماد مدير النظام'}
                </span>
              </div>
            </div>

            <form onSubmit={handleSubmitRequest} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="الدور المطلوب الترقية إليه">
                {() => (
                  <select
                    value={targetRole}
                    onChange={(e) => setTargetRole(e.target.value)}
                    className="text-input"
                    style={{ width: '100%' }}
                  >
                    <option value="Local Administrator">مدير محلي كامل (Local Administrator)</option>
                    <option value="SQL SysAdmin">مدير قواعد بيانات (SQL Server SysAdmin)</option>
                    <option value="Network Operator">مشغل شبكة وجدار حماية (Network Operator)</option>
                    <option value="Backup Operator">مشغل نسخ احتياطي (Backup Operator)</option>
                  </select>
                )}
              </Field>

              {/* Duration chips */}
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
                  مدة الترقية الممنوحة:
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { mins: 15, label: '15 دقيقة (فحص عاجل)' },
                    { mins: 30, label: '30 دقيقة (صيانة متوسطة)' },
                    { mins: 60, label: 'ساعة ★ موصى بها' },
                  ].map((chip) => (
                    <button
                      key={chip.mins}
                      type="button"
                      onClick={() => setDurationMins(chip.mins)}
                      style={{
                        flex: 1,
                        padding: '8px 4px',
                        borderRadius: 8,
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        border: durationMins === chip.mins ? '1px solid var(--accent)' : '1px solid transparent',
                        background: durationMins === chip.mins ? 'var(--accent-soft)' : 'var(--glass-rim-low)',
                        color: durationMins === chip.mins ? 'var(--accent)' : 'var(--text-3)',
                      }}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              <Field label="مبرر الترقية أو رقم تذكرة التغيير (Change Ticket)">
                {(id) => (
                  <TextInput
                    id={id}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="مثال: CHG-1029 أو فحص طوارئ..."
                    required
                  />
                )}
              </Field>

              <Button size="sm" variant="primary" loading={submitting} type="submit" style={{ marginTop: 6 }}>
                <Send size={13} />
                <span>{isAdmin ? 'اعتماد وترقية الصلاحية فوراً (مدير النظام)' : 'تقديم طلب الترقية لاعتماد مدير النظام'}</span>
              </Button>
            </form>
          </Glass>
        </div>

        {/* Active JIT Grants Table (7 cols) */}
        <div style={{ gridColumn: 'span 7', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card
            title="سجل وثائق الصلاحيات الحية (Active JIT Grants)"
            icon="vault"
            actions={
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                الوثائق النشطة: {grants.filter((g) => g.status === 'ACTIVE').length}
              </span>
            }
          >
            <div className="table-wrap">
              <table className="app-table">
                <thead>
                  <tr>
                    <th>المستخدم</th>
                    <th>الدور الممنوح</th>
                    <th>التذكرة</th>
                    <th>الوقت المتبقي</th>
                    <th>الحالة</th>
                    <th style={{ textAlign: 'end' }}>الإجراء</th>
                  </tr>
                </thead>
                <tbody>
                  {grants.map((g) => (
                    <tr key={g.id}>
                      <td style={{ fontWeight: 700, color: 'var(--text-1)' }}>{g.user}</td>
                      <td>
                        <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>
                          {g.role}
                        </span>
                      </td>
                      <td style={{ fontSize: 11, fontFamily: 'var(--font)', color: 'var(--text-3)' }}>
                        {g.ticket}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Clock size={13} color={g.status === 'ACTIVE' ? 'var(--paid)' : 'var(--text-3)'} />
                          <span
                            style={{
                              fontFamily: 'var(--font)',
                              fontWeight: 800,
                              color: g.status === 'ACTIVE' ? 'var(--paid)' : 'var(--text-3)',
                            }}
                          >
                            {g.status === 'ACTIVE' ? formatRemaining(g.remaining_sec) : '—'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 4,
                            ...statusColor(g.status),
                          }}
                        >
                          {statusLabel(g.status)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'end' }}>
                        {g.status === 'ACTIVE' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRevoke(g.id, g.user)}
                            style={{ padding: '3px 8px', fontSize: 11, color: 'var(--unpaid)' }}
                            title="سحب الصلاحية فوراً"
                          >
                            <span>سحب الصلاحية</span>
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
      </div>
    </div>
  );
}
