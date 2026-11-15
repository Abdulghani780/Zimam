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
  Code2,
  Container,
  Database,
  Vault,
  HardDrive,
  Timer,
  History,
  Globe,
} from 'lucide-react';

const NAV_ITEMS = [
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
  { to: '/storage', label: 'التحكم بالتخزين', icon: HardDrive },
  { to: '/security', label: 'مركز الحماية', icon: Shield },
  { to: '/network-storage', label: 'مراقبة الشبكة', icon: Wifi },
  { to: '/users', label: 'المستخدمون والصلاحيات', icon: Users },
  { to: '/jit', label: 'الترقية المؤقتة (JIT)', icon: Timer },
  { to: '/replay', label: 'إعادة تشغيل الجلسات', icon: History },
  { to: '/audit', label: 'السجلات والتدقيق', icon: ScrollText },
  { to: '/settings', label: 'إعدادات المنظومة', icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="app-sidebar" aria-label="شريط التنقل الجانبي">
      <NavLink to="/" className="sidebar-brand" aria-label="منظومة أساس - لوحة القيادة">
        <span className="sidebar-brand__text">
          <strong>ASAAS</strong>
          <span>Server Control</span>
        </span>
        <img
          className="sidebar-brand__logo"
          src="/logo-light.png"
          alt=""
          width={46}
          height={46}
        />
      </NavLink>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
          >
            <span className="icon-wrap"><Icon size={17} /></span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
