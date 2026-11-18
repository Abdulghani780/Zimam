# سير عمل تنفيذ الميزات المتكاملة (Feature Implementation Workflow)
# المسار: .agent/workflows/feature_implementation.md
# ==============================================================================

## الهدف
تنفيذ الميزات والخدمات الجديدة بشكل متكامل من طبقة النواة (Windows APIs / Backend) وحتى الواجهة الأمامية وتجربة المستخدم.

---

## 🛠️ مراحل التنفيذ الإلزامية

### المرحلة 1: طبقة الباك إند والخدمات (Backend / Infrastructure)
- [ ] فحص واجهات Windows Native APIs المطلوبة (WMI, Win32, Registry, WTS).
- [ ] كتابة كود الخدمة داخل `backend/app/infrastructure/` أو `backend/app/services/`.
- [ ] تسجيل نقاط النهاية (Endpoints) في `backend/app/api/router.py`.
- [ ] كتابة اختبارات الوحدة في `tests/` والتأكد من نجاحها بالكامل (`python -m unittest`).

---

### المرحلة 2: طبقة الفرونت إند والصفحات (Frontend UI)
- [ ] استدعاء الـ API من خلال `frontend/src/lib/api.ts` بدوال Typed وآمنة.
- [ ] إنشاء صفحة الميزة أو المكون داخل `frontend/src/pages/` أو `frontend/src/components/`.
- [ ] **إلزامي:** تسجيل مسار الصفحة الجديدة في `frontend/src/App.tsx`.
- [ ] **إلزامي:** إضافة زر ورابط الصفحة في شريط التنقل `frontend/src/components/Sidebar.tsx` مع أيقونة مناسبة من `lucide-react`.

---

### المرحلة 3: البناء الإجباري ونقل المخرجات إلى dist/ (Mandatory Dist Build)
- [ ] **إلزامي بدون استثناء:** السيرفر يعرض الملفات من مجلد `dist/` فقط!
  يجب تشغيل أمر البناء فور الانتهاء من التعديلات:
  ```powershell
  npm --prefix frontend run build
  ```
- [ ] التأكد من خلو مخرجات TypeScript و Vite من أي أخطاء ووصولها إلى مجلد `dist/`.
- [ ] التحقق من أن التغييرات ظهرت مباشرة على خادم الويب الحي `http://127.0.0.1:8765/`.

---

### المرحلة 4: التحقق والجودة (Verification & Zero Mock)
- [ ] التأكد من أن الميزة تعرض بيانات حقيقية 100% من السيرفر.
- [ ] فحص تفاعل كافة الأزرار وعناصر التحكم.
- [ ] توثيق الميزة المضافة.
