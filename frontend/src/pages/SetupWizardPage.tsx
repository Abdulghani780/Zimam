import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Languages, Moon, ShieldCheck, Sparkles, Sun, UserPlus } from 'lucide-react';
import { Button, Field, FormError, Glass, PasswordInput, Stretch, TextInput, useTheme } from '../asaas-ui';
import { apiV1 } from '../lib/apiV1';
import { useLang, toggleLang, t } from '../lib/i18n';

/**
 * First-run wizard for the ASAAS appliance.
 * Shown only while GET /api/v1/setup/status reports needs_setup — the
 * endpoint seals itself permanently after the first administrator exists.
 */
export function SetupWizardPage() {
  const navigate = useNavigate();
  const [theme, toggleTheme] = useTheme();
  const lang = useLang();
  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [licenseToken, setLicenseToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const passwordMismatch = confirm.length > 0 && password !== confirm;
  const canContinue =
    username.trim().length >= 3 && password.length >= 12 && password === confirm;

  const finish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canContinue) return;
    setLoading(true);
    setError(null);
    try {
      await apiV1.setupComplete({
        username: username.trim(),
        password,
        full_name: fullName.trim() || undefined,
        license_token: licenseToken.trim() || undefined,
      });
      navigate('/', { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason : new Error(t('تعذّر إكمال الإعداد.')));
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <header className="auth-page__topbar">
        <span className="brand auth-brand" aria-label={t('زمام')}>
          <span className="brand__mark" aria-hidden="true" />
          <span>
            <strong className="brand__name">{t('زمام')}</strong>
            <small className="brand__tag">{t('إعداد أول تشغيل')}</small>
          </span>
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="button" variant="ghost" iconNode={<Languages size={18} />} label={lang === 'ar' ? 'English' : 'العربية'} onClick={toggleLang} />
          <Button type="button" variant="ghost" iconNode={theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />} label={theme === 'dark' ? t('الوضع النهاري') : t('الوضع الليلي')} onClick={toggleTheme} />
        </div>
      </header>

      <section className="auth-page__content" aria-labelledby="setup-title">
        <div className="auth-intro">
          <span className="auth-intro__eyebrow"><Sparkles size={16} /> {t('ترحيب بك في زمام')}</span>
          <p className="auth-intro__greeting" aria-hidden="true">
            <Stretch before={t('مس')} after={t('اء')} length={3} /> {t('الخير')}
          </p>
          <h1 id="setup-title" className="display">{t('إعداد أول تشغيل للمنظومة')}</h1>
          <p className="prose">
            {t('خطوتان تفصلانك عن لوحة تحكم خوادم مؤمّنة: حساب المشرف، ثم الرخصة (أو التجربة المجانية). هذه الشاشة تظهر مرة واحدة فقط.')}
          </p>
          <div className="auth-trust-list" aria-label={t('ما سيحدث')}>
            <span>{t('تجربة 30 يوماً كاملة')}</span>
            <span>{t('رخصة موقّعة offline')}</span>
            <span>{t('بدون اتصال إنترنت')}</span>
          </div>
        </div>

        <Glass thick className="auth-card">
          <div className="auth-card__heading">
            <span className="auth-card__icon">{step === 1 ? <UserPlus size={22} /> : <KeyRound size={22} />}</span>
            <div>
              <h2>{step === 1 ? t('حساب المشرف') : t('الرخصة')}</h2>
              <p>{step === 1 ? t('الخطوة 1 من 2 — من سيدير المنظومة') : t('الخطوة 2 من 2 — تفعيل الباقة أو التجربة')}</p>
            </div>
          </div>

          {step === 1 ? (
            <form className="form auth-form" onSubmit={(e) => { e.preventDefault(); if (canContinue) setStep(2); }}>
              <Field label={t('الاسم الكامل (اختياري)')}>
                {(id) => <TextInput id={id} value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t('مثال: عبد الغني علي')} />}
              </Field>
              <Field label={t('اسم المستخدم')} required>
                {(id, isError) => <TextInput id={id} value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required error={isError} placeholder="admin" dir="ltr" />}
              </Field>
              <Field label={t('كلمة المرور')} required hint={t('12 رمزاً على الأقل — ستُحفظ مشفّرة (Argon2).')}>
                {(id, isError) => <PasswordInput id={id} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required error={isError} />}
              </Field>
              <Field label={t('تأكيد كلمة المرور')} required>
                {(id, isError) => <PasswordInput id={id} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required error={isError || passwordMismatch} />}
              </Field>
              {passwordMismatch && <FormError error={new Error(t('كلمتا المرور غير متطابقتين.'))} />}
              <Button type="submit" variant="primary" disabled={!canContinue}>{t('متابعة إلى الرخصة')}</Button>
            </form>
          ) : (
            <form className="form auth-form" onSubmit={finish}>
              <Field label={t('مفتاح الرخصة (License Key)')} hint={t('الصق الرخصة الموقّعة التي استلمتها. اتركه فارغاً للتجربة المجانية 30 يوماً.')}>
                {(id) => (
                  <TextInput
                    id={id}
                    value={licenseToken}
                    onChange={(e) => setLicenseToken(e.target.value)}
                    placeholder={t('eyJsaWNlbnNlX2lkIjogLi4u')}
                    dir="ltr"
                  />
                )}
              </Field>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Button type="button" variant="ghost" onClick={() => setStep(1)}>{t('رجوع')}</Button>
                <Button type="submit" variant="primary" loading={loading}>
                  {licenseToken.trim() ? t('تفعيل وبدء الاستخدام') : t('بدء التجربة المجانية')}
                </Button>
              </div>
            </form>
          )}

          <FormError error={error} />
          <p className="auth-card__help" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={14} /> {t('بياناتك لا تغادر هذا الجهاز — المنظومة تعمل محلياً بالكامل.')}
          </p>
        </Glass>
      </section>

      <footer className="auth-page__footer">
        <span>زمام</span>
        <span>{t('أول تشغيل · رخصةoffline · عربي وإنجليزي')}</span>
      </footer>
    </main>
  );
}
