import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Cpu,
  Server,
  KeyRound,
  Radio,
  ShieldAlert,
  HardDrive,
  Users,
  ScrollText,
  Settings,
  Shield,
  Film,
  Sparkles,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import type { AppUser } from '../lib/api';

interface SidebarProps {
  isAdmin?: boolean;
  currentUser?: AppUser | null;
  onOpenUserAccount?: () => void;
}

export function Sidebar({ isAdmin, currentUser, onOpenUserAccount }: SidebarProps) {
  const roleColor = currentUser?.role === 'admin' ? '#22c55e' : currentUser?.role === 'operator' ? 'var(--accent)' : '#3b82f6';
  const roleBadge = currentUser?.role ? currentUser.role.toUpperCase() : (isAdmin ? 'ROOT' : 'USER');
  const roleTitle = currentUser?.role === 'admin' ? 'مدير نظام كامل' : currentUser?.role === 'operator' ? 'مشغل عمليات' : 'قراءة وتدقيق فقط';

  return (
    <aside className="app-sidebar" aria-label="شريط التنقل الجانبي">
      {/* Brand Header */}
      <NavLink
        to="/"
        className="sidebar-brand"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 8px',
          borderBottom: '1px solid rgba(212, 160, 23, 0.18)',
          textDecoration: 'none',
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(212, 160, 23, 0.25) 0%, rgba(143, 102, 38, 0.35) 100%)',
            border: '1px solid rgba(212, 160, 23, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
            boxShadow: '0 0 14px rgba(212, 160, 23, 0.25)',
          }}
        >
          <img
            src="/logo-light.png"
            alt=""
            width="30"
            height="30"
            style={{ objectFit: 'contain' }}
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const p = e.currentTarget.parentElement;
              if (p && !p.querySelector('.fallback-monogram')) {
                const s = document.createElement('span');
                s.className = 'fallback-monogram';
                s.style.color = '#d4a017';
                s.style.fontWeight = '900';
                s.style.fontSize = '18px';
                s.innerText = 'أ';
                p.appendChild(s);
              }
            }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-1)', letterSpacing: -0.2 }}>
              منظومة أساس
            </span>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#22c55e',
                boxShadow: '0 0 8px #22c55e',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
          </div>
          <span
            style={{
              fontSize: 10,
              color: 'var(--accent)',
              fontWeight: 700,
              letterSpacing: 0.8,
              fontFamily: 'monospace',
            }}
            dir="ltr"
          >
            v2.5 Enterprise
          </span>
        </div>
      </NavLink>

      {/* Active Host Badge */}
      <div style={{ padding: '2px 4px 6px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 8px',
            background: 'rgba(0,0,0,0.35)',
            border: '1px solid rgba(212,160,23,0.18)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 11,
          }}
        >
          <span style={{ color: 'var(--text-3)', fontSize: 10 }}>المضيف النشط</span>
          <span
            style={{
              color: 'var(--accent)',
              fontWeight: 700,
              fontFamily: 'monospace',
              fontSize: 11,
            }}
            dir="ltr"
          >
            WIN-2025-PROD
          </span>
        </div>
      </div>

      {/* Nav Sections */}
      <nav className="sidebar-nav">
        <span className="sidebar-nav__label">لوحة القيادة والمراقبة</span>
        <NavLink to="/" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><LayoutDashboard size={18} /></div>
          <span>نظرة عامة ورسم الأنوية</span>
        </NavLink>
        <NavLink to="/control" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><Cpu size={18} /></div>
          <span>مركز التحكم وحاكم الموارد</span>
        </NavLink>

        <span className="sidebar-nav__label" style={{ marginTop: 6 }}>إدارة الأصول والخزنة</span>
        <NavLink to="/assets" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><Server size={18} /></div>
          <span>دليل الخوادم والأصول</span>
        </NavLink>
        <NavLink to="/vault" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><KeyRound size={18} /></div>
          <span>خزنة الحسابات المشفرة</span>
        </NavLink>

        <span className="sidebar-nav__label" style={{ marginTop: 6 }}>الشبكة ومركز الأمان</span>
        <NavLink to="/ports" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><Radio size={18} /></div>
          <span>درع المنافذ والعزل الذكي</span>
        </NavLink>
        <NavLink to="/security" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><ShieldAlert size={18} /></div>
          <span>مركز الدفاع والأمان</span>
        </NavLink>

        <span className="sidebar-nav__label" style={{ marginTop: 6 }}>النظام والامتثال</span>
        <NavLink to="/storage" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><HardDrive size={18} /></div>
          <span>التخزين والملفات</span>
        </NavLink>
        <NavLink to="/users" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><Users size={18} /></div>
          <span>إدارة مستخدمي RDP</span>
        </NavLink>
        <NavLink to="/audit" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><ScrollText size={18} /></div>
          <span>سجل التدقيق والامتثال</span>
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><Settings size={18} /></div>
          <span>الإعدادات والإنذارات</span>
        </NavLink>

        <span className="sidebar-nav__label" style={{ marginTop: 6 }}>الامتيازات والتحقيق الجنائي</span>
        <NavLink to="/jit" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><Shield size={18} /></div>
          <span>ترقية الصلاحيات JIT v2.5</span>
        </NavLink>
        <NavLink to="/replay" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><Film size={18} /></div>
          <span>التحقيق واسترجاع الجلسات</span>
        </NavLink>
        <span className="sidebar-nav__label" style={{ marginTop: 6 }}>البوابات السيادية والمعرض</span>
        <NavLink to="/login" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><Lock size={18} /></div>
          <span>بوابة النفاذ Zero-Trust SSO</span>
        </NavLink>
        <NavLink to="/lockout" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><ShieldCheck size={18} /></div>
          <span>درع المحيط Perimeter Lockout</span>
        </NavLink>
        <NavLink to="/gallery" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><Sparkles size={18} /></div>
          <span>معرض واجهات Stitch (20)</span>
        </NavLink>
      </nav>

      {/* Footer Info */}
      <div className="sidebar-footer" style={{ marginTop: 'auto', borderTop: '1px solid rgba(212,160,23,0.18)', paddingTop: 8 }}>
        <button
          type="button"
          onClick={onOpenUserAccount}
          aria-label={`إدارة الحساب والمستخدم: ${currentUser?.username || 'Administrator'} (${roleTitle})`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 10px',
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(212, 160, 23, 0.18)',
            borderRadius: 'var(--radius-sm)',
            cursor: onOpenUserAccount ? 'pointer' : 'default',
            width: '100%',
            textAlign: 'start',
            fontFamily: 'inherit',
          }}
          className="hover:border-primary/50 hover:bg-surface-glass-tint transition-all focus-visible:ring-2 focus-visible:ring-primary active:scale-[0.98]"
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>
              {currentUser?.username || 'Administrator'}
            </span>
            <span style={{ fontSize: 10, color: roleColor }}>
              {roleTitle}
            </span>
          </div>
          <span
            style={{
              padding: '2px 8px',
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 700,
              background: roleColor,
              color: '#000',
            }}
          >
            {roleBadge}
          </span>
        </button>
      </div>
    </aside>
  );
}
