import re

with open('frontend/src/lib/api.ts', 'r', encoding='utf-8') as f:
    text = f.read()

calls = set(re.findall(r"request<[^>]*>\(['\"]([^'\"]+)['\"]", text))
calls.update(re.findall(r"fetch\(['\"]([^'\"]+)['\"]", text))

with open('backend/app/api/router.py', 'r', encoding='utf-8') as f:
    router_text = f.read()

print(f"Total API calls found: {len(calls)}")
missing = []
for c in sorted(calls):
    clean = c.split('?')[0]
    present = clean in router_text
    status = "OK" if present else "MISSING!"
    if not present:
        missing.append(clean)
    print(f"{clean:35} -> {status}")

print("\nMissing endpoints count:", len(missing))
if missing:
    print("Missing endpoints:", missing)
