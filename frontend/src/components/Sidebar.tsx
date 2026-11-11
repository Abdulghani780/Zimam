import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Cpu,
  Server,
  KeyRound,
  ShieldAlert,
  HardDrive,
  Users,
  ScrollText,
  Settings,
  Shield,
  Film,
  Code,
  Boxes,
  Layers,
  Database,
  Package,
  Radio,
  PieChart,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { AppUser } from '../lib/api';

interface SidebarProps {
  isAdmin?: boolean;
  currentUser?: AppUser | null;
  onOpenUserAccount?: () => void;
}

export function Sidebar({ isAdmin, currentUser, onOpenUserAccount }: SidebarProps) {
  const roleColor = currentUser?.role === 'admin' ? 'var(--status-safe)' : currentUser?.role === 'operator' ? 'var(--accent)' : 'var(--status-info)';
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
          borderBottom: '1px solid var(--glass-rim-low)',
          textDecoration: 'none',
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: 'var(--glass-tint-strong)',
            border: '1px solid var(--glass-rim)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
            boxShadow: 'var(--accent-glow)',
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
                s.style.color = 'var(--accent)';
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
                background: 'var(--status-safe)',
                boxShadow: 'var(--primitive-glow-safe)',
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
            v3.0 Enterprise
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
            background: 'var(--glass-tint)',
            border: '1px solid var(--glass-rim-low)',
            borderRadius: 'var(--radius-sm)',
            fontSize: 11,
          }}
        >
          <span style={{ color: 'var(--text-3)', fontSize: 10 }}>المضيف السيادي</span>
          <span
            style={{
              color: 'var(--accent)',
              fontWeight: 700,
              fontFamily: 'monospace',
              fontSize: 11,
            }}
            dir="ltr"
          >
            SRV-LOCAL (Win2025)
          </span>
        </div>
      </div>

      {/* Nav Sections */}
      <nav className="sidebar-nav">
        <span className="sidebar-nav__label">القيادة والمراقبة والموارد</span>
        <NavLink to="/" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><LayoutDashboard size={18} /></div>
          <span>نظرة عامة ورسم الأنوية</span>
        </NavLink>
        <NavLink to="/servers" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><Server size={18} /></div>
          <span>إدارة الخوادم والمجموعات</span>
        </NavLink>
        <NavLink to="/users" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><Users size={18} /></div>
          <span>جلسات ومستخدمو RDP</span>
        </NavLink>
        <NavLink to="/control" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><Cpu size={18} /></div>
          <span>حاكم الموارد والعمليات</span>
        </NavLink>
        <NavLink to="/assets" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><Package size={18} /></div>
          <span>سجل الأصول والعتاد</span>
        </NavLink>

        <span className="sidebar-nav__label" style={{ marginTop: 6 }}>المطورون والافتراضية</span>
        <NavLink to="/development" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><Code size={18} /></div>
          <span>بيئات المطورين والمشاريع</span>
        </NavLink>
        <NavLink to="/containers" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><Boxes size={18} /></div>
          <span>Docker والافتراضية Hyper-V</span>
        </NavLink>
        {import.meta.env.DEV && (
          <NavLink to="/stitch" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <div className="icon-wrap"><Sparkles size={18} /></div>
            <span>معرض مكونات Stitch Design</span>
          </NavLink>
        )}

        <span className="sidebar-nav__label" style={{ marginTop: 6 }}>البنية التحتية والشبكات</span>
        <NavLink to="/infrastructure" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><Layers size={18} /></div>
          <span>أدوار Windows والخدمات</span>
        </NavLink>
        <NavLink to="/network-storage" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><HardDrive size={18} /></div>
          <span>التخزين والشبكات والجدار الناري</span>
        </NavLink>
        <NavLink to="/storage" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><PieChart size={18} /></div>
          <span>تحليل وسائط التخزين والأقراص</span>
        </NavLink>
        <NavLink to="/ports" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><Radio size={18} /></div>
          <span>المنافذ والاتصالات النشطة</span>
        </NavLink>
        <NavLink to="/databases" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><Database size={18} /></div>
          <span>إدارة قواعد البيانات وSQL</span>
        </NavLink>

        <span className="sidebar-nav__label" style={{ marginTop: 6 }}>الأمان والوصول المميز</span>
        <NavLink to="/vault" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><KeyRound size={18} /></div>
          <span>خزنة الحسابات المشفرة</span>
        </NavLink>
        <NavLink to="/security" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><ShieldAlert size={18} /></div>
          <span>مركز الدفاع والأمان</span>
        </NavLink>
        <NavLink to="/bastion" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><ShieldCheck size={18} /></div>
          <span>بوابة الحماية السيادية Bastion PAM</span>
        </NavLink>
        <NavLink to="/jit" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><Shield size={18} /></div>
          <span>ترقية الصلاحيات المؤقتة JIT</span>
        </NavLink>

        <span className="sidebar-nav__label" style={{ marginTop: 6 }}>التدقيق والتقارير</span>
        <NavLink to="/audit" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><ScrollText size={18} /></div>
          <span>سجل التدقيق وسلسلة Merkle</span>
        </NavLink>
        <NavLink to="/replay" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><Film size={18} /></div>
          <span>تسجيلات الجلسات الزمنية</span>
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <div className="icon-wrap"><Settings size={18} /></div>
          <span>إعدادات وسياسات المنظومة</span>
        </NavLink>
      </nav>

      {/* Footer Info */}
      <div className="sidebar-footer" style={{ marginTop: 'auto', borderTop: '1px solid var(--accent-soft)', paddingTop: 8 }}>
        <button
          type="button"
          onClick={onOpenUserAccount}
          aria-label={`إدارة الحساب والمستخدم: ${currentUser?.username || 'Administrator'} (${roleTitle})`}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 10px',
            background: 'var(--glass-tint)',
            border: '1px solid var(--glass-rim-low)',
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
              color: 'var(--on-accent)',
            }}
          >
            {roleBadge}
          </span>
        </button>
      </div>
    </aside>
  );
}
