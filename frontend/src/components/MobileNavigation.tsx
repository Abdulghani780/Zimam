import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Server,
  Cpu,
  Monitor,
  ShieldCheck,
  Network,
  Settings2,
  Shield,
  Wifi,
  Users,
  ScrollText,
  Settings,
  Menu,
  X,
  User,
  Code2,
  Container,
  Database,
  Vault,
  HardDrive,
  Timer,
  History,
  Globe,
  Bot,
} from 'lucide-react';
import { t } from '../lib/i18n';

interface MobileNavigationProps {
  isAdmin?: boolean;
}

const DRAWER_LINKS = [
  { to: '/', label: 'لوحة القيادة', icon: LayoutDashboard, end: true },
  { to: '/servers', label: 'إدارة السيرفرات', icon: Server },
  { to: '/governor', label: 'حاكم الموارد', icon: Cpu },
  { to: '/control', label: 'جلسات سطح المكتب (RDP)', icon: Monitor },
  { to: '/bastion', label: 'بوابة الوصول الآمن (PAM)', icon: ShieldCheck },
  { to: '/ports', label: 'عزل المنافذ', icon: Network },
  { to: '/infrastructure', label: 'إدارة العمليات والخدمات', icon: Settings2 },
  { to: '/development', label: 'مساحات المطورين', icon: Code2 },
  { to: '/containers', label: 'الحاويات', icon: Container },
  { to: '/databases', label: 'قواعد البيانات', icon: Database },
  { to: '/assets', label: 'الأصول والعناوين', icon: Globe },
  { to: '/vault', label: 'الخزنة الآمنة', icon: Vault },
  { to: '/agents', label: 'وكلاء الأصول', icon: Bot },
  { to: '/storage', label: 'التحكم بالتخزين', icon: HardDrive },
  { to: '/security', label: 'مركز الحماية', icon: Shield },
  { to: '/network-storage', label: 'مراقبة الشبكة', icon: Wifi },
  { to: '/users', label: 'المستخدمون والصلاحيات', icon: Users },
  { to: '/jit', label: 'الترقية المؤقتة (JIT)', icon: Timer },
  { to: '/replay', label: 'إعادة تشغيل الجلسات', icon: History },
  { to: '/audit', label: 'السجلات والتدقيق', icon: ScrollText },
  { to: '/settings', label: 'إعدادات المنظومة', icon: Settings },
];

export function MobileNavigation({ isAdmin }: MobileNavigationProps) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 900);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 900);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isMobile) {
    return null;
  }

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <>
      <nav className="mobile-tabbar" aria-label={t('شريط التنقل السفلي للجوال')}>
        <NavLink to="/" end onClick={closeDrawer} className={({ isActive }) => `mobile-tabbar__item ${isActive ? 'active' : ''}`}>
          <LayoutDashboard size={20} />
          <span>{t('الرئيسية')}</span>
        </NavLink>

        <NavLink to="/control" onClick={closeDrawer} className={({ isActive }) => `mobile-tabbar__item ${isActive ? 'active' : ''}`}>
          <Monitor size={20} />
          <span>{t('الجلسات')}</span>
        </NavLink>

        <NavLink to="/governor" onClick={closeDrawer} className={({ isActive }) => `mobile-tabbar__item ${isActive ? 'active' : ''}`}>
          <Cpu size={20} />
          <span>{t('الموارد')}</span>
        </NavLink>

        <NavLink to="/ports" onClick={closeDrawer} className={({ isActive }) => `mobile-tabbar__item ${isActive ? 'active' : ''}`}>
          <Network size={20} />
          <span>{t('المنافذ')}</span>
        </NavLink>

        <NavLink to="/security" onClick={closeDrawer} className={({ isActive }) => `mobile-tabbar__item ${isActive ? 'active' : ''}`}>
          <Shield size={20} />
          <span>{t('الحماية')}</span>
        </NavLink>

        <button
          type="button"
          onClick={() => setDrawerOpen(!drawerOpen)}
          className={`mobile-tabbar__item ${drawerOpen ? 'active' : ''}`}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
          aria-label={t('المزيد من القوائم')}
        >
          {drawerOpen ? <X size={20} /> : <Menu size={20} />}
          <span>{t('المزيد')}</span>
        </button>
      </nav>

      {drawerOpen && (
        <div className="mobile-drawer-backdrop" onClick={closeDrawer}>
          <div
            className="mobile-drawer"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t('قائمة التنقل الموسعة')}
          >
            <div className="mobile-drawer__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src="/logo-light.png" alt="" width="28" height="28" style={{ objectFit: 'contain' }} />
                <div>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>ASAAS</span>
                  <span style={{ fontSize: 10, color: 'var(--text-3)', display: 'block' }}>{t('بوابة التحكم الآمن')}</span>
                </div>
              </div>
              <button type="button" onClick={closeDrawer} className="mobile-drawer__close" aria-label={t('إغلاق القائمة')}>
                <X size={20} />
              </button>
            </div>

            <div className="mobile-drawer__user">
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--accent-fill)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--on-accent)' }}>
                <User size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Administrator</span>
                <span style={{ fontSize: 11, color: isAdmin ? 'var(--paid)' : 'var(--accent)', display: 'block' }}>
                  {isAdmin ? t('صلاحيات مسؤول كاملة') : t('مستخدم قياسي')}
                </span>
              </div>
            </div>

            <div className="mobile-drawer__nav">
              {DRAWER_LINKS.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  onClick={closeDrawer}
                  className={({ isActive }) => `mobile-drawer__link ${isActive ? 'active' : ''}`}
                >
                  <Icon size={18} />
                  <span>{t(label)}</span>
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
