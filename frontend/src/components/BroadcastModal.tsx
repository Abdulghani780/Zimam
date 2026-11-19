import { useState } from 'react';
import { Modal, Button, Field, TextInput, TextArea, useToast } from '../asaas-ui';
import { api } from '../lib/api';
import { ShieldAlert, Send, AlertTriangle } from 'lucide-react';
import { t } from '../lib/i18n';

interface BroadcastModalProps {
  open: boolean;
  onClose: () => void;
  targetSessionId?: number;
  targetUser?: string;
}

export function BroadcastModal({ open, onClose, targetSessionId, targetUser }: BroadcastModalProps) {
  const toast = useToast();
  const [title, setTitle] = useState(t('إشعار رسمي من إدارة السيرفر'));
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [elevating, setElevating] = useState(false);
  const [accessDeniedError, setAccessDeniedError] = useState<string | null>(null);

  const isBroadcast = targetSessionId === undefined || targetSessionId === -1;

  if (!open) return null;

  const submitMessage = async () => {
    if (!message.trim()) return;
    setLoading(true);
    setAccessDeniedError(null);
    try {
      const res = await api.sendMessage(
        isBroadcast ? -1 : targetSessionId!,
        title,
        message,
        isBroadcast
      );
      if (!res.ok) {
        if (res.error?.includes('Access Denied') || res.error?.includes('5')) {
          setAccessDeniedError(res.error);
        } else {
          toast(res.error || t('حدث خطأ أثناء محاولة إرسال الرسالة.'), 'error');
        }
        return;
      }
      toast(
        isBroadcast
          ? t('تم بث الإشعار بنجاح لجميع جلسات المستخدمين.')
          : (res.message || (t('تم تسليم الرسالة للمستخدم: ') + (targetUser || targetSessionId))),
        'success'
      );
      if (res.warning) toast(res.warning, 'info');
      setMessage('');
      setAccessDeniedError(null);
      onClose();
    } catch (err: any) {
      toast(err.message || t('خطأ في الإرسال'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await submitMessage();
  };

  const handleElevateAndRetry = async () => {
    setElevating(true);
    try {
      const res = await api.requestElevation();
      if (res.already_admin) {
        await submitMessage();
        return;
      }
      toast(res.message || t('تم إطلاق طلب الترقية، يرجى الموافقة على نافذة UAC في شاشة السيرفر.'), 'info');
      const deadline = Date.now() + 90_000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
        try {
          const health = await api.getHealth();
          if (health.is_admin) {
            await submitMessage();
            return;
          }
        } catch {
          // The service restarts during elevation; keep polling until the deadline.
        }
      }
      toast(t('لم يتم تأكيد صلاحيات المسؤول خلال 90 ثانية؛ لم تُرسل الرسالة. تحقق من الخدمة ثم أعد المحاولة.'), 'error');
    } catch (err: any) {
      toast(err.message || t('فشلت الترقية'), 'error');
    } finally {
      setElevating(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={isBroadcast ? t('بث تنبيه فوري لجميع المستخدمين') : `${t('إرسال رسالة للمستخدم: ')}${targetUser || targetSessionId}`}
    >
      <form onSubmit={handleSubmit} className="form" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label={t('عنوان التنبيه')}>
          {(id) => (
            <TextInput
              id={id}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          )}
        </Field>

        <Field label={t('نص الرسالة')} hint={t('ستظهر الرسالة كنافذة منبثقة مباشرة فوق شاشات سطح المكتب النشطة')}>
          {(id) => (
            <TextArea
              id={id}
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('أدخل نص الرسالة أو التنبيه للمستخدم...')}
              required
            />
          )}
        </Field>

        {accessDeniedError && (
          <div
            style={{
              padding: 14,
              borderRadius: 10,
              background: 'var(--unpaid-bg)',
              border: '1px solid var(--unpaid-bg)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} color="var(--unpaid)" />
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--unpaid)' }}>
                {t('يتطلب إرسال التنبيهات بين الجلسات صلاحيات مسؤول (Elevated Administrator)')}
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0 }}>
              {t('السيرفر يعمل حالياً بصلاحيات المستخدم العادي. اضغط الزر بالأسفل لترقية السيرفر فوراً عبر UAC ثم إعادة إرسال التنبيه تلقائياً:')}
            </p>
            <Button
              type="button"
              variant="primary"
              loading={elevating}
              onClick={handleElevateAndRetry}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
            >
              <ShieldAlert size={14} />
              <span>{t('ترقية صلاحيات السيرفر كمسؤول وتكرار الإرسال')}</span>
            </Button>
          </div>
        )}

        <div className="cluster" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('إلغاء')}
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            <Send size={13} />
            <span>{t('إرسال التنبيه الآن')}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}
