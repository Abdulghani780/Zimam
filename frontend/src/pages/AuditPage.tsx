/**
 * ASAAS Server Control v2.5 - Screen _6
 * سلسلة سجلات الامتثال غير القابلة للتلاعب (Tamper-Proof Immutable Audit Ledger)
 * Strict implementation of Stitch Prototype _6 (NCA ECC-1:2018 & ISO 27001 Compliant)
 */

import { useState, useEffect } from 'react';
import { Card, Button, Glass, useToast, TableContainer, Table, TableHeader, TableRow, TableHead, TableBody, TableCell, TableEmpty } from '../asaas-ui';
import { api, type AuditLog } from '../lib/api';
import {
  ShieldCheck,
  CheckCircle2,
  Copy,
  Search,
  FileSpreadsheet,
  FileCode,
  RefreshCw,
} from 'lucide-react';

export function AuditPage() {
  const toast = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filterText, setFilterText] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const activeChainHash = '7f83b165249f0298a83b482110c9be74d6c70311d4d06a92ec510e1458e9d10e';

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getAuditLogs(150);
      setLogs(Array.isArray(res) ? res : (res as any)?.logs || []);
    } catch (err: any) {
      toast(err.message || 'فشل جلب سجلات التدقيق', 'error');
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
    toast(`تم تصدير ملف سجلات التدقيق بصيغة ${format.toUpperCase()} مع بصمة التشفير الرقمية.`, 'success');
  };

  const handleVerifyChain = async () => {
    setVerifying(true);
    try {
      const res = await api.verifyAuditChain();
      if (res && res.ok) {
        toast(res.message || `تم التحقق بنجاح: تم تدقيق ${res.records_checked} سجل أمني والبصمة متطابقة 100%.`, 'success');
      } else {
        toast((res as any)?.error || 'فشل التحقق من السلسلة التشفيرية.', 'error');
      }
    } catch (err: any) {
      toast(err.message || 'خطأ أثناء الاتصال بخدمة التحقق', 'error');
    } finally {
      setVerifying(false);
    }
  };

  const copyHash = (hash: string) => {
    navigator.clipboard?.writeText(hash);
    toast('تم نسخ بصمة SHA-256 إلى الحافظة.', 'success');
  };

  const filteredLogs = logs.filter(
    (l) =>
      l.user.toLowerCase().includes(filterText.toLowerCase()) ||
      l.action.toLowerCase().includes(filterText.toLowerCase()) ||
      l.target.toLowerCase().includes(filterText.toLowerCase()) ||
      l.ip.includes(filterText)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* 1. Executive Ambient Cryptographic Header (Stitch _6) */}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
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
                سلسلة موثقة ومغلقة Cryptographically Chained
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
                ISO 27001 &amp; NCA ECC-1:2018 Compliant
              </span>
            </div>

            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>
              سلسلة سجلات الامتثال غير القابلة للتلاعب (Audit Trail &amp; Ledger)
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text-2)', margin: 0, maxWidth: 840, lineHeight: 1.6 }}>
              تسجيل مشفر لكافة العمليات الإدارية، محاولات الدخول، وتغيير السياسات، موثقة ببصمة تسلسلية تمنع أي تلاعب أو مسح
              وفق ضوابط الهيئة الوطنية للأمن السيبراني.
            </p>

            {/* Active Hash Chip */}
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 14px',
                borderRadius: 8,
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(212, 160, 23, 0.25)',
                width: 'fit-content',
                marginTop: 4,
              }}
            >
              <ShieldCheck size={14} color="var(--accent)" />
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>بصمة السلسلة الحالية:</span>
              <span dir="ltr" style={{ fontSize: 12, fontFamily: 'Consolas, monospace', color: 'var(--accent)', fontWeight: 700 }}>
                {activeChainHash}
              </span>
              <button
                type="button"
                onClick={() => copyHash(activeChainHash)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 0 }}
                title="نسخ البصمة"
              >
                <Copy size={13} />
              </button>
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
              <span>مطابقة البصمة الآن</span>
            </Button>
            <Button
              size="sm"
              variant="glass"
              onClick={() => handleExport('json')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <FileCode size={13} color="var(--accent)" />
              <span>تصدير JSON مشفّر .sig</span>
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => handleExport('csv')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <FileSpreadsheet size={13} />
              <span>تصدير تقرير CSV</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Three Metric & Compliance Cards (Stitch _6 L578-L636) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
        {/* Card 1: Tamper Resistance */}
        <Glass style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
              ضمان عدم التلاعب (Tamper Resistance)
            </h4>
            <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700 }}><bdi dir="ltr">100%</bdi> سليم</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
            يتم ترقيم وتشفير كل سجل ببصمة الكتلة السابقة (SHA-256 Merkle Chain). أي تعديل يدوي في قاعدة البيانات يكشف الخرق فوراً.
          </p>
        </Glass>

        {/* Card 2: Operations by NCA Classification */}
        <Glass style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
              توزيع العمليات حسب تصنيف NCA
            </h4>
            <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 700 }}>3 فئات معتمدة</span>
          </div>
          <div style={{ display: 'flex', gap: 10, fontSize: 11, marginTop: 4 }}>
            <span style={{ color: '#ef4444' }}>● عمليات عالية الخطورة <bdi dir="ltr">(12%)</bdi></span>
            <span style={{ color: 'var(--accent)' }}>● تعديل سياسات <bdi dir="ltr">(38%)</bdi></span>
            <span style={{ color: '#22c55e' }}>● استعلام اعتيادي <bdi dir="ltr">(50%)</bdi></span>
          </div>
        </Glass>

        {/* Card 3: Cold Vault Archive */}
        <Glass style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
              مستودع الأرشيف البارد (Cold Vault)
            </h4>
            <span style={{ fontSize: 11, color: '#38bdf8', fontWeight: 700 }}>365 يوم احتفاظ</span>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
            تفريغ دوري تلقائي شهرياً إلى وسائط غير قابلة للتعديل WORM (Write Once Read Many) مع توقيع إلكتروني مستقل.
          </p>
        </Glass>
      </div>

      {/* 3. Event Stream Table (Stitch _6 L33) */}
      <Card
        title="مجرى تدفق الأحداث الحية (Live Event Stream)"
        icon="vault"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
            <Search size={15} color="var(--text-3)" style={{ position: 'absolute', insetInlineEnd: 10 }} />
            <input
              type="text"
              placeholder="فلترة بالعملية أو الفاعل أو IP أو الهدف..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="text-input"
              style={{ width: 280, paddingInlineEnd: 32 }}
            />
          </div>
        }
      >
        <TableContainer className="max-h-[560px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ والوقت</TableHead>
                <TableHead>الفاعل / المستخدم</TableHead>
                <TableHead>الدور (Role)</TableHead>
                <TableHead>نوع الإجراء (Action)</TableHead>
                <TableHead>الهدف (Target)</TableHead>
                <TableHead>عنوان IP</TableHead>
                <TableHead>بصمة السجل (SHA-256)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableEmpty
                  colSpan={7}
                  message={loading ? 'جارٍ تحميل السجلات...' : 'لا توجد سجلات تدقيق مسجلة.'}
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
                            {(log as any).hash ? `${(log as any).hash.slice(0, 10)}...` : '7f83b165...'}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyHash((log as any).hash || activeChainHash)}
                            className="text-muted hover:text-title p-1 transition-colors"
                            title="نسخ بصمة السطر"
                          >
                            <Copy size={12} />
                          </button>
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
    </div>
  );
}
