import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Clock3, ShieldCheck } from 'lucide-react';
import { Button, Glass } from '../asaas-ui';
import { t } from '../lib/i18n';

export function PerimeterLockoutPage() {
  const navigate = useNavigate();

  return (
    <main className="access-state-page" dir="rtl">
      <a href="/" className="brand access-state-page__brand" aria-label={t('منظومة أساس')}>
        <span className="brand__mark" />
        <span>
          <strong className="brand__name">{t('منظومة أساس')}</strong>
          <small className="brand__tag">{t('إدارة الوصول والخوادم')}</small>
        </span>
      </a>

      <Glass thick className="access-state-card">
        <span className="access-state-card__icon" aria-hidden="true"><AlertTriangle size={28} /></span>
        <div className="access-state-card__copy">
          <span className="access-state-card__eyebrow">{t('حماية الحساب')}</span>
          <h1>{t('تم إيقاف محاولة الدخول مؤقتًا')}</h1>
          <p className="prose">
            {t('حدثت محاولات دخول متكررة. انتظر انتهاء مدة الحماية ثم أعد المحاولة، أو أعد ضبط حساب الطوارئ من جهاز ASAAS نفسه.')}
          </p>
        </div>

        <div className="access-state-grid">
          <div><Clock3 size={18} /><span><strong>{t('مدة الانتظار')}</strong><small>{t('يحددها خادم المصادقة')}</small></span></div>
          <div><ShieldCheck size={18} /><span><strong>{t('إعادة الضبط')}</strong><small>{t('من أداة bootstrap المحلية')}</small></span></div>
        </div>

        <div className="cluster access-state-card__actions">
          <Button variant="primary" iconNode={<ArrowRight size={17} />} onClick={() => navigate('/login', { replace: true })}>
            {t('العودة إلى تسجيل الدخول')}
          </Button>
          <Button variant="ghost" onClick={() => window.location.reload()}>{t('فحص الحالة مجددًا')}</Button>
        </div>
      </Glass>

      <p className="access-state-page__note">
        {t('لا يمكن تجاوز الحماية من المتصفح. تُسجّل محاولات الدخول في سجل التدقيق.')}
      </p>
    </main>
  );
}
