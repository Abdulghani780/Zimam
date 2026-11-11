import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Clock3, ShieldCheck } from 'lucide-react';
import { Button, Glass } from '../asaas-ui';

export function PerimeterLockoutPage() {
  const navigate = useNavigate();

  return (
    <main className="access-state-page" dir="rtl">
      <a href="/" className="brand access-state-page__brand" aria-label="منظومة أساس">
        <span className="brand__mark" />
        <span>
          <strong className="brand__name">منظومة أساس</strong>
          <small className="brand__tag">إدارة الوصول والخوادم</small>
        </span>
      </a>

      <Glass thick className="access-state-card">
        <span className="access-state-card__icon" aria-hidden="true"><AlertTriangle size={28} /></span>
        <div className="access-state-card__copy">
          <span className="access-state-card__eyebrow">حماية الحساب</span>
          <h1>تم إيقاف محاولة الدخول مؤقتًا</h1>
          <p className="prose">
            حدثت محاولات دخول متكررة. انتظر انتهاء مدة الحماية ثم أعد المحاولة، أو أعد ضبط حساب الطوارئ من جهاز ASAAS نفسه.
          </p>
        </div>

        <div className="access-state-grid">
          <div><Clock3 size={18} /><span><strong>مدة الانتظار</strong><small>يحددها خادم المصادقة</small></span></div>
          <div><ShieldCheck size={18} /><span><strong>إعادة الضبط</strong><small>من أداة bootstrap المحلية</small></span></div>
        </div>

        <div className="cluster access-state-card__actions">
          <Button variant="primary" iconNode={<ArrowRight size={17} />} onClick={() => navigate('/login', { replace: true })}>
            العودة إلى تسجيل الدخول
          </Button>
          <Button variant="ghost" onClick={() => window.location.reload()}>فحص الحالة مجددًا</Button>
        </div>
      </Glass>

      <p className="access-state-page__note">
        لا يمكن تجاوز الحماية من المتصفح. تُسجّل محاولات الدخول في سجل التدقيق.
      </p>
    </main>
  );
}
