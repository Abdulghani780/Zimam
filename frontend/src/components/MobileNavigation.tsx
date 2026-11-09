/**
 * ASAAS Server Control v2 - Mobile Navigation & Bottom TabBar.
 * Implements Stitch Screen _10 mobile ergonomics with glassmorphism and slide-over menu.
 */

import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Cpu,
  ShieldCheck,
  Radio,
  Menu,
  X,
  HardDrive,
  Users,
  KeyRound,
  ShieldAlert,
  ScrollText,
  Settings,
  Server,
  User,
  Shield,
  Film,
  Sparkles,
  Lock,
} from 'lucide-react';

interface MobileNavigationProps {
  isAdmin?: boolean;
}

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
      {/* Mobile Fixed Bottom TabBar (Visible <= 900px) */}
      <nav className="mobile-tabbar" aria-label="شريط التنقل السفلي للجوال">
        <NavLink
          to="/"
          end
          onClick={closeDrawer}
          className={({ isActive }) => `mobile-tabbar__item ${isActive ? 'active' : ''}`}
        >
          <LayoutDashboard size={20} />
          <span>الرئيسية</span>
        </NavLink>

        <NavLink
          to="/control"
          onClick={closeDrawer}
          className={({ isActive }) => `mobile-tabbar__item ${isActive ? 'active' : ''}`}
        >
          <Cpu size={20} />
          <span>الحاكم</span>
        </NavLink>

        <NavLink
          to="/security"
          onClick={closeDrawer}
          className={({ isActive }) => `mobile-tabbar__item ${isActive ? 'active' : ''}`}
        >
          <ShieldCheck size={20} />
          <span>الأمان</span>
        </NavLink>

        <NavLink
          to="/ports"
          onClick={closeDrawer}
          className={({ isActive }) => `mobile-tabbar__item ${isActive ? 'active' : ''}`}
        >
          <Radio size={20} />
          <span>المنافذ</span>
        </NavLink>

        <NavLink
          to="/users"
          onClick={closeDrawer}
          className={({ isActive }) => `mobile-tabbar__item ${isActive ? 'active' : ''}`}
        >
          <Users size={20} />
          <span>المستخدمين</span>
        </NavLink>

        <button
          type="button"
          onClick={() => setDrawerOpen(!drawerOpen)}
          className={`mobile-tabbar__item ${drawerOpen ? 'active' : ''}`}
          style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}
          aria-label="المزيد من القوائم"
        >
          {drawerOpen ? <X size={20} /> : <Menu size={20} />}
          <span>المزيد</span>
        </button>
      </nav>

      {/* Slide-over Full Mobile Navigation Drawer */}
      {drawerOpen && (
        <div className="mobile-drawer-backdrop" onClick={closeDrawer}>
          <div
            className="mobile-drawer"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="قائمة التنقل الموسعة"
          >
            {/* Drawer Header */}
            <div className="mobile-drawer__header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <img
                  src="/logo-light.png"
                  alt=""
                  width="28"
                  height="28"
                  style={{ objectFit: 'contain' }}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <div>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>ASAAS أساس</span>
                  <span style={{ fontSize: 10, color: 'var(--text-3)', display: 'block' }}>SERVER CONTROL v2.5</span>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="mobile-drawer__close"
                aria-label="إغلاق القائمة"
              >
                <X size={20} />
              </button>
            </div>

            {/* User Status Bar */}
            <div className="mobile-drawer__user">
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--primary-container)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
                <User size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>Administrator</span>
                <span style={{ fontSize: 11, color: isAdmin ? 'var(--paid)' : 'var(--accent)', display: 'block' }}>
                  {isAdmin ? 'صلاحيات مسؤول كاملة (Elevated)' : 'مستخدم قياسي (غير مرفع)'}
                </span>
              </div>
            </div>

            {/* Links Grid */}
            <div className="mobile-drawer__nav">
              <span className="mobile-drawer__section-title">إدارة الأصول والخوادم</span>
              <NavLink to="/assets" onClick={closeDrawer} className="mobile-drawer__link">
                <Server size={18} />
                <span>دليل الأصول والخوادم</span>
              </NavLink>
              <NavLink to="/vault" onClick={closeDrawer} className="mobile-drawer__link">
                <KeyRound size={18} />
                <span>خزنة الحسابات المشفرة</span>
              </NavLink>

              <span className="mobile-drawer__section-title">الأمان والشبكة</span>
              <NavLink to="/security" onClick={closeDrawer} className="mobile-drawer__link">
                <ShieldAlert size={18} />
                <span>مركز الدفاع والأمان (Fail2Ban)</span>
              </NavLink>
              <NavLink to="/ports" onClick={closeDrawer} className="mobile-drawer__link">
                <Radio size={18} />
                <span>درع عزل المنافذ PORT-GUARD</span>
              </NavLink>

              <span className="mobile-drawer__section-title">النظام والامتثال</span>
              <NavLink to="/storage" onClick={closeDrawer} className="mobile-drawer__link">
                <HardDrive size={18} />
                <span>إدارة التخزين وفك الملفات</span>
              </NavLink>
              <NavLink to="/users" onClick={closeDrawer} className="mobile-drawer__link">
                <Users size={18} />
                <span>حوكمة المستخدمين وجلسات RDP</span>
              </NavLink>
              <NavLink to="/audit" onClick={closeDrawer} className="mobile-drawer__link">
                <ScrollText size={18} />
                <span>سجل التدقيق والامتثال الجنائي</span>
              </NavLink>
              <NavLink to="/settings" onClick={closeDrawer} className="mobile-drawer__link">
                <Settings size={18} />
                <span>إعدادات النظام والإنذارات</span>
              </NavLink>

              <span className="mobile-drawer__section-title">البوابات السيادية والامتيازات</span>
              <NavLink to="/jit" onClick={closeDrawer} className="mobile-drawer__link">
                <Shield size={18} />
                <span>ترقية الصلاحيات JIT v2.5</span>
              </NavLink>
              <NavLink to="/replay" onClick={closeDrawer} className="mobile-drawer__link">
                <Film size={18} />
                <span>التحقيق واسترجاع الجلسات</span>
              </NavLink>
              <NavLink to="/login" onClick={closeDrawer} className="mobile-drawer__link">
                <Lock size={18} />
                <span>بوابة الدخول Zero-Trust SSO</span>
              </NavLink>
              <NavLink to="/lockout" onClick={closeDrawer} className="mobile-drawer__link">
                <ShieldAlert size={18} />
                <span>درع المحيط Perimeter Lockout</span>
              </NavLink>
              <NavLink to="/gallery" onClick={closeDrawer} className="mobile-drawer__link">
                <Sparkles size={18} />
                <span>معرض واجهات Stitch (20)</span>
              </NavLink>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
