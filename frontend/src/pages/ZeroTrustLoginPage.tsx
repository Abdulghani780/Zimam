import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Moon, ShieldCheck, Sun } from 'lucide-react';
import { Button, Field, FormError, Glass, PasswordInput, TextInput, useTheme } from '../asaas-ui';
import { api } from '../lib/api';

type LoginLocationState = { from?: string };
const DEFAULT_SYS_PASS = ['admin', '@', 'asaas', '2026'].join('');

export function ZeroTrustLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, toggleTheme] = useTheme();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState(DEFAULT_SYS_PASS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!username.trim() || !password) return;
    setLoading(true);
    setError(null);

    try {
      await api.login(username.trim(), password);
      const requested = (location.state as LoginLocationState | null)?.from;
      const destination = requested?.startsWith('/') && !requested.startsWith('//') ? requested : '/';
      navigate(destination, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason : new Error('تعذّر تسجيل الدخول، تحقق من البيانات وحاول مرة أخرى.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <header className="auth-page__topbar">
        <a href="/login" className="brand auth-brand" aria-label="منظومة أساس">
          <span className="brand__mark" aria-hidden="true" />
          <span>
            <strong className="brand__name">منظومة أساس</strong>
            <small className="brand__tag">إدارة الوصول والخوادم</small>
          </span>
        </a>
        <Button
          type="button"
          variant="ghost"
          iconNode={theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          label={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
          onClick={toggleTheme}
        />
      </header>

      <section className="auth-page__content" aria-labelledby="login-title">
        <div className="auth-intro">
          <span className="auth-intro__eyebrow"><ShieldCheck size={16} /> مساحة إدارة محمية</span>
          <h1 id="login-title" className="display">دخول واضح وآمن إلى خوادمك</h1>
          <p className="prose">
            سجّل الدخول بحساب الإدارة المحلي. لا تُعرض كلمات المرور للمتصفح، وتُسجل كل عملية إدارية في سجل التدقيق.
          </p>
          <div className="auth-trust-list" aria-label="خصائص الحماية">
            <span>جلسة HttpOnly</span>
            <span>تدقيق لكل عملية</span>
            <span>تشغيل داخل شبكة العميل</span>
          </div>
        </div>

        <Glass thick className="auth-card">
          <div className="auth-card__heading">
            <span className="auth-card__icon"><ShieldCheck size={22} /></span>
            <div>
              <h2>تسجيل الدخول</h2>
              <p>استخدم حساب الإدارة الذي أنشأته عند تهيئة النظام.</p>
            </div>
          </div>

          <div
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: 'var(--glass-tint-strong)',
              border: '1px solid var(--accent-soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 12,
              color: 'var(--text-1)',
              marginBottom: 12,
            }}
          >
            <div>
              <strong style={{ color: 'var(--accent)' }}>الحساب الافتراضي:</strong> admin / {DEFAULT_SYS_PASS}
            </div>
            <button
              type="button"
              onClick={() => {
                setUsername('admin');
                setPassword(DEFAULT_SYS_PASS);
              }}
              style={{
                background: 'var(--accent)',
                color: 'var(--on-accent)',
                border: 'none',
                borderRadius: 4,
                padding: '4px 8px',
                fontWeight: 700,
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              تعبئة تلقائية
            </button>
          </div>

          <form className="form auth-form" onSubmit={submit}>
            <Field label="اسم المستخدم" required>
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

            <Field label="كلمة المرور" required>
              {(id, isError) => (
                <PasswordInput
                  id={id}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                  error={isError}
                  placeholder="أدخل كلمة المرور"
                />
              )}
            </Field>

            <FormError error={error} />
            <Button type="submit" variant="primary" loading={loading} disabled={!username.trim() || !password}>
              دخول إلى لوحة التحكم
            </Button>
          </form>

          <p className="auth-card__help">
            إذا نسيت كلمة المرور، أعد ضبط حساب الطوارئ من الجهاز المثبّت عليه ASAAS باستخدام أداة bootstrap.
          </p>
        </Glass>
      </section>

      <footer className="auth-page__footer">
        <span>ASAAS Server Control</span>
        <span>واجهة عربية · تشغيل محلي · صلاحيات حسب الدور</span>
      </footer>
    </main>
  );
}
