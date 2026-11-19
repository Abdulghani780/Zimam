import { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Cpu, LayoutDashboard, Menu, Monitor, Shield, User, X } from 'lucide-react';
import { t } from '../lib/i18n';
import type { AppUser } from '../lib/api';
import { Brand } from './Brand';
import { NAV_GROUPS } from './navigation';

interface MobileNavigationProps {
  currentUser: AppUser | null;
  isElevated?: boolean;
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function MobileNavigation({ currentUser, isElevated }: MobileNavigationProps) {
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 900);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 900;
      setIsMobile(mobile);
      if (!mobile) setDrawerOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(drawerRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      menuRef.current?.focus();
    };
  }, [drawerOpen]);

  if (!isMobile) return null;

  const closeDrawer = () => setDrawerOpen(false);
  const displayName = currentUser?.full_name || currentUser?.username || t('مدير النظام');
  const roleLabel = currentUser?.role === 'operator'
    ? t('مشغل عمليات')
    : currentUser?.role === 'viewer'
      ? t('مراجع')
      : t('مدير النظام');

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
        <NavLink to="/security" onClick={closeDrawer} className={({ isActive }) => `mobile-tabbar__item ${isActive ? 'active' : ''}`}>
          <Shield size={20} />
          <span>{t('الحماية')}</span>
        </NavLink>
        <button
          ref={menuRef}
          type="button"
          onClick={() => setDrawerOpen((open) => !open)}
          className={`mobile-tabbar__item ${drawerOpen ? 'active' : ''}`}
          aria-label={t('المزيد من القوائم')}
          aria-expanded={drawerOpen}
          aria-controls="mobile-navigation-drawer"
        >
          {drawerOpen ? <X size={20} /> : <Menu size={20} />}
          <span>{t('المزيد')}</span>
        </button>
      </nav>

      {drawerOpen && (
        <div className="mobile-drawer-backdrop" onClick={closeDrawer}>
          <div
            ref={drawerRef}
            id="mobile-navigation-drawer"
            className="mobile-drawer"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={t('قائمة التنقل الموسعة')}
          >
            <div className="mobile-drawer__header">
              <Brand size={32} />
              <button ref={closeRef} type="button" onClick={closeDrawer} className="mobile-drawer__close" aria-label={t('إغلاق القائمة')}>
                <X size={20} />
              </button>
            </div>

            <div className="mobile-drawer__user">
              <span className="mobile-drawer__avatar"><User size={18} /></span>
              <span className="mobile-drawer__identity">
                <strong>{displayName}</strong>
                <small>{roleLabel} · {isElevated ? t('صلاحيات مسؤول كاملة') : t('مستخدم قياسي')}</small>
              </span>
            </div>

            <nav className="mobile-drawer__nav" aria-label={t('جميع أقسام المنظومة')}>
              {NAV_GROUPS.map((group) => (
                <section className="mobile-drawer__group" key={group.label}>
                  <h2 className="mobile-drawer__section-title">{t(group.label)}</h2>
                  {group.items.map(({ to, label, icon: Icon, end }) => (
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
                </section>
              ))}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
