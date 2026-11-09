import { useState } from 'react';
import { useTheme, Button, useToast } from '../asaas-ui';
import { api, type HealthInfo, type AppUser } from '../lib/api';
import { RefreshCw, Megaphone, Zap, ShieldAlert, Sun, Moon, Maximize, CheckCircle2, AlertCircle, UserCheck } from 'lucide-react';

interface HeaderBarProps {
  isConnected: boolean;
  health: HealthInfo | null;
  currentUser: AppUser | null;
  onRefresh: () => void;
  onOpenBroadcast: () => void;
  onOpenAiDiag: () => void;
  onOpenUserAccount: () => void;
}

export function HeaderBar({
  isConnected,
  health,
  currentUser,
  onRefresh,
  onOpenBroadcast,
  onOpenAiDiag,
  onOpenUserAccount,
}: HeaderBarProps) {
  const [theme, toggleTheme] = useTheme();
  const toast = useToast();
  const [trimming, setTrimming] = useState(false);
  const [elevating, setElevating] = useState(false);

  const handleTrim = async () => {
    setTrimming(true);
    try {
      const res = await api.trimGovernor();
      const reclaimed = res.result?.reclaimed_mb || 0;
      toast(reclaimed > 0 ? `تم استرداد ${reclaimed} MB من ذاكرة الجلسات الخاملة بنجاح.` : 'السيرفر يعمل بكفاءة قصوى، لا توجد جلسات خاملة حالياً.', 'success');
    } catch (err: any) {
      toast(err.message || 'فشل تفريغ الذاكرة', 'error');
    } finally {
      setTrimming(false);
    }
  };

  const handleElevate = async () => {
    setElevating(true);
    try {
      const res = await api.requestElevation();
      toast(res.message || 'تم إرسال طلب الترقية، يرجى الموافقة في شاشة السيرفر.', 'success');
    } catch (err: any) {
      toast(err.message || 'فشل الترقية', 'error');
    } finally {
      setElevating(false);
    }
  };

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const roleColor = currentUser?.role === 'admin' ? '#22c55e' : currentUser?.role === 'operator' ? 'var(--accent, #d4a017)' : '#3b82f6';
  const roleLabel = currentUser?.role === 'admin' ? 'مدير النظام (Admin)' : currentUser?.role === 'operator' ? 'مشغل (Operator)' : 'مراجع (Viewer)';

  return (
    <header
      className="site-header"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: '#0e0d0d',
        borderBottom: '1px solid rgba(212, 160, 23, 0.25)',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.85)',
        width: '100%',
      }}
    >
      <div
        className="header-inner"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
          padding: '10px 24px',
          maxWidth: 1600,
          margin: '0 auto',
          width: '100%',
          boxSizing: 'border-box',
          flexWrap: 'wrap',
          backgroundColor: '#0e0d0d',
        }}
      >
        {/* Status Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div
            className={`badge ${isConnected ? 'badge--success' : 'badge--danger'}`}
            style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
          >
            {isConnected ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
            <span>{isConnected ? 'متصل مباشر (Live SSE)' : 'جارٍ الاتصال بالسيرفر...'}</span>
          </div>

          <div
            className="badge badge--accent"
            style={{ display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
          >
            <span>{health?.os_display || 'Windows Server 2025'}</span>
          </div>

          <button
            type="button"
            onClick={onOpenAiDiag}
            className="badge badge--warning hover:brightness-110 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary cursor-pointer select-none"
            style={{
              border: '1px solid rgba(212, 160, 23, 0.4)',
              background: 'rgba(212, 160, 23, 0.12)',
              color: '#d4a017',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
            aria-label="فتح رادار الذكاء الاصطناعي لتشخيص المنظومة"
          >
            <span>رادار الذكاء الاصطناعي (AI Ops)</span>
          </button>
        </div>

        {/* Action Cluster */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* User Account / Role Switcher Pill */}
          <button
            type="button"
            onClick={onOpenUserAccount}
            aria-label={`تغيير المستخدم والدور: ${currentUser?.username || 'Administrator'} (${roleLabel})`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: '9999px',
              background: 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${roleColor}`,
              color: '#f0ede6',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
            className="hover:bg-surface-glass-tint active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary"
          >
            <UserCheck size={14} color={roleColor} />
            <span>{currentUser?.username || 'Administrator'}</span>
            <span
              style={{
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 4,
                background: roleColor,
                color: '#000',
                fontWeight: 700,
              }}
            >
              {roleLabel}
            </span>
          </button>

          <Button
            size="sm"
            variant="ghost"
            onClick={onRefresh}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
          >
            <RefreshCw size={14} />
            <span>تحديث</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={onOpenBroadcast}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
          >
            <Megaphone size={14} />
            <span>تنبيه</span>
          </Button>

          <Button
            size="sm"
            variant="glass"
            loading={trimming}
            onClick={handleTrim}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--accent, #d4a017)', whiteSpace: 'nowrap' }}
          >
            <Zap size={14} />
            <span>تفريغ الخمول</span>
          </Button>

          {health && !health.is_admin && (
            <Button
              size="sm"
              variant="primary"
              loading={elevating}
              onClick={handleElevate}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}
            >
              <ShieldAlert size={14} />
              <span>ترقية كمسؤول</span>
            </Button>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={toggleTheme}
            style={{ padding: '6px 10px' }}
            label={theme === 'dark' ? 'الوضع النهاري' : 'الوضع الليلي'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={toggleFullScreen}
            style={{ padding: '6px 10px' }}
            label="ملء الشاشة"
          >
            <Maximize size={16} />
          </Button>
        </div>
      </div>
    </header>
  );
}
