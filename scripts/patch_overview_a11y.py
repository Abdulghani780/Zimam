from pathlib import Path

p = Path('frontend/src/pages/OverviewPage.tsx')
text = p.read_text(encoding='utf-8')

# 1. Remove 4px thick border stripe
old_banner = '<Glass className="hero-banner" style={{ borderInlineStart: \'4px solid var(--accent-fill)\' }}>'
new_banner = '<Glass className="hero-banner">'
if old_banner in text:
    text = text.replace(old_banner, new_banner, 1)

# 2. Add keyboard accessibility to session table rows
old_row = """                  <TableRow
                    key={s.id}
                    onClick={() => setSelectedSession(s)}
                    className="cursor-pointer"
                  >"""

new_row = """                  <TableRow
                    key={s.id}
                    tabIndex={0}
                    onClick={() => setSelectedSession(s)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedSession(s);
                      }
                    }}
                    className="cursor-pointer focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
                    aria-label={`جلسة ${s.user} رقم ${s.id}`}
                  >"""

if old_row in text:
    text = text.replace(old_row, new_row, 1)

p.write_text(text, encoding='utf-8')
print("OverviewPage.tsx updated with keyboard accessibility and craft floor compliance!")
