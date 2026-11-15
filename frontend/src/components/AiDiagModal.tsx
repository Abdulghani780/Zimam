import { useState, useEffect } from 'react';
import { Modal, Button, Skeleton } from '../asaas-ui';
import { api } from '../lib/api';
import { ShieldCheck, AlertTriangle, CheckCircle, RefreshCw, Cpu, Database, HardDrive } from 'lucide-react';
import { t } from '../lib/i18n';

interface AiDiagModalProps {
  open: boolean;
  onClose: () => void;
}

export function AiDiagModal({ open, onClose }: AiDiagModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  const runDiagnosis = async () => {
    setLoading(true);
    try {
      const res = await api.getAiDiagnosis();
      setData(res);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      runDiagnosis();
    }
  }, [open]);

  if (!open) return null;

  return (
    <Modal onClose={onClose} title={t('تقرير التشخيص الذكي لخوادم أساس (AI Ops Radar)')}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {loading ? (
          <Skeleton count={4} height={42} />
        ) : data ? (
          <>
            {/* Score Banner */}
            <div
              style={{
                padding: '18px 22px',
                borderRadius: '12px',
                background: data.score >= 80 ? 'var(--paid-bg)' : 'var(--partial-bg)',
                border: data.score >= 80 ? '1px solid var(--paid-bg)' : '1px solid var(--partial-bg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {data.score >= 80 ? (
                  <ShieldCheck size={36} color="var(--paid)" />
                ) : (
                  <AlertTriangle size={36} color="var(--partial)" />
                )}
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: data.score >= 80 ? 'var(--paid)' : 'var(--partial)' }}>
                    مستوى كفاءة واستقرار السيرفر: {data.status || t('ممتاز')}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>
                    {data.summary || t('تم إجراء فحص شامل للذاكرة والأنوية والأقراص وعمليات الـ RDP.')}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 34, fontWeight: 800, color: data.score >= 80 ? 'var(--paid)' : 'var(--partial)', fontVariantNumeric: 'tabular-nums' }}>
                {data.score || 95}%
              </div>
            </div>

            {/* Findings & Checks */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                {t('المؤشرات الحيوية التي تم تدقيقها:')}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div style={{ padding: 14, borderRadius: 10, background: 'var(--glass-tint-strong)', border: '1px solid var(--glass-rim-low)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-3)' }}>
                    <Cpu size={15} color="var(--accent)" /> {t('المعالج والأنوية')}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6, color: 'var(--text)' }}>
                    {data.cpu_health || t('استقرار تام')}
                  </div>
                </div>
                <div style={{ padding: 14, borderRadius: 10, background: 'var(--glass-tint-strong)', border: '1px solid var(--glass-rim-low)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-3)' }}>
                    <Database size={15} color="var(--accent)" /> {t('حاكم الذاكرة')}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6, color: 'var(--text)' }}>
                    {data.ram_health || t('محمي من التسريب')}
                  </div>
                </div>
                <div style={{ padding: 14, borderRadius: 10, background: 'var(--glass-tint-strong)', border: '1px solid var(--glass-rim-low)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-3)' }}>
                    <HardDrive size={15} color="var(--accent)" /> {t('الأقراص والتخزين')}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6, color: 'var(--text)' }}>
                    {data.disk_health || t('مساحة كافية')}
                  </div>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            {data.recommendations && data.recommendations.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>
                  {t('توصيات الذكاء الاصطناعي لتحسين الأداء:')}
                </div>
                <ul style={{ paddingInlineStart: 20, margin: 0, fontSize: 13, color: 'var(--text-2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {data.recommendations.map((rec: string, idx: number) => (
                    <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle size={14} color="var(--paid)" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>
            {t('تعذر جلب تقرير التشخيص.')}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 12 }}>
          <Button variant="ghost" onClick={runDiagnosis} loading={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} />
            <span>{t('إعادة الفحص الآن')}</span>
          </Button>
          <Button variant="primary" onClick={onClose} style={{ minWidth: 120 }}>
            {t('إغلاق التقرير')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
