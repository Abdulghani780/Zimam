# منظومة ZIMAM & Resource Governor Enterprise v2.5

منظومة الجيل الثاني المتطورة لمراقبة وإدارة خوادم **Windows Server 2025 / 2022** وجلسات سطح المكتب البعيد (**RDP / Terminal Services**)، وحصن النفاذ الموحد (**JumpServer PAM Bastion**)، وحاكم الموارد الذكي المتقدم بنمط **Clean Architecture & OOP**.

---

## 🏛️ المعمارية البرمجية (Clean Architecture & OOP)

تم بناء النسخة بالكامل من الصفر دون أي ديون معمارية قديمة وبفصل كامل للمسؤوليات:

```text
ASAAS-Server-Control-v2/
├── backend/
│   ├── app/
│   │   ├── core/                  # التهيئة المركزية ومفاتيح الأمان
│   │   │   └── config.py
│   │   ├── domain/                # نماذج النطاق ومطابقة العقود (Data Classes)
│   │   │   └── models.py
│   │   ├── infrastructure/        # الربط المباشر مع Win32 Ctypes
│   │   │   ├── win32_wts.py       # وساطة wtsapi32.dll & netapi32.dll
│   │   │   └── silent_subprocess.py # مشغل الأوامر الصامت المانع لوميض CMD
│   │   ├── services/              # طبقة الخدمات الكائنية (Domain Services)
│   │   │   ├── telemetry_service.py      # مراقبة الأنوية والذاكرة والتذبذب
│   │   │   ├── user_service.py           # حوكمة مستخدمي ويندوز وصلاحيات RDP
│   │   │   ├── storage_service.py        # فحص القرص C:\ ومجلدات المستخدمين
│   │   │   ├── governor_service.py       # تفريغ خمول الرام (Working Set Trim)
│   │   │   ├── port_isolation_service.py # درع عزل وحجز المنافذ الآلي
│   │   │   ├── bastion_service.py        # حصن النفاذ الموحد وفلتر الأوامر ACL
│   │   └── api/
│   │       └── router.py          # موزع الـ REST API وبث SSE وملفات الـ SPA
│   └── main.py                    # خادم التشغيل المتعدد الخيوط (Port 8765)
│
├── frontend/                      # واجهة React 19 + TypeScript + Vite
│   ├── src/
│   │   ├── zimam-ui/              # مكتبة المكونات والهوية البصرية وخطوط ثمانية
│   │   ├── components/            # مكونات الواجهة ومخطط الأنوية التموجي
│   │   ├── pages/                 # صفحات المنظومة (Overview, Bastion, Governor...)
│   │   └── lib/                   # عميل API الآمن ومطابقة الأنواع
│   └── public/                    # خطوط ثمانية الأصلية وشعارات زِمام
│
├── control_plane/                 # مستوى التحكم المؤسسي /api/v1 (FastAPI)
├── agent/                         # وكيل ويندوز C# للاتصال الصادر
├── launcher/
│   └── launch.vbs                 # المشغل المباشر لسطح المكتب بدون نوافذ سوداء
└── start-server.bat               # مشغل كونسول المطورين
```

---

## 💎 أبرز المزايا المحققة في v2

1. **هوية زِمام البصرية الرسمية الكاملة (Zimam UI Kit)**:
   * مكتبة `src/zimam-ui/` متزامنة مع القالب الرسمي من `AI-ZIMAM/skills`: خط Thmanyah (Sans + Serif Display + Serif Text)، رموز الذهبي/الرمل، أسطح الزجاج السائل، ثيم فاتح وداكن، وواجهة عربية RTL أولاً.
   * متجاوبة بالكامل: شريط تنقل سفلي وقائمة للهواتف ≤900px، وجداول أفقية التمرير، وأهداف لمس ≥44px.

2. **حصن الوصول الموحد JumpServer PAM Bastion (`/bastion`)**:
   * دعم 8 بروتوكولات سيادية للوصول عن بُعد: `RDP`, `SSH`, `SFTP`, `VNC`, `Telnet`, `WinRM`, `Database SQL Web Client`, `Kubernetes Pods`.
   * فلتر اعتراض الأوامر التدميرية بالتعابير النمطية (Command Risk ACL Regex Firewall) لمنع `rm -rf /` أو `format c:` قبل التنفيذ.

3. **راسم الذبذبات التزامني لأنوية المعالج (GNOME System Monitor / Laptop view)**:
   * رسم بياني زمني حي لآخر 60 ثانية لمصفوفة الأنوية الـ 8 بمنحنيات بيزيه فائقة النعومة وتحديث لحظي 1s عبر SSE.
   * مصفوفة دليل الأنوية ومؤشرات الاستهلاك اللحظية.

4. **تصفير استدعاءات النوافذ السوداء (Zero CMD / Zero Terminal Popups)**:
   * استبدال كامل لأوامر `tasklist` و `quser` بـ Native Win32 Ctypes في الذاكرة.
   * عدم ظهور أو وميض أي نافذة كونسول على الإطلاق أثناء عمل السيرفر.

5. **حل مشكلة الصلاحيات ورفض الوصول `Access Denied Error 5`**:
   * التحقق الآلي من الصلاحيات وطلب الترقية كمسؤول بسلاسة عبر اختصار سطح المكتب `ZIMAM v2.lnk`.
   * زر ترقية فوري `/api/system/elevate` يرفع السيرفر دون إيقاف الخدمات.

6. **خوارزمية عزل وحجز المنافذ الآلية (Port Isolation Engine)**:
   * فحص آلي للمنافذ المشغولة وربط المنفذ بجلسة المستخدم المحددة.
   * منع تداخل المشاريع بين المستخدمين المختلفين وتعيين منافذ بديلة تلقائياً.

---

## 🚀 طريقة التشغيل

### تشغيل سطح المكتب (موصى به للمستخدم النهائي):
* النقر المزدوج على اختصار سطح المكتب: **`ZIMAM v2.lnk`**.
* يفتح التطبيق مباشرة في نافذة مخصصة بحجم كامل دون شريط عناوين المتصفح.

### تشغيل المطورين (Developer Console):
```cmd
start-server.bat
```
أو عبر بايثون:
```bash
cd backend
python main.py
```
ثم فتح المتصفح على: `http://127.0.0.1:8765/`
* لوحة القيادة الرئيسية: `http://127.0.0.1:8765/`
* حصن الوصول على: `http://127.0.0.1:8765/bastion`

### Control Plane المؤسسي (`/api/v1`):
```powershell
.\run_zimam.ps1
```
يشغّل الواجهة على `http://127.0.0.1:8876/` مع جسر بروكسي للـ API القديم — راجع `CONTROL_PLANE.md`.
