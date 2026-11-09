import './asaas-ui/styles/index.css';
import './styles/app.css';
import { StrictMode, Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider, Ambient } from './asaas-ui';
import App from './App';

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
          backgroundColor: '#0c0c0e',
          color: '#f0ede6',
          fontFamily: "'Segoe UI', Tahoma, Arial, sans-serif",
          direction: 'rtl',
          padding: 24,
        }}>
          <div style={{
            maxWidth: 520,
            width: '100%',
            background: 'rgba(25, 23, 22, 0.95)',
            border: '1px solid rgba(212, 160, 23, 0.3)',
            borderRadius: 16,
            padding: 32,
            boxShadow: '0 20px 40px rgba(0,0,0,0.8)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🛡️</div>
            <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 10px', color: '#ff5c5c' }}>
              تم استرداد المنظومة وتفادي الشاشة السوداء
            </h2>
            <p style={{ fontSize: 14, color: '#aaa396', lineHeight: 1.6, margin: '0 0 20px' }}>
              حدث استثناء برمجي غير متوقع في معالجة واجهة السيرفر. درع الاستقرار منع انهيار التطبيق.
            </p>
            <div style={{
              background: 'rgba(0,0,0,0.5)',
              padding: 12,
              borderRadius: 8,
              fontSize: 12,
              fontFamily: 'monospace',
              color: '#d4a017',
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
                localStorage.removeItem('asaas_session_token');
                window.location.href = '/';
              }}
              style={{
                background: '#d4a017',
                color: '#000',
                border: 'none',
                padding: '12px 28px',
                borderRadius: 24,
                fontSize: 14,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              إعادة تحميل المنظومة وتحديث الجلسة
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
          <App />
        </ToastProvider>
      </BrowserRouter>
    </GlobalErrorBoundary>
  </StrictMode>
);
