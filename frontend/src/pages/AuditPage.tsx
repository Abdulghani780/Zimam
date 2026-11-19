/**
 * ASAAS v2.5 - Screen _6
 * سلسلة سجلات الامتثال غير القابلة للتلاعب (Tamper-Proof Immutable Audit Ledger)
 * Strict implementation of Stitch Prototype _6 (NCA ECC-1:2018 & ISO 27001 Compliant)
 */

import { useState, useEffect } from 'react';
import { Card, Button, Glass, useToast, TableContainer, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmpty } from '../asaas-ui';
import { api, type AuditLog } from '../lib/api';
import { apiV1, type V1AuditEvent, type V1AuditVerify } from '../lib/apiV1';
import {
  ShieldCheck,
  CheckCircle2,
  Copy,
  Search,
  FileSpreadsheet,
  FileCode,
  RefreshCw,
} from 'lucide-react';
import { t } from '../lib/i18n';

export function AuditPage() {
  const toast = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [v1Events, setV1Events] = useState<V1AuditEvent[]>([]);
  const [v1Verify, setV1Verify] = useState<V1AuditVerify | null>(null);
  const [filterText, setFilterText] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const [res, v1Res] = await Promise.all([
        api.getAuditLogs(150),
        apiV1.auditEvents({ limit: 150 }).catch(() => null),
      ]);
      setLogs(Array.isArray(res) ? res : (res as any)?.logs || []);
      const v1List = Array.isArray(v1Res) ? v1Res : (v1Res as any)?.events || [];
      setV1Events(v1List);
      if (v1List.length > 0) {
        setV1Verify((prev) => prev);
      }
    } catch (err: any) {
      toast(err.message || t('فشل جلب سجلات التدقيق'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleExport = (format: 'json' | 'csv') => {
    const url = `/api/audit/export?format=${format}`;
    window.open(url, '_blank');
    toast(`${t('تم تصدير ملف سجلات التدقيق بصيغة ')}${format.toUpperCase()}${t(' مع بصمة التشفير الرقمية.')}`, 'success');
  };

  const handleVerifyChain = async () => {
    setVerifying(true);
    try {
      const [legacyRes, v1Res] = await Promise.all([
        api.verifyAuditChain().catch(() => null),
        apiV1.verifyAudit().catch(() => null),
      ]);
      if (v1Res && typeof v1Res === 'object') {
        setV1Verify(v1Res as V1AuditVerify);
      }
      const v1Ok = (v1Res as V1AuditVerify | null)?.chain_intact === true;
      const legacyMsg = (legacyRes as any)?.message || '';
      if (v1Ok) {
        toast(t('تم التحقق من سلسلة تدقيق طبقة التحكم (/api/v1): السلسلة سليمة تشفيرياً.'), 'success');
      } else if (v1Res) {
        toast(`${t('فشل التحقق من سلسلة v1')}${(v1Res as V1AuditVerify).failed_index != null ? ` عند السجل ${(v1Res as V1AuditVerify).failed_index}` : ''}${t('. راجع أحداث التدقيق.')}`, 'error');
      } else {
        toast(legacyMsg || t('تعذّر الوصول إلى خدمة التحقق في الطبقة التحكمية.'), 'error');
      }
    } catch (err: any) {
      toast(err.message || t('خطأ أثناء الاتصال بخدمة التحقق'), 'error');
    } finally {
      setVerifying(false);
    }
  };

  const copyHash = (hash: string) => {
    navigator.clipboard?.writeText(hash);
    toast(t('تم نسخ البصمة إلى الحافظة.'), 'success');
  };

  // Real chain fingerprint: root signature from /api/v1/audit/verify, or the
  // newest event hash as a fallback. Never a hardcoded value.
  const chainFingerprint =
    (v1Verify?.root_signature as string | undefined) ||
    v1Events[v1Events.length - 1]?.event_hash ||
    '';
  const highRiskCount = logs.filter((l) =>
    ['KILL_PROCESS', 'TERMINATE', 'DELETE_USER', 'ELEVATE', 'PRIVILEGE_VIOLATION', 'UNAUTHORIZED_ACTION_ATTEMPT'].includes(l.action),
  ).length;

  const filteredLogs = logs.filter(
    (l) =>
      l.user.toLowerCase().includes(filterText.toLowerCase()) ||
      l.action.toLowerCase().includes(filterText.toLowerCase()) ||
      l.target.toLowerCase().includes(filterText.toLowerCase()) ||
      l.ip.includes(filterText)
  );

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                {t('سلسلة موثقة ومغلقة Cryptographically Chained')}
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
                ISO 27001 &amp; NCA ECC-1:2018 Compliant
              </span>
            </div>

            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>
              {t('سلسلة سجلات الامتثال غير القابلة للتلاعب (Audit Trail &amp; Ledger)')}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0, maxWidth: 840, lineHeight: 1.6 }}>
              {t('تسجيل مشفر لكافة العمليات الإدارية، محاولات الدخول، وتغيير السياسات، موثقة ببصمة تسلسلية تمنع أي تلاعب أو مسح وفق ضوابط الهيئة الوطنية للأمن السيبراني.')}
            </p>

            {/* Active Hash Chip — real fingerprint from the v1 audit chain */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 8,
                background: 'var(--shadow-soft)',
                border: '1px solid var(--accent-soft)',
                width: 'fit-content',
                marginTop: 4,
              }}
            >
              <ShieldCheck size={14} color="var(--accent)" />
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{t('بصمة سلسلة طبقة التحكم:')}</span>
              <span dir="ltr" style={{ fontSize: 12, fontFamily: 'Consolas, monospace', color: 'var(--accent)', fontWeight: 700 }}>
                {chainFingerprint ? `${chainFingerprint.slice(0, 16)}…${chainFingerprint.slice(-8)}` : '—'}
              </span>
              {chainFingerprint && (
                <button
                  type="button"
                  onClick={() => copyHash(chainFingerprint)}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0 }}
                  title={t('نسخ البصمة')}
                  aria-label={t('نسخ البصمة')}
                >
                  <Copy size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Action Buttons from Stitch _6 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Button
              size="sm"
              variant="glass"
              loading={verifying}
              onClick={handleVerifyChain}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <RefreshCw size={13} />
              <span>{t('مطابقة البصمة الآن')}</span>
            </Button>
            <Button
              size="sm"
              variant="glass"
              onClick={() => handleExport('json')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <FileCode size={13} color="var(--accent)" />
              <span>{t('تصدير JSON مشفّر .sig')}</span>
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => handleExport('csv')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <FileSpreadsheet size={13} />
              <span>{t('تصدير تقرير CSV')}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Three Metric & Compliance Cards (Stitch _6 L578-L636) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
        {/* Card 1: Tamper Resistance */}
        <Glass style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
              {t('ضمان عدم التلاعب (Tamper Resistance)')}
            </h2>
            <span style={{ fontSize: 11, color: v1Verify ? (v1Verify.chain_intact ? 'var(--paid)' : 'var(--unpaid)') : 'var(--text-3)', fontWeight: 700 }}>
              {v1Verify ? (v1Verify.chain_intact ? t('سلسلة v1 سليمة') : t('سلسلة v1 مكسورة')) : t('لم يُتحقق بعد')}
            </span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
            {t('كل سجل في سلسلة طبقة التحكم (/api/v1) مربوط ببصمة SHA-256 للكتلة السابقة؛ زر «مطابقة البصمة الآن» يعيد حساب السلسلة كاملة ويكشف أي تعديل.')}
          </p>
        </Glass>

        {/* Card 2: Operations by NCA Classification */}
        <Glass style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
              {t('توزيع العمليات حسب تصنيف NCA')}
            </h2>
            <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>{logs.length} {t('سجل تشغيلي')}</span>
          </div>
          <div style={{ display: 'flex', gap: 10, fontSize: 11, marginTop: 4 }}>
            <span style={{ color: 'var(--unpaid)' }}>{t('● عمليات عالية الخطورة')} <bdi dir="ltr">({highRiskCount})</bdi></span>
            <span style={{ color: 'var(--paid)' }}>{t('● إجمالي السجلات المعروضة')} <bdi dir="ltr">({logs.length})</bdi></span>
            <span style={{ color: 'var(--accent)' }}>{t('● أحداث طبقة التحكم')} <bdi dir="ltr">({v1Events.length})</bdi></span>
          </div>
        </Glass>

        {/* Card 3: Cold Vault Archive */}
        <Glass style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
              {t('مستودع الأرشيف البارد (Cold Vault)')}
            </h2>
            <span style={{ fontSize: 11, color: 'var(--chart-out)', fontWeight: 700 }}>{t('365 يوم احتفاظ')}</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
            {t('تُعرض هنا سجلات التدقيق المرتبطة بسلسلة hashes عند توفر Control Plane؛ لا يُعلن توافق WORM قبل ربط تخزين MinIO بسياسة retention وlegal hold فعلية.')}
          </p>
        </Glass>
      </div>

      {/* 3. Event Stream Table (Stitch _6 L33) */}
      <Card
        title={t('مجرى تدفق الأحداث الحية (Live Event Stream)')}
        icon="vault"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
            <Search size={15} color="var(--text-3)" style={{ position: 'absolute', insetInlineEnd: 10 }} />
            <input
              type="text"
              placeholder={t('فلترة بالعملية أو الفاعل أو IP أو الهدف...')}
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="text-input"
              style={{ width: 280, paddingInlineEnd: 32 }}
            />
          </div>
        }
      >
        <TableContainer className="max-h-[560px]" tabIndex={0}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('التاريخ والوقت')}</TableHead>
                <TableHead>{t('الفاعل / المستخدم')}</TableHead>
                <TableHead>{t('الدور (Role)')}</TableHead>
                <TableHead>{t('نوع الإجراء (Action)')}</TableHead>
                <TableHead>{t('الهدف (Target)')}</TableHead>
                <TableHead>{t('عنوان IP')}</TableHead>
                <TableHead>{t('بصمة السجل (SHA-256)')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableEmpty
                  colSpan={7}
                  message={loading ? t('جارٍ تحميل السجلات...') : t('لا توجد سجلات تدقيق مسجلة.')}
                />
              ) : (
                filteredLogs.map((log) => {
                  const isHighRisk = ['KILL_PROCESS', 'TERMINATE', 'DELETE_USER', 'ELEVATE', 'PRIVILEGE_VIOLATION'].includes(log.action);
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="font-telemetry text-muted text-xs whitespace-nowrap">
                        {log.timestamp}
                      </TableCell>
                      <TableCell className="font-bold text-title">{log.user}</TableCell>
                      <TableCell>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                            log.role === 'admin'
                              ? 'bg-status-safe-surface text-status-safe'
                              : log.role === 'operator'
                              ? 'bg-primary/15 text-primary'
                              : 'bg-surface-glass-tint text-muted'
                          }`}
                        >
                          {(log.role || 'USER').toUpperCase()}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-xs font-bold ${
                            isHighRisk ? 'text-status-danger' : 'text-title'
                          }`}
                        >
                          {log.action}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted font-telemetry">{log.target || 'System'}</TableCell>
                      <TableCell className="font-telemetry text-muted text-xs">{log.ip}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-telemetry text-muted bg-surface-container px-1.5 py-0.5 rounded">
                            {(log as any).hash ? `${(log as any).hash.slice(0, 10)}...` : '—'}
                          </span>
                          {(log as any).hash && (
                            <button
                              type="button"
                              onClick={() => copyHash((log as any).hash)}
                              className="text-muted hover:text-title p-1 transition-colors"
                              title={t('نسخ بصمة السطر')}
                            >
                              <Copy size={12} />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* 4. Control-plane hash-chained audit (/api/v1) */}
      <Card
        title={t('سلسلة تدقيق طبقة التحكم (/api/v1 — hash-chained)')}
        icon="vault"
        actions={
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
            {v1Events.length} {t('حدثاً')} · {t('التحقق التشفيري عبر «مطابقة البصمة الآن»')}
          </span>
        }
      >
        <TableContainer className="max-h-[420px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('التسلسل')}</TableHead>
                <TableHead>{t('الوقت')}</TableHead>
                <TableHead>{t('الفاعل')}</TableHead>
                <TableHead>{t('الإجراء')}</TableHead>
                <TableHead>{t('الهدف')}</TableHead>
                <TableHead>{t('بصمة الحدث')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {v1Events.length === 0 ? (
                <TableEmpty
                  colSpan={6}
                  message={loading ? t('جارٍ تحميل أحداث الطبقة التحكمية...') : t('لا توجد أحداث مسجلة في طبقة التحكم بعد.')}
                />
              ) : (
                [...v1Events].reverse().map((ev) => (
                  <TableRow key={ev.sequence ?? ev.event_hash}>
                    <TableCell className="font-telemetry text-muted text-xs">#{ev.sequence ?? '—'}</TableCell>
                    <TableCell className="font-telemetry text-muted text-xs whitespace-nowrap">
                      {ev.created_at ? new Date(ev.created_at).toLocaleString('ar-SA') : '—'}
                    </TableCell>
                    <TableCell className="font-bold text-title">{ev.actor_id || 'system'}</TableCell>
                    <TableCell className="text-xs font-bold text-title">{ev.action || '—'}</TableCell>
                    <TableCell className="text-xs text-muted font-telemetry">{ev.target_id || '—'}</TableCell>
                    <TableCell>
                      <span className="text-[11px] font-telemetry text-muted bg-surface-container px-1.5 py-0.5 rounded" dir="ltr">
                        {ev.event_hash ? `${ev.event_hash.slice(0, 10)}…` : '—'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </div>
  );
}
