import { useState } from 'react';
import { Modal, Button, Field, TextInput, TextArea, useToast } from '../asaas-ui';
import { api } from '../lib/api';
import { ShieldAlert, Send, AlertTriangle } from 'lucide-react';

interface BroadcastModalProps {
  open: boolean;
  onClose: () => void;
  targetSessionId?: number;
  targetUser?: string;
}

export function BroadcastModal({ open, onClose, targetSessionId, targetUser }: BroadcastModalProps) {
  const toast = useToast();
  const [title, setTitle] = useState('إشعار رسمي من إدارة السيرفر');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [elevating, setElevating] = useState(false);
  const [accessDeniedError, setAccessDeniedError] = useState<string | null>(null);

  const isBroadcast = targetSessionId === undefined || targetSessionId === -1;

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      if (res.ok) {
        toast(
          isBroadcast
            ? 'تم بث الإشعار بنجاح لجميع جلسات المستخدمين.'
            : (res.message || ('تم تسليم الرسالة للمستخدم: ' + (targetUser || targetSessionId))),
          'success'
        );
        if (res.warning) {
          toast(res.warning, 'info');
        }
        setMessage('');
        setAccessDeniedError(null);
        onClose();
      } else {
        if (res.error?.includes('Access Denied') || res.error?.includes('5')) {
          setAccessDeniedError(res.error);
        } else {
          toast(res.error || 'حدث خطأ أثناء محاولة إرسال الرسالة.', 'error');
        }
      }
    } catch (err: any) {
      toast(err.message || 'خطأ في الإرسال', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleElevateAndRetry = async () => {
    setElevating(true);
    try {
      const res = await api.requestElevation();
      toast(res.message || 'تم إرسال طلب الترقية، يرجى الموافقة على نافذة UAC في شاشة السيرفر.', 'success');
    } catch (err: any) {
      toast(err.message || 'فشلت الترقية', 'error');
    } finally {
      setElevating(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={isBroadcast ? 'بث تنبيه فوري لجميع المستخدمين' : `إرسال رسالة للمستخدم: ${targetUser || targetSessionId}`}
    >
      <form onSubmit={handleSubmit} className="form" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Field label="عنوان التنبيه">
          {(id) => (
            <TextInput
              id={id}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          )}
        </Field>

        <Field label="نص الرسالة" hint="ستظهر الرسالة كنافذة منبثقة مباشرة فوق شاشات سطح المكتب النشطة">
          {(id) => (
            <TextArea
              id={id}
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="أدخل نص الرسالة أو التنبيه للمستخدم..."
              required
            />
          )}
        </Field>

        {accessDeniedError && (
          <div
            style={{
              padding: 14,
              borderRadius: 10,
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} color="#ef4444" />
              <span style={{ fontSize: 13, fontWeight: 700, color: '#ef4444' }}>
                يتطلب إرسال التنبيهات بين الجلسات صلاحيات مسؤول (Elevated Administrator)
              </span>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0 }}>
              السيرفر يعمل حالياً بصلاحيات المستخدم العادي. اضغط الزر بالأسفل لترقية السيرفر فوراً عبر UAC ثم إعادة إرسال التنبيه تلقائياً:
            </p>
            <Button
              type="button"
              variant="primary"
              loading={elevating}
              onClick={handleElevateAndRetry}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, alignSelf: 'flex-start' }}
            >
              <ShieldAlert size={14} />
              <span>ترقية صلاحيات السيرفر كمسؤول وتكرار الإرسال</span>
            </Button>
          </div>
        )}

        <div className="cluster" style={{ justifyContent: 'flex-end', marginTop: 10 }}>
          <Button type="button" variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            <Send size={13} />
            <span>إرسال التنبيه الآن</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}
