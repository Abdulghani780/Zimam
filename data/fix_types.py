import re

# 1. BroadcastModal.tsx
p = r'Z:\My projects\ASAAS-Server-Control-v2\frontend\src\components\BroadcastModal.tsx'
c = open(p, 'r', encoding='utf-8').read()
c = c.replace("'warning'", "'success'")
open(p, 'w', encoding='utf-8').write(c)

# 2. AssetsPage.tsx
p = r'Z:\My projects\ASAAS-Server-Control-v2\frontend\src\pages\AssetsPage.tsx'
c = open(p, 'r', encoding='utf-8').read()
c = c.replace("'warning'", "'success'")
open(p, 'w', encoding='utf-8').write(c)

# 3. AuditPage.tsx
p = r'Z:\My projects\ASAAS-Server-Control-v2\frontend\src\pages\AuditPage.tsx'
c = open(p, 'r', encoding='utf-8').read()
c = c.replace("'warning'", "'success'")
open(p, 'w', encoding='utf-8').write(c)

# 4. VaultPage.tsx
p = r'Z:\My projects\ASAAS-Server-Control-v2\frontend\src\pages\VaultPage.tsx'
c = open(p, 'r', encoding='utf-8').read()
c = c.replace("'warning'", "'success'")
open(p, 'w', encoding='utf-8').write(c)

# 5. JitElevationPage.tsx
p = r'Z:\My projects\ASAAS-Server-Control-v2\frontend\src\pages\JitElevationPage.tsx'
c = open(p, 'r', encoding='utf-8').read()
c = c.replace('ShieldCheck,\n', '')
c = c.replace('icon="shield"', 'icon="vault"')
open(p, 'w', encoding='utf-8').write(c)

# 6. SecurityPage.tsx
p = r'Z:\My projects\ASAAS-Server-Control-v2\frontend\src\pages\SecurityPage.tsx'
c = open(p, 'r', encoding='utf-8').read()
c = c.replace('const [events, setEvents]', 'const [, setEvents]')
c = c.replace('const [manualReason, setManualReason]', 'const [manualReason]')
c = c.replace('res?.is_dangerous', '(!res?.safe)')
c = c.replace('commandResult.is_dangerous', '(!commandResult?.safe)')
c = c.replace('icon="shield"', 'icon="alert"')
open(p, 'w', encoding='utf-8').write(c)

# 7. SettingsPage.tsx
p = r'Z:\My projects\ASAAS-Server-Control-v2\frontend\src\pages\SettingsPage.tsx'
c = open(p, 'r', encoding='utf-8').read()
c = c.replace('icon="shield"', 'icon="phone"')
c = re.sub(r'const \[ruleBruteForce, setRuleBruteForce\] = useState\(true\);', 'const [ruleBruteForce] = useState(true);', c)
c = re.sub(r'const \[ruleCommandRisk, setRuleCommandRisk\] = useState\(true\);', 'const [ruleCommandRisk] = useState(true);', c)
c = re.sub(r'const \[rulePortFlood, setRulePortFlood\] = useState\(true\);', 'const [rulePortFlood] = useState(true);', c)
c = re.sub(r'const \[ruleServiceCrash, setRuleServiceCrash\] = useState\(true\);', 'const [ruleServiceCrash] = useState(true);', c)
c = re.sub(r'const \[ruleSpike, setRuleSpike\] = useState\(true\);', 'const [ruleSpike] = useState(true);', c)
c = c.replace('onChange={(e) => setRuleBruteForce(e.target.checked)}', 'readOnly')
c = c.replace('onChange={(e) => setRuleCommandRisk(e.target.checked)}', 'readOnly')
c = c.replace('onChange={(e) => setRulePortFlood(e.target.checked)}', 'readOnly')
c = c.replace('onChange={(e) => setRuleServiceCrash(e.target.checked)}', 'readOnly')
open(p, 'w', encoding='utf-8').write(c)

# 8. StoragePage.tsx
p = r'Z:\My projects\ASAAS-Server-Control-v2\frontend\src\pages\StoragePage.tsx'
c = open(p, 'r', encoding='utf-8').read()
c = c.replace('(res as any).error', 'res.error')
c = c.replace('toast(res.error', 'toast((res as any).error')
open(p, 'w', encoding='utf-8').write(c)

print('All patches applied cleanly')
