from pathlib import Path

p = Path('frontend/src/components/Sidebar.tsx')
text = p.read_text(encoding='utf-8')

old_part = """        <div
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
        </div>"""

new_part = """        <button
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
        </button>"""

if old_part in text:
    text = text.replace(old_part, new_part, 1)
    p.write_text(text, encoding='utf-8')
    print("Sidebar.tsx footer updated to accessible button!")
else:
    print("old_part not found in Sidebar.tsx")
