import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Languages, Moon, ShieldCheck, Sun } from 'lucide-react';
import { Button, Field, FormError, Glass, PasswordInput, Stretch, TextInput, useTheme } from '../asaas-ui';
import { api } from '../lib/api';
import { apiV1, ApiV1Error } from '../lib/apiV1';
import { useLang, toggleLang } from '../lib/i18n';
import { t } from '../lib/i18n';

type LoginLocationState = { from?: string };

export function ZeroTrustLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, toggleTheme] = useTheme();
  const lang = useLang();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [mfaRequired, setMfaRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!username.trim() || !password || (mfaRequired && !otp.trim())) return;
    setLoading(true);
    setError(null);

    try {
      // Prefer the control-plane session (/api/v1) when it is reachable; the
      // proxy bridges it to legacy endpoints. Fall back to the legacy login.
      try {
        await apiV1.login(username.trim(), password, mfaRequired ? otp.trim() : undefined);
        // The console still reads the local directory profile through the
        // bridge — surface a clear error if no matching local user exists.
        try {
          await api.getCurrentUser();
        } catch {
          throw new Error(t('تم التحقق من الحساب في طبقة التحكم، لكن لا يوجد ملف مطابق في الدليل المحلي. شغّل أداة bootstrap_admin.py لإنشاء حساب محلي بنفس الاسم.'));
        }
      } catch (v1Error) {
        if (v1Error instanceof ApiV1Error && v1Error.status === 401 && /mfa/i.test(v1Error.message)) {
          if (/mfa required/i.test(v1Error.message)) setMfaRequired(true);
          throw v1Error;
        }
        if (mfaRequired && v1Error instanceof ApiV1Error) {
          throw v1Error;
        }
        if (v1Error instanceof Error && v1Error.message.startsWith(t('تم التحقق'))) {
          throw v1Error;
        }
        await api.login(username.trim(), password);
      }
      const requested = (location.state as LoginLocationState | null)?.from;
      const destination = requested?.startsWith('/') && !requested.startsWith('//') ? requested : '/';
      navigate(destination, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason : new Error(t('تعذّر تسجيل الدخول، تحقق من البيانات وحاول مرة أخرى.')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <header className="auth-page__topbar">
        <a href="/login" className="brand auth-brand" aria-label={t('زمام')}>
          <span className="brand__mark" aria-hidden="true" />
          <span>
            <strong className="brand__name">{t('زمام')}</strong>
            <small className="brand__tag">{t('إدارة الوصول والخوادم')}</small>
          </span>
        </a>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            type="button"
            variant="ghost"
            iconNode={<Languages size={18} />}
            label={lang === 'ar' ? 'English' : 'العربية'}
            onClick={toggleLang}
          />
          <Button
            type="button"
            variant="ghost"
            iconNode={theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            label={theme === 'dark' ? t('الوضع النهاري') : t('الوضع الليلي')}
            onClick={toggleTheme}
          />
        </div>
      </header>

      <section className="auth-page__content" aria-labelledby="login-title">
        <div className="auth-intro">
          <span className="auth-intro__eyebrow"><ShieldCheck size={16} /> {t('مساحة إدارة محمية')}</span>
          <p className="auth-intro__greeting" aria-hidden="true">
            {new Date().getHours() < 12
              ? <><Stretch before={t('صب')} after={t('اح')} length={3} /> {t('الخير')}</>
              : <><Stretch before={t('مس')} after={t('اء')} length={3} /> {t('الخير')}</>}
          </p>
          <h1 id="login-title" className="display">{t('دخول واضح وآمن إلى خوادمك')}</h1>
          <p className="prose">
            {t('سجّل الدخول بحساب الإدارة المحلي. لا تُعرض كلمات المرور للمتصفح، وتُسجل كل عملية إدارية في سجل التدقيق.')}
          </p>
          <div className="auth-trust-list" aria-label={t('خصائص الحماية')}>
            <span>{t('جلسة HttpOnly')}</span>
            <span>{t('تدقيق لكل عملية')}</span>
            <span>{t('تشغيل داخل شبكة العميل')}</span>
          </div>
        </div>

        <Glass thick className="auth-card">
          <div className="auth-card__heading">
            <span className="auth-card__icon"><ShieldCheck size={22} /></span>
            <div>
              <h2>{t('تسجيل الدخول')}</h2>
              <p>{t('استخدم حساب الإدارة الذي أنشأته عند تهيئة النظام.')}</p>
            </div>
          </div>

          <form className="form auth-form" onSubmit={submit}>
            <Field label={t('اسم المستخدم')} required>
              {(id, isError) => (
                <TextInput
                  id={id}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  required
                  error={isError}
                  placeholder="admin"
                  dir="ltr"
                />
              )}
            </Field>

            <Field label={t('كلمة المرور')} required>
              {(id, isError) => (
                <PasswordInput
                  id={id}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  error={isError}
                  placeholder={t('أدخل كلمة المرور')}
                />
              )}
            </Field>

            {mfaRequired && (
              <Field label={t('رمز المصادقة الثنائية (OTP)')} required hint={t('أدخل الرمز المكوّن من 6 أرقام من تطبيق المصادقة.')}>
                {(id, isError) => (
                  <TextInput
                    id={id}
                    value={otp}
                    onChange={(event) => setOtp(event.target.value)}
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    required
                    error={isError}
                    dir="ltr"
                  />
                )}
              </Field>
            )}
            <FormError error={error} />
            <Button type="submit" variant="primary" loading={loading} disabled={!username.trim() || !password || (mfaRequired && !otp.trim())}>
              {t('دخول إلى لوحة التحكم')}
            </Button>
          </form>

          <p className="auth-card__help">
            {t('إذا نسيت كلمة المرور، أعد ضبط حساب الطوارئ من الجهاز المثبّت عليه ASAAS باستخدام أداة bootstrap.')}
          </p>
        </Glass>
      </section>

      <footer className="auth-page__footer">
        <span>زمام</span>
        <span>{t('واجهة عربية · تشغيل محلي · صلاحيات حسب الدور')}</span>
      </footer>
    </main>
  );
}
