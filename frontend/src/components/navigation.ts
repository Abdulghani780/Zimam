import {
  Bot,
  Code2,
  Container,
  Cpu,
  Database,
  Globe,
  HardDrive,
  History,
  LayoutDashboard,
  Monitor,
  Network,
  ScrollText,
  Server,
  Settings,
  Settings2,
  Shield,
  ShieldCheck,
  Timer,
  Users,
  Vault,
  Wifi,
  type LucideIcon,
} from 'lucide-react';

export interface NavigationItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export interface NavigationGroup {
  label: string;
  items: NavigationItem[];
}

export const NAV_GROUPS: NavigationGroup[] = [
  {
    label: 'نظرة عامة',
    items: [
      { to: '/', label: 'لوحة القيادة', icon: LayoutDashboard, end: true },
      { to: '/servers', label: 'إدارة السيرفرات', icon: Server },
      { to: '/agents', label: 'وكلاء الأصول', icon: Bot },
    ],
  },
  {
    label: 'العمليات التشغيلية',
    items: [
      { to: '/control', label: 'جلسات سطح المكتب (RDP)', icon: Monitor },
      { to: '/governor', label: 'حاكم الموارد', icon: Cpu },
      { to: '/infrastructure', label: 'إدارة العمليات والخدمات', icon: Settings2 },
      { to: '/development', label: 'مساحات المطورين', icon: Code2 },
      { to: '/containers', label: 'الحاويات', icon: Container },
      { to: '/databases', label: 'قواعد البيانات', icon: Database },
      { to: '/network-storage', label: 'مراقبة الشبكة', icon: Wifi },
      { to: '/storage', label: 'التحكم بالتخزين', icon: HardDrive },
      { to: '/ports', label: 'عزل المنافذ', icon: Network },
    ],
  },
  {
    label: 'الوصول والحماية',
    items: [
      { to: '/bastion', label: 'بوابة الوصول الآمن (PAM)', icon: ShieldCheck },
      { to: '/assets', label: 'الأصول والعناوين', icon: Globe },
      { to: '/vault', label: 'الخزنة الآمنة', icon: Vault },
      { to: '/users', label: 'المستخدمون والصلاحيات', icon: Users },
      { to: '/jit', label: 'الترقية المؤقتة (JIT)', icon: Timer },
      { to: '/replay', label: 'إعادة تشغيل الجلسات', icon: History },
      { to: '/security', label: 'مركز الحماية', icon: Shield },
    ],
  },
  {
    label: 'النظام والتدقيق',
    items: [
      { to: '/audit', label: 'السجلات والتدقيق', icon: ScrollText },
      { to: '/settings', label: 'إعدادات المنظومة', icon: Settings },
    ],
  },
];

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);
