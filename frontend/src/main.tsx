import './asaas-ui/styles/index.css';
import './styles/app.css';
import { StrictMode, Component, useEffect, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider, Ambient } from './asaas-ui';
import { useLang } from './lib/i18n';
import App from './App';

/** Applies lang/dir to <html> and remounts the tree on language switch so
 *  every t() call re-evaluates against the new dictionary. */
function LangRoot({ children }: { children: ReactNode }) {
  const lang = useLang();
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);
  return <div key={lang} style={{ display: 'contents' }}>{children}</div>;
}

class GlobalErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error?: Error }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ASAAS Critical Runtime Error caught by GlobalErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg)',
          color: 'var(--text)',
          fontFamily: 'var(--font)',
          direction: 'rtl',
          padding: 24,
        }}>
          <div style={{
            maxWidth: 520,
            width: '100%',
            background: 'var(--surface-glass)',
            border: '1px solid var(--glass-rim)',
            borderRadius: 'var(--radius-lg)',
            padding: 32,
            boxShadow: 'var(--glass-shadow)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🛡️</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px', color: 'var(--status-danger)' }}>
              تعذّر تحميل واجهة أساس
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.6, margin: '0 0 20px' }}>
              حدث خطأ غير متوقع أثناء تحميل لوحة التحكم. أعد المحاولة للعودة إلى مساحة العمل.
            </p>
            <div style={{
              background: 'var(--glass-inset)',
              padding: 12,
              borderRadius: 8,
              fontSize: 12,
              fontFamily: 'monospace',
              color: 'var(--accent)',
              textAlign: 'left',
              direction: 'ltr',
              marginBottom: 24,
              overflowX: 'auto',
              maxHeight: 120,
            }}>
              {this.state.error?.message || 'Unknown runtime error'}
            </div>
            <button
              onClick={() => {
                window.location.reload();
              }}
              className="btn btn--primary"
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <Ambient />
          <LangRoot>
            <App />
          </LangRoot>
        </ToastProvider>
      </BrowserRouter>
    </GlobalErrorBoundary>
  </StrictMode>
);
