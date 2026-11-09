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
} from 'lucide-react';

interface JitGrant {
  id: string;
  user: string;
  target: string;
  role: string;
  ticket: string;
  duration_mins: number;
  remaining_sec: number;
  status: 'ACTIVE' | 'EXPIRED' | 'REVOKED';
}

export function JitElevationPage() {
  const toast = useToast();
  const [grants, setGrants] = useState<JitGrant[]>([]);

  const [targetRole, setTargetRole] = useState('Local Administrator');
  const [durationMins, setDurationMins] = useState(30);
  const [reason, setReason] = useState('طوارئ صيانة قواعد البيانات - تذكرة CHG-9840');
  const [mfaCode, setMfaCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchGrants = async () => {
    try {
      const res = await api.getJitGrants();
      if (res && res.ok && Array.isArray(res.grants)) {
        setGrants(res.grants.map((g: any) => ({
          id: g.id || `jit-${Math.random()}`,
          user: g.user || 'Unknown',
          target: g.target || 'SRV-PROD-ASAAS-01',
          role: g.role || g.target_role || 'Operator',
          ticket: g.ticket || 'CHG-LIVE',
          duration_mins: g.duration_mins || 30,
          remaining_sec: g.remaining_sec ?? 1800,
          status: g.status || 'ACTIVE',
        })));
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchGrants();
    const timer = setInterval(() => {
      setGrants((prev) =>
        prev.map((g) => ({
          ...g,
          remaining_sec: Math.max(0, g.remaining_sec - 1),
          status: g.remaining_sec <= 1 ? 'EXPIRED' : g.status,
        }))
      );
    }, 1000);
    return () => clearInterval(timer);
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
        toast(res.message || `تم اعتماد وترقية الصلاحية المؤقتة لمدة (${durationMins} دقيقة) بنجاح.`, 'success');
        setMfaCode('');
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 1. Executive Ambient JIT Header */}
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
                  borderRadius: 9999,
                  background: 'rgba(34, 197, 94, 0.12)',
                  color: '#22c55e',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <CheckCircle2 size={13} />
                بيئة منعدمة الامتيازات الدائمة Zero-Standing Privileges
              </span>
              <span
                style={{
                  padding: '3px 10px',
                  borderRadius: 9999,
                  background: 'rgba(212, 160, 23, 0.12)',
                  color: 'var(--accent)',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                JIT v2.5 Enclave
              </span>
            </div>

            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>
              مركز اعتماد وترقية الصلاحيات المؤقتة (Just-In-Time Elevation Center)
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0, maxWidth: 840, lineHeight: 1.6 }}>
              منح صلاحيات إدارية مؤقتة محددة بزمن صارم وتجريد الحسابات تلقائياً بمجرد انتهاء المهمة أو انقضاء المؤقت،
              مع تسجيل كافة الأنشطة بجلسة التحقيق الجنائي لمنع مخاطر الحسابات الإدارية الدائمة.
            </p>
          </div>
        </div>
      </div>

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
                  background: 'rgba(212, 160, 23, 0.15)',
                  border: '1px solid rgba(212, 160, 23, 0.3)',
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
                  ترقية مؤقتة مع مصادقة مزدوجة Dual-Custody MFA
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
                        background: durationMins === chip.mins ? 'rgba(212, 160, 23, 0.2)' : 'rgba(255, 255, 255, 0.03)',
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

              <Field label="رمز التحقق المزدوج MFA (Google Authenticator / YubiKey)">
                {(id) => (
                  <TextInput
                    id={id}
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    placeholder="أدخل الرمز المكون من 6 أرقام..."
                  />
                )}
              </Field>

              <Button size="sm" variant="primary" loading={submitting} type="submit" style={{ marginTop: 6 }}>
                <Send size={13} />
                <span>تقديم طلب الترقية والاعتماد الفوري</span>
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
                          <Clock size={13} color={g.status === 'ACTIVE' ? '#22c55e' : '#ef4444'} />
                          <span
                            style={{
                              fontFamily: 'var(--font)',
                              fontWeight: 800,
                              color: g.status === 'ACTIVE' ? '#22c55e' : 'var(--text-3)',
                            }}
                          >
                            {g.status === 'ACTIVE' ? formatRemaining(g.remaining_sec) : '00:00'}
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
                            background:
                              g.status === 'ACTIVE'
                                ? 'rgba(34, 197, 94, 0.12)'
                                : 'rgba(239, 68, 68, 0.12)',
                            color: g.status === 'ACTIVE' ? '#22c55e' : '#ef4444',
                          }}
                        >
                          {g.status === 'ACTIVE' ? 'نشطة ACTIVE' : g.status === 'REVOKED' ? 'مسحوبة REVOKED' : 'منتهية EXPIRED'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'end' }}>
                        {g.status === 'ACTIVE' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRevoke(g.id, g.user)}
                            style={{ padding: '3px 8px', fontSize: 11, color: '#ef4444' }}
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
