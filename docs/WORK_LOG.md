# سجل العمل — ZIMAM / ASAAS-Server-Control-v2

> توثيق كامل لكل ما تم إنجازه في هذه المحادثة، من البداية حتى تاريخه.
> المشروع: `Z:\My projects\ASAAS-Server-Control-v2` — لوحة تحكم سيرفرات Windows باسم **زِمام / ZIMAM**.

---

## 1. الرؤية العامة

تحويل المشروع إلى منتج Windows سيرفر-كنترول نظيف واحترافي:

- هوية موحّدة **ZIMAM / زِمام** (بديل ASAAS)
- واجهة أمامية عربية RTL احترافية + إنجليزية LTR
- ثيم فاتح/داكن
- بيانات حقيقية فقط — بدون أرقام وهمية أو أزرار ميتة
- أمان: البورتات المحلية مقفلة على loopback، المصادقة عبر control plane
- ترحيل تدريجي من `/api/*` القديمة إلى `/api/v1`
- بدون Docker (بناءً على طلب صريح)

---

## 2. مراحل العمل الرئيسية

### المرحلة 1 — الفحص الشامل والتدقيق

- فحص المشروع كامل من الألف للياء: الواجهات، الـ backend، الـ control plane، الـ agent، الـ launcher، الـ packaging
- اكتشاف مشاكل كثيرة: واجهات بدون تنسيقات، بيانات وهمية، جداول تتداخل، بورت مكشوف على الشبكة، حسابات دخول معطلة، إلخ
- بناء خطة عمل شاملة

### المرحلة 2 — إعادة تسمية الهوية وتوحيدها

- تحويل الاسم المعروض من ASAAS إلى **ZIMAM / زِمام** في كل الواجهات والنصوص
- توحيد الهوية في v1 (control plane)
- إعادة تسمية كاملة للمنتج

### المرحلة 3 — الواجهة الأمامية (أكبر جزء)

#### 3.1 تطبيق هوية `skills/frontend` حرفياً

- مصدر الهوية: `skills/frontend/asaas-ui/template`
- نُسخت الهوية كاملة إلى `frontend/src/zimam-ui`:
  - `styles/tokens.css` — متغيرات الألوان/الخطوط
  - `styles/components.css` — مكونات UI
  - `styles/glass.css` — تأثيرات زجاجية
  - `styles/layout.css` — التخطيطات
- ثيمات: فاتح (افتراضي) وداكن دافئ — ألوان حبر/ذهب `#ba9555`/رملي/كريمي
- خطوط: Thmanyah Sans / Thmanyah Serif Display / Thmanyah Serif Text
- أزرار كبسولة `border-radius:999px`
- مفاتيح التخزين: `zimam-theme`، `zimam-lang`
- ملف تهيئة الثيم: `frontend/public/theme-init.js`

#### 3.2 إصلاح التعارضات في CSS

- إزالة طبقة "Signature Luxury" القديمة (~680 سطر overrides) من `app.css` كانت تحارب هوية الـ kit
- إعادة ترتيب الاستيرادات في `main.tsx` بحيث الـ kit يكسب أي تعارض
- إضافة aliases للمتغيرات غير المعرفة (`--font-mono`, `--font-telemetry`, `--nav-active-gradient`, إلخ)

#### 3.3 إصلاح الترميز (Mojibake)

- ملفات `RemoteSession.tsx` و`main.tsx` و`app.css` كانت تحوي نصوصاً عربية تالفة (`Ø§Ù†...`)
- إصلاح عبر سكربت Python UTF-8 — استُعيدت النصوص العربية

#### 3.4 إصلاح مشاكل التخطيط الحقيقية

من فحص `ui-audit.mjs` على 20 صفحة × (desktop 1440px + mobile 390px):

| المشكلة | الحل |
|---|---|
| أزرار تنضغط ويُقطع نصها في toolbars | `flex-shrink: 0` على `.btn` + السماح بالالتفاف |
| جداول تتجاوز إطارها وتكتب فوق المحتوى | تغليف الجداول بـ `.table-wrap` أو `.table` |
| جدول المستخدمين تنهار خلاياه على الموبايل | `tableLayout: fixed` + `minWidth` + توسيع عمود الإجراءات |
| بطاقات Governor تتداخل مع الأرقام | wrapping + ellipsis على الصفوف |
| footer/version يكتب فوق أرقام في Governor | إصلاح تموضع العناصر الثابتة |
| بيانات وهمية في Governor (sqlservr 8,420MB ثابتة) | استبدال بآخر 4 عمليات حقيقية من `processes` مع PID/مستخدم/جلسة + زر تفريغ شغال |

**النتيجة النهائية للتدقيق**: 0 مشاكل على كل الصفحات — desktop وmobile.

#### 3.5 أداة التدقيق

- `frontend/ui-audit.mjs` — سكربت Playwright يفحص كل المسارات ويكتشف: تداخل العناصر، خروج النصوص، ضغط الأزرار، overflow
- تقارير: `frontend/ui-audit-shots/layout-report-desktop.json` + `layout-report-mobile.json`
- يتطلب تسجيل دخول موثّق

---

### المرحلة 4 — الأمان وإخفاء البورتات

#### 4.1 قفل البورت الخلفي على loopback

- **المشكلة**: الـ backend كان يستمع على `0.0.0.0:8765` + `[::]:8765` — أي جهاز على الشبكة يقدر يوصل له
- **الإصلاح**:
  - `backend/app/core/config.py`: الافتراضي صار `127.0.0.1` (مع `ZIMAM_HOST` للتجاوز المتعمد)
  - `launcher/Program.cs`: يمرر `--host 127.0.0.1` صراحة
  - الـ control plane يبقى الواجهة العامة على `127.0.0.1:8876`
- **التحقق**: `netstat` يظهر `127.0.0.1:8765` و`127.0.0.1:8876` فقط — صفر استماع شبكي

#### 4.2 إصلاح "Origin غير مسموح"

- **المشكلة**: الـ SPA على `:8876` والـ proxy كان يمرر ترويسة `Origin` للـ backend على `:8765` → فحص same-origin يرفض
- **الإصلاح**: `legacy_proxy.py` يجرد `Origin`/`Referer` قبل التمرير (اتصال server-to-server)
- **التحقق**: طلب عبر `:8876` بـ Origin متصفح → `204`/`401` بدل `403`

#### 4.3 إصلاح جسر الهوية عبر الـ proxy

- **المشكلة**: الـ backend يستقبل `::ffff:127.0.0.1` (IPv4-mapped IPv6) لكن فحص loopback كان يدور `127.0.0.1` و`::1` فقط → جسر `X-ZIMAM-Proxy-*` ما يشتغل → كل طلب legacy يرجع 401
- **الإصلاح**: إضافة `::ffff:127.0.0.1` للقائمة المسموحة
- **التحقق**: login v1 → 200، ثم `/api/auth/me` عبر الـ proxy → 200 (`admin`, role `admin`)

#### 4.4 اختصارات سطح المكتب لكل المستخدمين

- **المشكلة**: الاختصارات كانت تُنشأ في Public Desktop + All Users Start Menu → تظهر لكل المستخدمين
- **الإصلاح**:
  - `zimam.iss`: `{autodesktop}`/`{group}` → `{userdesktop}`/`{userprograms}`
  - حذف الاختصارات القديمة من Public Desktop وStart Menu المشترك عبر أمر elevated
- **النتيجة**: الاختصارات تظهر فقط لحساب المستخدم الذي نصّب البرنامج

#### 4.5 حسابات الدخول

- كلمة مرور `admin` أُعيد تعيينها في قاعدة التطوير: `Zm-PfgAJS3-9KpA`
- أُنشئ حساب `Abdulghani` بصلاحية admin: `Rockandrollcar123$$$`
- ملاحظة: القواعد منفصلة — قاعدة التطوير `data/control_plane.db` ≠ قاعدة النسخة المثبتة

---

### المرحلة 5 — البيانات الحية والوكلاء

#### 5.1 جلسات RDP الحقيقية

- جدول الجلسات الرئيسي كان يعرض بيانات RDP الحقيقية أصلاً
- المشكلة كانت في قسم "جلسات وكلاء زِمام" — كان فارغاً لأن الوكلاء غير شغالين

#### 5.2 الوكيل المحلي `local-live`

- تسجيل وكيل جديد مباشرة في `control_plane.db` (نفس منطق enroll)
- تشغيل `Zimam.Agent.exe` — heartbeat يرد 200
- jobs مُرسلة ونتائج حقيقية:
  - `session.list` → 8 جلسات
  - `process.list` → 50 عملية
  - `system.info` → معلومات النظام الحية

#### 5.3 تنظيف قاعدة الوكلاء

- حذف وكيلين تجريبيين قدامى: `e2b1b50a70e144828f11c447f095ed4c`، `f9764192101b47e89aeb6a286c7b4811`
- حذف 23 job معلقة عالقة
- النتيجة: وكيل واحد `local-live` (ID: `59056237318e4404a4a0641bcfadc7c3`) — online ببيانات حقيقية

---

### المرحلة 6 — الـ Launcher

#### 6.1 إعادة كتابة `launcher/Program.cs`

- يقتل أي مستمع على المنفذين `8765` و`8876` (يضمن عدم فتح نسخة قديمة)
- يشغّل backend `.venv` على `:8765` + control plane على `:8876`
- يفتح الواجهة في نافذة app مخصصة (`--app`)
- يبقى شغال في الخلفية: إغلاق نافذة المتصفح → يقتل الـ backend والـ control plane
- manifest يتطلب `requireAdministrator`

#### 6.2 البناء

- `launcher/ZimamLauncher.exe` مبني بـ net8.0-windows
- framework-dependent (يحتاج .NET 8 runtime — موجود على الجهاز)

---

### المرحلة 7 — إصلاح مراقبة الجلسات (RDP Shadowing)

أكثر جزء تشخيصاً — 3 مشاكل متتالية:

#### 7.1 "Access is denied"

- **السبب**: `mstsc.exe /shadow` يحتاج صلاحيات administrator — الـ backend كان يعمل بدون elevation
- **الحل**: إعادة تشغيل backend elevated → `/api/health` يُظهر `is_admin=True`

#### 7.2 تفعيل سياسة الـ Shadowing

- استدعاء `/api/sessions/shadow/enable-policy`
- يكتب في الريجستري: `HKLM\SOFTWARE\Policies\Microsoft\Windows NT\Terminal Services`
  - `Shadow = 2` (تحكم كامل بدون موافقة)
  - `fSingleSessionPerUser = 0` (يسمح لنفس المستخدم بأكثر من جلسة — مهم للاختبار)

#### 7.3 الشاشة السوداء (المشكلة الأخيرة)

- **الأعراض**: `mstsc /shadow` يشتغل (نافذة تفتح) لكن الشاشة سوداء بالكامل
- **التشخيص**:
  - `mstsc /shadow` على جلسة المستخدم نفسه → "You cannot shadow your own session" (طبيعي)
  - على جلسة Disconnected → "The specified session is not connected"
  - على جلسة Active أخرى من process elevated → "Viewing ..." — يشتغل!
  - الشاشة السوداء سببها: **RemoteFX/AVC444 codec** — `mstsc /shadow` لا يدعم عرض جلسات تستخدم RemoteFX graphics
- **الحل** (من توثيق Microsoft/community): تعطيل "Use advanced RemoteFX graphics for RemoteApp"
  - `HKLM\SOFTWARE\Policies\Microsoft\Windows NT\Terminal Services\fEnableRemoteFXAdvancedRemoteApp = 0`
  - `HKLM\SYSTEM\CurrentControlSet\Control\Terminal Server\WinStations\RDP-Tcp\fEnableRemoteFXAdvancedRemoteApp = 0`
- **ملاحظة مهمة**: الجلسات المستهدفة تحتاج logoff/logon كامل (مو disconnect) لتأخذ الـ codec الجديد

#### 7.4 مشكلة معروفة متبقية

- الـ endpoint `/api/sessions/shadow` يرجع `ok: true` حتى لو `mstsc` فشل فوراً بخطأ — يحتاج تحسين: فحص الجلسة قبل الإطلاق (Active، مو نفسها، مو Disconnected) + التقاط أخطاء الإقلاع
- Shadow لا يعمل على: الجلسة الحالية، الجلسات Disconnected، جلسة Console

---

### المرحلة 8 — التنظيف الشامل للمشروع

#### 8.1 حذف الزوائد (commit `a318bd8`)

| الفئة | المحذوف |
|---|---|
| سكربتات ترقيع لمرة واحدة | `scripts/` كاملة — 37 ملف `patch_*.py`/`fix_*.py` |
| Docker | `docker-compose.yml` + `control_plane/Dockerfile` |
| مخرجات بناء وسيطة | `build-py/` + `dist-py/` (~210MB) |
| ملفات ASAAS القديمة | `ASAAS-Server-Control-Setup.exe` + `data/asaas_*.db` |
| مجلدات سكراتش | `scratch/`، `unslop/`، `graphify-out/`، `.audit_workspace/` (20MB)، `test-results/` |
| أرشيفات | `skills.zip` + `stitch_*.zip` (~13MB) |
| لوقات وملفات مؤقتة | ~30 ملف `*.log` + `__pycache__` + `i18n-keys/missing` |
| تقارير تدقيق قديمة | `MASTER_AUDIT_REPORT.md` + `multi_agent_autonomous_audit_squad.md` |

#### 8.2 البنية النهائية النظيفة

```
agent/          وكيل Windows C# (19 collector)
backend/        Legacy admin API :8765 (loopback)
control_plane/  v1 API + proxy + SPA host :8876
frontend/       React SPA (هوية kit مطبّقة)
launcher/       ZimamLauncher.exe
packaging/      zimam.iss + install scripts
tools/          build-release.ps1, gen-cert, sign-license
tests/ docs/ skills/   اختبارات + توثيق + مصدر الهوية
data/           runtime فقط (DBs حية + مفاتيح + tls)
dist/ release/ installer-out/   مخرجات البناء
```

**التحقق بعد الحذف**: backend 200، control plane 200، unittests 10/10.

---

### المرحلة 9 — إعادة بناء الـ Release

- Frontend build (Vite) ✅
- PyInstaller: `zimam-backend.exe` (14.3MB) + `zimam-control.exe` (29MB) ✅
- Agent: `Zimam.Agent.exe` (36.7MB) — من الثنائي الموجود (لا .NET SDK متاح للبناء الجديد)
- `release/web/` فيها الواجهة الجديدة بهوية kit
- **Inno Setup غير مثبت** — لم يُبنَ `ZIMAM-Setup-1.0.0.exe` جديد؛ `release/` جاهز ومحدّث

---

## 3. commits Git الرئيسية

| Commit | الوصف |
|---|---|
| `9b0fc3c` | تنظيف ملفات development المتعقبة |
| `9330cdf` | إصلاح Origin غير مسموح + اختصارات سطح المكتب per-user |
| `5e6014c` | إصلاح جسر الهوية `::ffff:127.0.0.1` |
| `5d5242e` | إصلاح تداخل الواجهات (ui-audit) |
| `765d35b` | تطبيق هوية kit حرفياً + إصلاح الترميز |
| `61371e0` | قفل backend على loopback |
| `a318bd8` | تنظيف المشروع الشامل (41 ملف + مجلدات) |

---

## 4. حالة المشروع النهائية

| الطبقة | الحالة |
|---|---|
| Frontend | ✅ ~25 صفحة، هوية kit مطبّقة حرفياً، RTL عربي/إنجليزي، ثيم فاتح/داكن، 0 مشاكل layout |
| Control plane `/api/v1` | ✅ auth+MFA، agents+jobs+results، audit chain، vault، license، fleet summary |
| Guacamole gateway | ✅ RDP/SSH/telnet/vnc مُختبر حي end-to-end |
| Agent | ✅ 19 collector read-only موقّعة Ed25519 — e2e-مُتحقق |
| الأمان | ✅ بورتات loopback فقط، origin fix، proxy bridge fix، per-user shortcuts |
| البيانات | ✅ وكيل `local-live` online ببيانات حقيقية |
| الاختبارات | ✅ 10/10 unittests |
| الـ Release | ✅ binaries محدثة + web payload جديد |
| Installer | ⚠️ Inno Setup غير مثبت — لم يُبنَ installer جديد |

---

## 5. ما تبقى (بصدق)

1. **التحقق النهائي من Shadowing**: إصلاح RemoteFX طُبق — يحتاج جلسة Active أخرى (logoff/logon) للاختبار النهائي. Shadow لا يعمل على الجلسة الحالية أو Disconnected.
2. **تحسين `/api/sessions/shadow`**: إرجاع `ok:true` حتى لو فشل `mstsc` — يحتاج preflight validation + error detection.
3. **Governor/Development pages → v1**: ما زالت على `/api/*` legacy — ترحيل مستقل كبير.
4. **Inno Setup**: تثبيته لبناء `ZIMAM-Setup` جديد بالواجهة المحدّثة.
5. **Agent كخدمة Windows**: `local-live` يعمل كعملية عادية — لا ينجو من إعادة التشغيل (`install-service` متاح).
6. **اختبار الـ installer**: على VM/جهاز نظيف — يدوياً.

---

## 6. بيانات الدخول (بيئة التطوير)

```
الواجهة:     http://127.0.0.1:8876
Backend:     127.0.0.1:8765 (loopback فقط)

المستخدم:    Abdulghani  (admin)
كلمة المرور:  (محفوظة في قاعدة التطوير)

المستخدم:    admin  (admin)
كلمة المرور:  Zm-PfgAJS3-9KpA  (مؤقتة — تُغيّر من الإعدادات)
```

---

*آخر تحديث: بعد commit `a318bd8` + إصلاحات Shadowing/RemoteFX.*
*المشروع: Z:\My projects\ASAAS-Server-Control-v2*
*الاسم التجاري: زِمام / ZIMAM*
*الهوية البصرية: skills/frontend/asaas-ui/template*
*بدون Docker — بناء أصلي Windows.*
