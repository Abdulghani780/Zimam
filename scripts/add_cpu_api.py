from pathlib import Path

p = Path('frontend/src/lib/api.ts')
text = p.read_text(encoding='utf-8')

target = "  // Storage Locked Files Diagnostic (Story 9)"
replacement = """  // CPU Cores Rolling History
  getCpuHistory: () =>
    request<{ ok: boolean; history: { timestamps: string[]; cores: Record<string, number[]>; core_count: number } }>('/api/metrics/cpu-history'),

  // Storage Locked Files Diagnostic (Story 9)"""

if target in text:
    text = text.replace(target, replacement, 1)
    p.write_text(text, encoding='utf-8')
    print("[+] Added getCpuHistory to api.ts successfully!")
else:
    print("[-] Target not found!")
