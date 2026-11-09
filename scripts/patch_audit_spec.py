with open('frontend/e2e/visual-audit.spec.ts', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace(
    "await page.goto(pageItem.path, { waitUntil: 'networkidle' });",
    "await page.goto(pageItem.path, { waitUntil: 'domcontentloaded' });\n      await page.waitForTimeout(1200);"
)

with open('frontend/e2e/visual-audit.spec.ts', 'w', encoding='utf-8') as f:
    f.write(c)

print('[+] Patched visual-audit.spec.ts')
