# ASAAS — خطة المعالجة الشاملة

الحالة بعد جولة التنفيذ (main @ 9778c83):

## ✅ منجز
- الهوية الرسمية الكاملة من AI-ASAAS/skills (توكنات ink/gold، Thmanyah Serif، ثيم فاتح/داكن) — commit 6be66c0
- بيانات وهمية أُزيلت من 6 صفحات — 34a9cd0
- تحصينات: rate limit v1 login، حد باسورد ويندوز 8، NetUserAdd/NetUserSetInfo (لا باسورد في argv) — fdf7d27 + 495b274
- e2e smoke في CI (login/theme/overflow/governor) — 495b274
- إزالة zip 9.9MB + كل artifacts من git — 69fb940
- route-level code splitting: 755KB → 346KB — 24fc0e8
- إصلاح useTheme/theme-init sync — 24fc0e8
- جسر legacy proxy + SPA على :8876 — 6a2a7fb

## ⏳ متبقٍ (يحتاج جلسات مستقلة)
- P3: الترحيل التدريجي للصفحات إلى /api/v1 حسب docs/MIGRATION_PLAN.md
- P4: بوابات إصدار control plane: guacd data path، Redis token consumption،
  session termination، agent signed jobs، recordings، AD/LDAP، mTLS
  (كلها 501/503 معلنة بصراحة — لا بيانات وهمية)
- إغلاق النسخة القديمة elevated على :8765 — يحتاج UAC (start-server.bat)
