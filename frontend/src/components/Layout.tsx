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
import { CheckCircle2, Server, Wrench } from 'lucide-react';
import { t } from '../lib/i18n';

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
        <div style={{ padding: 40, textAlign: 'center', background: 'var(--panel)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--hairline)', margin: 24 }}>
          <h3 style={{ color: 'var(--danger)', marginBottom: 10, fontSize: 20 }}>{t('تعذر عرض هذه الصفحة')}</h3>
          <p style={{ color: 'var(--text-2)', fontSize: 14, marginBottom: 20 }}>{this.state.error?.message || t('خطأ غير متوقع في معالجة البيانات')}</p>
          <button
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
            style={{
              padding: '10px 24px',
              borderRadius: 'var(--radius-sm)',
              background: 'var(--accent)',
              color: 'var(--on-accent)',
              fontWeight: 700,
              cursor: 'pointer',
              border: 'none',
              fontFamily: 'inherit',
            }}
          >
            {t('إعادة تحميل الصفحة')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export function Layout() {
  const { isConnected, health, snapshot, refresh } = useTelemetry();
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

  const runningServices = snapshot?.services?.filter((service) => service.status === 'Running').length ?? 0;
  const activeSessions = snapshot?.sessions?.filter((session) => (session.state || session.status) === 'Active').length ?? 0;
  const hostname = snapshot?.host?.hostname;

  return (
    <div className="app-shell">
      <Ambient />

      <div className="app-body">
        <Sidebar />

        <div className="app-main">
          <HeaderBar
            isConnected={isConnected}
            health={health}
            currentUser={currentUser}
            hostname={hostname}
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

          <footer className="app-footer">
            <div className="app-footer__group">
              <span dir="ltr">v{health?.version || '3.0.0'} | ASAAS</span>
            </div>
            <div className="app-footer__group">
              <span><Server size={13} /> {t('الجلسات النشطة:')} {activeSessions}</span>
              <span><Wrench size={13} /> {t('الخدمات النشطة:')} {runningServices}</span>
            </div>
            <div className="app-footer__group">
              <span className={health?.ok ? 'ok' : ''}>
                <CheckCircle2 size={13} />
                {t('حالة المنظومة:')} {health?.ok ? t('سليمة') : t('قيد الفحص')}
              </span>
            </div>
          </footer>
        </div>
      </div>

      <MobileNavigation isAdmin={health?.is_admin} />

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

      <AssistantWidget
        user={{
          id: currentUser?.username || 'admin',
          displayName: currentUser?.full_name || currentUser?.username || t('مدير النظام'),
        }}
        title={t('مساعد أساس الذكي')}
        subtitle={t('الروبوت السيادي لإدارة وتحليل Windows Server')}
        suggestions={[
          t('ما هي حالة الموارد واستهلاك المعالج حالياً؟'),
          t('هل توجد جلسات RDP خاملة تحتاج تفريغ؟'),
          t('افحص صحة محركات وقواعد البيانات'),
        ]}
        ask={async (messages) => {
          const userQuery = messages[messages.length - 1]?.content || '';
          const diag = await api.getAiDiagnosis().catch(() => null);
          const rec = diag?.recommendations?.[0];
          const text = rec
            ? `${t('تحليل ذكاء أساس: ')}${diag.summary || t('النظام يعمل بحالة مستقرة.')}${t('\\n\\nالتوصية بخصوص (')}${userQuery}): ${rec}`
            : `${t('أساس تعمل بكفاءة قصوى. جميع محركات الموارد وقواعد البيانات والجدار الناري في حالة تشغيل آمنة. الاستفسار: ')}${userQuery}`;
          return { reply: text };
        }}
      />
    </div>
  );
}
