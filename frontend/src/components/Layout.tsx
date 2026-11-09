import { useState, useEffect, Component, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { HeaderBar } from './HeaderBar';
import { MobileNavigation } from './MobileNavigation';
import { BroadcastModal } from './BroadcastModal';
import { AiDiagModal } from './AiDiagModal';
import { UserAccountModal } from './UserAccountModal';
import { useTelemetry } from '../lib/useTelemetry';
import { api, type AppUser } from '../lib/api';

class PageErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error?: Error }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: 'center', background: 'var(--glass-tint)', borderRadius: 'var(--radius-md)', border: '1px solid var(--hairline)', margin: 24 }}>
          <h3 style={{ color: 'var(--danger)', marginBottom: 10, fontSize: 20 }}>تعذر عرض هذه الصفحة</h3>
          <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 20 }}>{this.state.error?.message || 'خطأ غير متوقع في معالجة البيانات'}</p>
          <button
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
            style={{
              padding: '10px 24px',
              borderRadius: 'var(--radius-pill)',
              background: 'var(--accent)',
              color: '#000',
              fontWeight: 700,
              cursor: 'pointer',
              border: 'none',
              fontFamily: 'inherit'
            }}
          >
            إعادة تحميل الصفحة
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function Layout() {
  const { isConnected, health, refresh } = useTelemetry();
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [aiDiagOpen, setAiDiagOpen] = useState(false);
  const [userAccountOpen, setUserAccountOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('asaas_user_profile');
      if (saved) {
        try { return JSON.parse(saved); } catch { /* ignore */ }
      }
    }
    return {
      id: 1,
      username: 'admin',
      role: 'admin',
      full_name: 'مدير النظام (Administrator)',
      is_active: true,
      created_at: '',
    };
  });

  useEffect(() => {
    api.getCurrentUser()
      .then((res) => {
        if (res.ok && res.user) {
          setCurrentUser(res.user);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="app-layout">
      {/* Sidebar Navigation */}
      <Sidebar
        isAdmin={health?.is_admin}
        currentUser={currentUser}
        onOpenUserAccount={() => setUserAccountOpen(true)}
      />

      {/* Main Content Area */}
      <div className="app-main">
        <HeaderBar
          isConnected={isConnected}
          health={health}
          currentUser={currentUser}
          onRefresh={refresh}
          onOpenBroadcast={() => setBroadcastOpen(true)}
          onOpenAiDiag={() => setAiDiagOpen(true)}
          onOpenUserAccount={() => setUserAccountOpen(true)}
        />

        <main className="page-container">
          <PageErrorBoundary>
            <Outlet />
          </PageErrorBoundary>
        </main>
      </div>

      {/* Mobile Navigation Bar & Drawer */}
      <MobileNavigation isAdmin={health?.is_admin} />

      {/* Modals & AI Ops */}
      <BroadcastModal
        open={broadcastOpen}
        onClose={() => setBroadcastOpen(false)}
      />

      <AiDiagModal
        open={aiDiagOpen}
        onClose={() => setAiDiagOpen(false)}
      />

      <UserAccountModal
        open={userAccountOpen}
        onClose={() => setUserAccountOpen(false)}
        currentUser={currentUser}
        onUserChanged={(user) => {
          setCurrentUser(user);
          refresh();
        }}
      />
    </div>
  );
}
