from pathlib import Path

p = Path('frontend/src/components/CpuHistoryChart.tsx')
text = p.read_text(encoding='utf-8')

target = "مراقبة مستمرة ودقيقة لحمل كل نواة في الوقت الفعلي عبر موجات بيانية متزامنة (GNOME System Monitor Standard) — الحمل الإجمالي: {cpuTotal}% {cpuModel ? `(${cpuModel})` : ''}"
replacement = "<span>مراقبة مستمرة ودقيقة لحمل كل نواة عبر موجات بيانية متزامنة — الحمل الإجمالي: </span><bdi dir=\"ltr\" style={{ fontWeight: 700, color: 'var(--accent)' }}>{cpuTotal}%</bdi>{cpuModel && <bdi dir=\"ltr\" style={{ marginInlineStart: 8, fontSize: 11, color: 'var(--text-3)' }}>({cpuModel})</bdi>}"

if target in text:
    text = text.replace(target, replacement)
    p.write_text(text, encoding='utf-8')
    print("[+] Fixed CpuHistoryChart bidi text successfully!")
else:
    print("[-] Target not found!")
