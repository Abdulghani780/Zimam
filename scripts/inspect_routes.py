import re
from pathlib import Path

text = Path('backend/app/api/router.py').read_text(encoding='utf-8')
routes = set(re.findall(r'[\'"](/api/[a-zA-Z0-9_\-/]+)[\'"]', text))
print("Found API routes:")
for r in sorted(routes):
    print(" ", r)
