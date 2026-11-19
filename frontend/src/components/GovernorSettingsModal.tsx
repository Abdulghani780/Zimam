import { useState, useEffect } from 'react';
import { Modal, Button, Field, TextInput, useToast } from '../asaas-ui';
import { api, type GovernorStatus } from '../lib/api';
import { Zap, Clock, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { t } from '../lib/i18n';

interface GovernorSettingsModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function GovernorSettingsModal({ open, onClose, onSaved }: GovernorSettingsModalProps) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const [autoTrim, setAutoTrim] = useState(true);
  const [idleThreshold, setIdleThreshold] = useState(15);
  const [autoDisconnect, setAutoDisconnect] = useState(true);
  const [disconnectMins, setDisconnectMins] = useState(60);
  const [autoLogoff, setAutoLogoff] = useState(false);
  const [logoffHours, setLogoffHours] = useState(8);

  useEffect(() => {
    if (!open) return;
    api.getGovernorStatus()
      .then((g: GovernorStatus) => {
        setAutoTrim(g.auto_trim ?? true);
        setIdleThreshold(g.idle_threshold_mins ?? 15);
        setAutoDisconnect(g.auto_disconnect_enabled ?? true);
        setDisconnectMins(g.auto_disconnect_mins ?? 60);
        setAutoLogoff(g.auto_logoff_enabled ?? false);
        setLogoffHours(g.auto_logoff_hours ?? 8);
      })
      .catch((err) => {
        toast(err.message || t('تعذر تحميل إعدادات الحاكم'), 'error');
      })

  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateGovernor({
        auto_trim: autoTrim,
        idle_threshold_mins: Number(idleThreshold),
        auto_disconnect_enabled: autoDisconnect,
        auto_disconnect_mins: Number(disconnectMins),
        auto_logoff_enabled: autoLogoff,
        auto_logoff_hours: Number(logoffHours),
      });
      toast(t('تم حفظ سياسات حاكم الموارد الذكي في قاعدة البيانات بنجاح.'), 'success');
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      toast(err.message || t('فشل حفظ الإعدادات'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('إعدادات حاكم الموارد الذكي (Resource Governor Policies)')}
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Policy 1: Auto Memory Trim */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'var(--glass-inset)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Zap size={20} color="var(--accent)" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{t('التفريغ التلقائي للذاكرة (Auto Trim)')}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('تفريغ صفحات الذاكرة الخاملة فور تجاوز ضغط الرام 70%')}</div>
            </div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              aria-label={t('تفعيل التقليص التلقائي للموارد')}
              checked={autoTrim}
              onChange={(e) => setAutoTrim(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        {/* Policy 2: Idle Threshold Slider */}
        <div style={{ padding: 12, background: 'var(--glass-inset)', borderRadius: 'var(--radius-md)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>{t('عتبة خمول الجلسات المستهدفة:')}</span>
            <span style={{ fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font)' }} dir="ltr">{idleThreshold} {t('دقيقة')}</span>
          </div>
          <input
            type="range"
            min={1}
            max={60}
            value={idleThreshold}
            onChange={(e) => setIdleThreshold(Number(e.target.value))}
            style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
        </div>

        {/* Policy 3: Auto Disconnect */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'var(--glass-inset)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Clock size={20} color="var(--partial)" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{t('فصل الجلسات الخاملة تلقائياً (Auto Disconnect)')}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('تحويل الجلسة إلى منفصلة بعد وقت خمول محدد')}</div>
            </div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              aria-label={t('تفعيل الفصل التلقائي للجلسات الخاملة')}
              checked={autoDisconnect}
              onChange={(e) => setAutoDisconnect(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        {autoDisconnect && (
          <Field label={t('مهلة الخمول قبل الفصل (بالدقائق)')}>
            {(id) => (
              <TextInput
                id={id}
                type="number"
                min={5}
                max={480}
                value={disconnectMins}
                onChange={(e) => setDisconnectMins(Number(e.target.value))}
                required
              />
            )}
          </Field>
        )}

        {/* Policy 4: Daily Logoff */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12, background: 'var(--glass-inset)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldAlert size={20} color="var(--unpaid)" />
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{t('تسجيل الخروج الإجباري اليومي (Mandatory Logoff)')}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t('إنهاء الجلسات المفتوحة التي تتجاوز الساعات المحددة')}</div>
            </div>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              aria-label={t('تفعيل تسجيل الخروج اليومي التلقائي')}
              checked={autoLogoff}
              onChange={(e) => setAutoLogoff(e.target.checked)}
            />
            <span className="toggle-slider" />
          </label>
        </div>

        {autoLogoff && (
          <Field label={t('أقصى مدة بقاء للجلسة (بالساعات)')}>
            {(id) => (
              <TextInput
                id={id}
                type="number"
                min={1}
                max={48}
                value={logoffHours}
                onChange={(e) => setLogoffHours(Number(e.target.value))}
                required
              />
            )}
          </Field>
        )}

        {/* Footer Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('إلغاء')}
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            <CheckCircle2 size={16} />
            {t('حفظ السياسات وتطبيقها')}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
