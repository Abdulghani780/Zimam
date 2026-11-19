import { useCallback, useEffect, useState } from 'react';
import { apiV1, type V1Recording } from '../lib/apiV1';
import { Button, Card, Glass, Modal, useToast } from '../asaas-ui';
import { Download, Play, RefreshCw } from 'lucide-react';
import { RemoteSession } from '../components/RemoteSession';
import { t } from '../lib/i18n';

function formatDate(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function SessionReplayPage() {
  const toast = useToast();
  const [recordings, setRecordings] = useState<V1Recording[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchRecordings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiV1.recordings();
      setRecordings(Array.isArray(res.items) ? res.items : []);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : t('تعذر تحميل التسجيلات الحقيقية.');
      setError(message);
      toast(message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchRecordings();
  }, [fetchRecordings]);

  const selected = recordings.find((recording) => recording.recording_id === selectedId) || null;

  const exportRecording = async () => {
    if (!selected) return;
    setExporting(true);
    try {
      const blob = await apiV1.downloadRecording(selected.recording_id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `asaas-${selected.recording_id}.jsonl`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast(t('تم تنزيل تدفق التسجيل الأصلي بصيغة JSONL.'), 'success');
    } catch (reason) {
      toast(reason instanceof Error ? reason.message : t('فشل تصدير التسجيل.'), 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="page">
      <div className="page-head-hero">
        <div>
          <h1 style={{ margin: 0 }}>{t('استرجاع تسجيلات الجلسات الحقيقية')}</h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text-2)' }}>
            {t('تشغيل تدفق Guacamole المسجل فعلياً من بوابة الجلسات، دون أحداث اصطناعية أو مؤقتات تقديرية.')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="ghost" onClick={() => void fetchRecordings()} loading={loading}>
            <RefreshCw size={14} />{t('تحديث')}
          </Button>
          <Button variant="secondary" onClick={() => void exportRecording()} disabled={!selected || exporting} loading={exporting}>
            <Download size={14} />{t('تصدير التسجيل JSONL')}
          </Button>
        </div>
      </div>

      {error && (
        <Glass style={{ padding: 16, color: 'var(--unpaid)' }} role="alert">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => void fetchRecordings()} style={{ marginInlineStart: 12 }}>{t('إعادة المحاولة')}</Button>
        </Glass>
      )}

      <Card title={`${t('التسجيلات المتاحة')} (${recordings.length})`} icon="list">
        {loading && recordings.length === 0 ? (
          <p role="status">{t('جارٍ تحميل التسجيلات...')}</p>
        ) : !error && recordings.length === 0 ? (
          <p style={{ color: 'var(--text-3)' }}>{t('لا توجد تسجيلات مكتملة. تُنشأ التسجيلات عند انتهاء جلسة بوابة RDP/SSH/VNC حقيقية.')}</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('معرف التسجيل')}</th>
                  <th>{t('البروتوكول')}</th>
                  <th>{t('بدء الجلسة')}</th>
                  <th>{t('انتهاء الجلسة')}</th>
                  <th>{t('التعليمات المسجلة')}</th>
                  <th>{t('الحجم')}</th>
                  <th>{t('الإجراء')}</th>
                </tr>
              </thead>
              <tbody>
                {recordings.map((recording) => (
                  <tr key={recording.recording_id}>
                    <td dir="ltr" style={{ fontFamily: 'var(--font-telemetry)' }}>{recording.recording_id}</td>
                    <td dir="ltr">{recording.protocol.toUpperCase()}</td>
                    <td dir="ltr">{formatDate(recording.started_at)}</td>
                    <td dir="ltr">{formatDate(recording.finished_at)}</td>
                    <td>{recording.instructions}</td>
                    <td>{(recording.bytes / 1024).toFixed(1)} KB</td>
                    <td>
                      <Button size="sm" variant="primary" onClick={() => setSelectedId(recording.recording_id)}>
                        <Play size={13} />{t('تشغيل التسجيل')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected && (
        <Modal open onClose={() => setSelectedId(null)} title={`${t('تسجيل')} ${selected.recording_id}`} wide>
          <RemoteSession
            key={selected.recording_id}
            protocol={selected.protocol}
            recordingId={selected.recording_id}
            onClose={() => setSelectedId(null)}
          />
        </Modal>
      )}
    </div>
  );
}
