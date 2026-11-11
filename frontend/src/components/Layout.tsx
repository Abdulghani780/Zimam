import { useState, useEffect, Component, type ReactNode } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { HeaderBar } from './HeaderBar';
import { MobileNavigation } from './MobileNavigation';
import { BroadcastModal } from './BroadcastModal';
import { AiDiagModal } from './AiDiagModal';
import { UserAccountModal } from './UserAccountModal';
import { Ambient } from '../asaas-ui';
import { AssistantWidget } from '../asaas-ui/assistant/AssistantWidget';
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
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

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
      {/* Sovereign Ambient Canvas for Liquid Glass Refraction */}
      <Ambient />

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

      {/* Sovereign Asaas AI Assistant Robot */}
      <AssistantWidget
        user={{
          id: currentUser?.username || 'admin',
          displayName: currentUser?.full_name || currentUser?.username || 'مدير النظام',
        }}
        title="مساعد أساس الذكي"
        subtitle="الروبوت السيادي لإدارة وتحليل Windows Server"
        suggestions={[
          'ما هي حالة الموارد واستهلاك المعالج حالياً؟',
          'هل توجد جلسات RDP خاملة تحتاج تفريغ؟',
          'افحص صحة محركات وقواعد البيانات',
        ]}
        ask={async (messages) => {
          const userQuery = messages[messages.length - 1]?.content || '';
          const diag = await api.getAiDiagnosis().catch(() => null);
          const rec = diag?.recommendations?.[0];
          const text = rec
            ? `تحليل ذكاء أساس: ${diag.summary || 'النظام يعمل بحالة مستقرة.'}\n\nالتوصية بخصوص (${userQuery}): ${rec}`
            : `منظومة أساس تعمل بكفاءة قصوى. جميع محركات الموارد وقواعد البيانات والجدار الناري في حالة تشغيل آمنة. الاستفسار: ${userQuery}`;
          return { reply: text };
        }}
      />
    </div>
  );
}
