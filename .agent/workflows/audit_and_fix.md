# سير عمل الفحص والإصلاح الشامل (Audit & Rescue Workflow)
# المسار: .agent/workflows/audit_and_fix.md
# ==============================================================================

## الهدف
إجراء الفحص الجنائي، كشف الأزرار والوظائف الوهمية أو غير المكتملة، وتصحيحها وضمان وصول التحديثات إلى المستخدم النهائي.

---

## 🔍 خطوات الفحص والإصلاح الإلزامية

### 1. المسح الجنائي للواجهات (Frontend Forensic Scan)
- [ ] فحص كافة ملفات `frontend/src/pages/*.tsx` و `frontend/src/components/*.tsx`.
- [ ] التحقق من أن كل زر `<button>` يحتوي على معالج أحداث `onClick` حقيقي متصل بدالة برمجية أو نافذة منبثقة أو استدعاء API حقيقي.
- [ ] التأكد من عدم وجود أزرار معطلة أو عبارات `TODO` أو `console.log` دون منطق.

### 2. مطابقة الصفحات والقائمة الجانبية (Pages & Navigation Audit)
- [ ] التأكد من أن كل صفحة موجودة في `frontend/src/pages/` مسجلة في `frontend/src/App.tsx`.
- [ ] التأكد من وجود رابط وصول مباشر لها في `frontend/src/components/Sidebar.tsx` (باستثناء صفحات المصادقة والحظر).

### 3. تدقيق الباك إند (Backend Logic & APIs Audit)
- [ ] فحص كود `backend/app/` والتأكد من خلوه من أي بيانات محاكاة ثابتة Synthetic/Hardcoded.
- [ ] تشغيل حزمة الاختبارات الشاملة:
  ```powershell
  python -m unittest discover tests
  ```

### 4. 🚨 البناء الإلزامي للفرونت إند (Mandatory Frontend Build Gate)
- [ ] **الخطوة الحاسمة:** السيرفر يبث المحتوى من `dist/`. أي إصلاح تم في `frontend/src/` لن يراه المستخدم إلا بتشغيل:
  ```powershell
  npm --prefix frontend run build
  ```
- [ ] التحقق من تحديث مجلد `dist/` وسلامة `dist/index.html`.
- [ ] التأكد من استجابة المنظومة على الرابط الحي `http://127.0.0.1:8765/`.
