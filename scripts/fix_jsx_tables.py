from pathlib import Path

# 1. Fix PortsPage.tsx
ports_p = Path('frontend/src/pages/PortsPage.tsx')
ports_text = ports_p.read_text(encoding='utf-8')

ports_text = ports_text.replace('<td colSpan={9}', '<TableCell colSpan={9}')
ports_text = ports_text.replace('<tr key={`${p.local_port}-${p.proto}-${idx}`}', '<TableRow key={`${p.local_port}-${p.proto}-${idx}`}')
ports_text = ports_text.replace('<td style={{ fontWeight: 600 }}>', '<TableCell style={{ fontWeight: 600 }}>')
ports_text = ports_text.replace('<td style={{ fontFamily: \'var(--font)\' }}>', '<TableCell style={{ fontFamily: \'var(--font)\' }}>')
ports_text = ports_text.replace('<td style={{ fontFamily: \'var(--font)\', color: \'var(--text-2)\' }}>', '<TableCell style={{ fontFamily: \'var(--font)\', color: \'var(--text-2)\' }}>')
ports_text = ports_text.replace('<td style={{ textAlign: \'end\' }}>', '<TableCell style={{ textAlign: \'end\' }}>')
ports_p.write_text(ports_text, encoding='utf-8')
print("PortsPage.tsx fixed!")

# 2. Fix SecurityPage.tsx
sec_p = Path('frontend/src/pages/SecurityPage.tsx')
sec_text = sec_p.read_text(encoding='utf-8')

sec_text = sec_text.replace('<td colSpan={5}', '<TableCell colSpan={5}')
sec_text = sec_text.replace('<tr key={ip}>', '<TableRow key={ip}>')
sec_text = sec_text.replace('<td style={{ fontFamily: \'var(--font)\', fontWeight: 700, color: \'#ef4444\' }}>', '<TableCell style={{ fontFamily: \'var(--font)\', fontWeight: 700, color: \'#ef4444\' }}>')
sec_text = sec_text.replace('<td style={{ fontSize: 12, color: \'var(--text-2)\' }}>', '<TableCell style={{ fontSize: 12, color: \'var(--text-2)\' }}>')
sec_text = sec_text.replace('<td style={{ fontSize: 12, color: \'var(--text-3)\' }}>', '<TableCell style={{ fontSize: 12, color: \'var(--text-3)\' }}>')
sec_text = sec_text.replace('<td style={{ textAlign: \'end\' }}>', '<TableCell style={{ textAlign: \'end\' }}>')
sec_p.write_text(sec_text, encoding='utf-8')
print("SecurityPage.tsx fixed!")
