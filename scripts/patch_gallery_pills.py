with open('frontend/src/pages/StitchGalleryPage.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace(
    "<div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>",
    "<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', overflowX: 'auto', paddingBottom: 4 }}>"
)

with open('frontend/src/pages/StitchGalleryPage.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

print('[+] Patched StitchGalleryPage.tsx category pills')
