with open(r'Z:\My projects\ASAAS-Server-Control-v2\frontend\src\components\Sidebar.tsx', 'r', encoding='utf-8') as f:
    content = f.read().replace('\r\n', '\n')

target = """interface SidebarProps {
  isAdmin?: boolean;
}

export function Sidebar({ isAdmin }: SidebarProps) {"""

replacement = """import type { AppUser } from '../lib/api';

interface SidebarProps {
  isAdmin?: boolean;
  currentUser?: AppUser | null;
  onOpenUserAccount?: () => void;
}

export function Sidebar({ isAdmin, currentUser, onOpenUserAccount }: SidebarProps) {"""

content = content.replace(target, replacement, 1)

target_foot = """      {/* Footer Info */}
      <div className="sidebar-footer" style={{ marginTop: 'auto', borderTop: '1px solid rgba(212,160,23,0.18)', paddingTop: 8 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 8px',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>Administrator</span>
            <span style={{ fontSize: 10, color: isAdmin ? 'var(--paid)' : 'var(--accent)' }}>
              {isAdmin ? 'صلاحيات مسؤول كاملة' : 'صلاحيات مستخدم قياسي'}
            </span>
          </div>
          <span className={`badge ${isAdmin ? 'badge--success' : 'badge--accent'}`}>
            {isAdmin ? 'ROOT' : 'USER'}
          </span>
        </div>
      </div>"""

replacement_foot = """      {/* Footer Info */}
      <div className="sidebar-footer" style={{ marginTop: 'auto', borderTop: '1px solid rgba(212,160,23,0.18)', paddingTop: 8 }}>
        <div
          onClick={onOpenUserAccount}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 8px',
            background: 'rgba(255,255,255,0.02)',
            borderRadius: 'var(--radius-sm)',
            cursor: onOpenUserAccount ? 'pointer' : 'default',
            transition: 'background 0.2s',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)' }}>
              {currentUser?.username || 'Administrator'}
            </span>
            <span style={{ fontSize: 10, color: currentUser?.role === 'admin' ? '#22c55e' : currentUser?.role === 'operator' ? 'var(--accent)' : '#3b82f6' }}>
              {currentUser?.role === 'admin' ? 'مدير نظام كامل' : currentUser?.role === 'operator' ? 'مشغل عمليات' : 'قراءة وتدقيق فقط'}
            </span>
          </div>
          <span className={`badge ${currentUser?.role === 'admin' ? 'badge--success' : currentUser?.role === 'operator' ? 'badge--accent' : 'badge--warning'}`}>
            {currentUser?.role ? currentUser.role.toUpperCase() : (isAdmin ? 'ROOT' : 'USER')}
          </span>
        </div>
      </div>"""

assert target in content, "target not found"
assert target_foot in content, "target_foot not found"
content = content.replace(target_foot, replacement_foot, 1)

with open(r'Z:\My projects\ASAAS-Server-Control-v2\frontend\src\components\Sidebar.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Updated Sidebar.tsx successfully')
