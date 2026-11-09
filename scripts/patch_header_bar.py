from pathlib import Path

p = Path('frontend/src/components/HeaderBar.tsx')
text = p.read_text(encoding='utf-8')

old_part = """          <button
            type="button"
            onClick={onOpenAiDiag}
            className="badge badge--warning"
            style={{ cursor: 'pointer', border: 'none', background: 'var(--partial-bg)', color: 'var(--partial)' }}
          >
            <span>رادار الذكاء الاصطناعي (AI Ops)</span>
          </button>
        </div>

        {/* Action Cluster */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* User Account / Role Switcher Pill */}
          <button
            type="button"
            onClick={onOpenUserAccount}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '5px 12px',
              borderRadius: 'var(--radius-pill)',
              background: 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${roleColor}`,
              color: 'var(--text-1)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 600,
            }}
          >"""

new_part = """          <button
            type="button"
            onClick={onOpenAiDiag}
            className="badge badge--warning hover:brightness-110 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary cursor-pointer select-none"
            style={{ border: 'none', background: 'var(--partial-bg)', color: 'var(--partial)' }}
            aria-label="فتح رادار الذكاء الاصطناعي لتشخيص المنظومة"
          >
            <span>رادار الذكاء الاصطناعي (AI Ops)</span>
          </button>
        </div>

        {/* Action Cluster */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* User Account / Role Switcher Pill */}
          <button
            type="button"
            onClick={onOpenUserAccount}
            aria-label={`تغيير المستخدم والدور: ${currentUser?.username || 'Administrator'} (${roleLabel})`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 14px',
              borderRadius: 'var(--radius-pill)',
              background: 'rgba(255, 255, 255, 0.04)',
              border: `1px solid ${roleColor}`,
              color: 'var(--text-1)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 600,
            }}
            className="hover:bg-surface-glass-tint active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary"
          >"""

if old_part in text:
    text = text.replace(old_part, new_part, 1)
    p.write_text(text, encoding='utf-8')
    print("HeaderBar.tsx interactive buttons polished!")
else:
    print("old_part not found in HeaderBar.tsx")
