import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useTheme, useToast } from '../zimam-ui';
import { api, type HealthInfo, type AppUser } from '../lib/api';
import { useLang, toggleLang } from '../lib/i18n';
import {
  Bell,
  Settings,
  ChevronDown,
  Server,
  RefreshCw,
  Sparkles,
  Zap,
  ShieldAlert,
  Sun,
  Moon,
  Maximize,
  UserRound,
  Languages,
} from 'lucide-react';
import { t } from '../lib/i18n';

interface HeaderBarProps {
  isConnected: boolean;
  health: HealthInfo | null;
  currentUser: AppUser | null;
  hostname?: string;
  onRefresh: () => void;
  onOpenBroadcast: () => void;
  onOpenAiDiag: () => void;
  onOpenUserAccount: () => void;
}

export function HeaderBar({
  isConnected,
  health,
  currentUser,
  hostname,
  onRefresh,
  onOpenBroadcast,
  onOpenAiDiag,
  onOpenUserAccount,
}: HeaderBarProps) {
  const [theme, toggleTheme] = useTheme();
  const lang = useLang();
  const toast = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [trimming, setTrimming] = useState(false);
  const [elevating, setElevating] = useState(false);

  const handleTrim = async () => {
    setMenuOpen(false);
    setTrimming(true);
    try {
      const res = await api.trimGovernor();
      const reclaimed = res.reclaimed_mb ?? res.result?.reclaimed_mb ?? 0;
      toast(
        reclaimed > 0
          ? `${t('تم استرداد ')}${reclaimed}${t(' MB من ذاكرة الجلسات الخاملة بنجاح.')}`
          : t('السيرفر يعمل بكفاءة قصوى، لا توجد جلسات خاملة حالياً.'),
        'success',
      );
    } catch (err: any) {
      toast(err.message || t('فشل تفريغ الذاكرة'), 'error');
    } finally {
      setTrimming(false);
    }
  };

  const handleElevate = async () => {
    setMenuOpen(false);
    setElevating(true);
    try {
      const res = await api.requestElevation();
      toast(res.message || t('تم إرسال طلب الترقية، يرجى الموافقة في شاشة السيرفر.'), 'success');
    } catch (err: any) {
      toast(err.message || t('فشل الترقية'), 'error');
    } finally {
      setElevating(false);
    }
  };

  const toggleFullScreen = () => {
    setMenuOpen(false);
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const displayName = currentUser?.full_name || currentUser?.username || t('مدير النظام');
  const roleLabel = currentUser?.role === 'operator'
    ? t('مشغل عمليات')
    : currentUser?.role === 'viewer'
      ? t('مراجع')
      : t('مدير النظام');
  const initials = (currentUser?.full_name || currentUser?.username || 'A').trim().charAt(0).toUpperCase();

  return (
    <header className="site-header">
      <div className="header-inner">
        <NavLink to="/" className="header-brand header-brand--mobile" aria-label={t('زِمام - لوحة القيادة')}>
          <img className="header-brand__logo" src="/logo-light.png" alt="" width={36} height={36} />
          <span className="header-brand__text">
            <strong>ZIMAM</strong>
            <span>Server Control</span>
          </span>
        </NavLink>

        <div className="header-center">
          <NavLink
            to="/servers"
            className="server-select"
            title={hostname ? `${t('إدارة السيرفر ')}${hostname}` : t('إدارة السيرفرات')}
          >
            <Server size={15} />
            <span className="server-select__name" dir="ltr">{hostname || 'SRV-LOCAL'}</span>
            <span className="server-select__meta">{health?.os_display ? 'Windows Server' : 'Server'}</span>
            <ChevronDown size={14} className="server-select__chev" />
          </NavLink>

          <span className={`conn-pill ${isConnected ? '' : 'conn-pill--off'}`}>
            <span className="conn-dot" />
            {isConnected ? t('متصل') : t('غير متصل')}
          </span>
        </div>

        <div className="header-actions">
          <div className="header-menu-wrap">
            <button
              type="button"
              className="header-icon-btn"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label={t('إعدادات سريعة')}
              aria-expanded={menuOpen}
              title={t('إعدادات سريعة')}
            >
              <Settings size={18} />
            </button>

            {menuOpen && (
              <>
                <button
                  type="button"
                  className="header-menu-backdrop"
                  aria-label={t('إغلاق القائمة')}
                  onClick={() => setMenuOpen(false)}
                />
                <div className="header-menu" role="menu">
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onRefresh(); }}>
                    <RefreshCw size={15} /> {t('تحديث البيانات الآن')}
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onOpenAiDiag(); }}>
                    <Sparkles size={15} /> {t('رادار الذكاء الاصطناعي')}
                  </button>
                  <button type="button" role="menuitem" onClick={handleTrim} disabled={trimming}>
                    <Zap size={15} /> {trimming ? t('جارٍ تفريغ الذاكرة…') : t('تفريغ ذاكرة الجلسات الخاملة')}
                  </button>
                  {health && !health.is_admin && (
                    <button type="button" role="menuitem" onClick={handleElevate} disabled={elevating}>
                      <ShieldAlert size={15} /> {elevating ? t('جارٍ طلب الترقية…') : t('ترقية السيرفر كمسؤول')}
                    </button>
                  )}
                  <div className="header-menu__sep" />
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); toggleTheme(); }}>
                    {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                    {theme === 'dark' ? t('الوضع النهاري') : t('الوضع الليلي')}
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); toggleLang(); }}>
                    <Languages size={15} /> {lang === 'ar' ? 'English' : 'العربية'}
                  </button>
                  <button type="button" role="menuitem" onClick={toggleFullScreen}>
                    <Maximize size={15} /> {t('ملء الشاشة')}
                  </button>
                  <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onOpenUserAccount(); }}>
                    <UserRound size={15} /> {t('حساب المستخدم والصلاحيات')}
                  </button>
                </div>
              </>
            )}
          </div>

          <button
            type="button"
            className="header-icon-btn"
            onClick={onOpenBroadcast}
            aria-label={t('التنبيهات والبث الإداري')}
            title={t('التنبيهات والبث الإداري')}
          >
            <Bell size={18} />
            <span className="header-icon-btn__badge">3</span>
          </button>

          <button
            type="button"
            className="header-user"
            onClick={onOpenUserAccount}
            aria-label={`${t('إدارة الحساب: ')}${displayName} (${roleLabel})`}
            title={t('حساب المستخدم')}
          >
            <span className="header-user__meta">
              <strong>{displayName}</strong>
              <span>{roleLabel}</span>
            </span>
            <span className="header-user__avatar">{initials || <UserRound size={15} />}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
