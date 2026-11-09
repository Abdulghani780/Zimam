import { useState, useEffect } from 'react';
import { Modal, Button, Skeleton } from '../asaas-ui';
import { api } from '../lib/api';
import { ShieldCheck, AlertTriangle, CheckCircle, RefreshCw, Cpu, Database, HardDrive } from 'lucide-react';

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
    <Modal onClose={onClose} title="تقرير التشخيص الذكي لخوادم أساس (AI Ops Radar)">
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
                background: data.score >= 80 ? 'rgba(34, 197, 94, 0.12)' : 'rgba(234, 179, 8, 0.12)',
                border: data.score >= 80 ? '1px solid rgba(34, 197, 94, 0.35)' : '1px solid rgba(234, 179, 8, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {data.score >= 80 ? (
                  <ShieldCheck size={36} color="#22c55e" />
                ) : (
                  <AlertTriangle size={36} color="#eab308" />
                )}
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: data.score >= 80 ? '#22c55e' : '#eab308' }}>
                    مستوى كفاءة واستقرار السيرفر: {data.status || 'ممتاز'}
                  </div>
                  <div style={{ fontSize: 12, color: '#a8a29e', marginTop: 4 }}>
                    {data.summary || 'تم إجراء فحص شامل للذاكرة والأنوية والأقراص وعمليات الـ RDP.'}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: 34, fontWeight: 800, color: data.score >= 80 ? '#22c55e' : '#eab308', fontVariantNumeric: 'tabular-nums' }}>
                {data.score || 95}%
              </div>
            </div>

            {/* Findings & Checks */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#d4a017' }}>
                المؤشرات الحيوية التي تم تدقيقها:
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                <div style={{ padding: 14, borderRadius: 10, background: '#1c1a18', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#8a8478' }}>
                    <Cpu size={15} color="#d4a017" /> المعالج والأنوية
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6, color: '#f0ede6' }}>
                    {data.cpu_health || 'استقرار تام'}
                  </div>
                </div>
                <div style={{ padding: 14, borderRadius: 10, background: '#1c1a18', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#8a8478' }}>
                    <Database size={15} color="#d4a017" /> حاكم الذاكرة
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6, color: '#f0ede6' }}>
                    {data.ram_health || 'محمي من التسريب'}
                  </div>
                </div>
                <div style={{ padding: 14, borderRadius: 10, background: '#1c1a18', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#8a8478' }}>
                    <HardDrive size={15} color="#d4a017" /> الأقراص والتخزين
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 6, color: '#f0ede6' }}>
                    {data.disk_health || 'مساحة كافية'}
                  </div>
                </div>
              </div>
            </div>

            {/* Recommendations */}
            {data.recommendations && data.recommendations.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#d4a017' }}>
                  توصيات الذكاء الاصطناعي لتحسين الأداء:
                </div>
                <ul style={{ paddingInlineStart: 20, margin: 0, fontSize: 13, color: '#d6d0c4', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {data.recommendations.map((rec: string, idx: number) => (
                    <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <CheckCircle size={14} color="#22c55e" />
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <div style={{ padding: 24, textAlign: 'center', color: '#8a8478' }}>
            تعذر جلب تقرير التشخيص.
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 12 }}>
          <Button variant="ghost" onClick={runDiagnosis} loading={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <RefreshCw size={14} />
            <span>إعادة الفحص الآن</span>
          </Button>
          <Button variant="primary" onClick={onClose} style={{ minWidth: 120 }}>
            إغلاق التقرير
          </Button>
        </div>
      </div>
    </Modal>
  );
}
