# سجل العمل — ASAAS / ASAAS-Server-Control-v2

> توثيق كامل لكل ما تم إنجازه في هذه المحادثة، من البداية حتى تاريخه.
> المشروع: `Z:\My projects\ASAAS-Server-Control-v2` — لوحة تحكم سيرفرات Windows باسم **أساس / ASAAS**.

---

## 1. الرؤية العامة

تحويل المشروع إلى منتج Windows سيرفر-كنترول نظيف واحترافي:

- هوية موحّدة **ASAAS / أساس** (بديل ASAAS)
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

- تحويل الاسم المعروض من ASAAS إلى **ASAAS / أساس** في كل الواجهات والنصوص
- توحيد الهوية في v1 (control plane)
- إعادة تسمية كاملة للمنتج

### المرحلة 3 — الواجهة الأمامية (أكبر جزء)

#### 3.1 تطبيق هوية `skills/frontend` حرفياً

- مصدر الهوية: `skills/frontend/asaas-ui/template`
- نُسخت الهوية كاملة إلى `frontend/src/asaas-ui`:
  - `styles/tokens.css` — متغيرات الألوان/الخطوط
  - `styles/components.css` — مكونات UI
  - `styles/glass.css` — تأثيرات زجاجية
  - `styles/layout.css` — التخطيطات
- ثيمات: فاتح (افتراضي) وداكن دافئ — ألوان حبر/ذهب `#ba9555`/رملي/كريمي
- خطوط: Thmanyah Sans / Thmanyah Serif Display / Thmanyah Serif Text
- أزرار كبسولة `border-radius:999px`
- مفاتيح التخزين: `asaas-theme`، `asaas-lang`
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
| --- | --- |
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
  - `backend/app/core/config.py`: الافتراضي صار `127.0.0.1` (مع `ASAAS_HOST` للتجاوز المتعمد)
  - `launcher/Program.cs`: يمرر `--host 127.0.0.1` صراحة
  - الـ control plane يبقى الواجهة العامة على `127.0.0.1:8876`
- **التحقق**: `netstat` يظهر `127.0.0.1:8765` و`127.0.0.1:8876` فقط — صفر استماع شبكي

#### 4.2 إصلاح "Origin غير مسموح"

- **المشكلة**: الـ SPA على `:8876` والـ proxy كان يمرر ترويسة `Origin` للـ backend على `:8765` → فحص same-origin يرفض
- **الإصلاح**: `legacy_proxy.py` يجرد `Origin`/`Referer` قبل التمرير (اتصال server-to-server)
- **التحقق**: طلب عبر `:8876` بـ Origin متصفح → `204`/`401` بدل `403`

#### 4.3 إصلاح جسر الهوية عبر الـ proxy

- **المشكلة**: الـ backend يستقبل `::ffff:127.0.0.1` (IPv4-mapped IPv6) لكن فحص loopback كان يدور `127.0.0.1` و`::1` فقط → جسر `X-ASAAS-Proxy-*` ما يشتغل → كل طلب legacy يرجع 401
- **الإصلاح**: إضافة `::ffff:127.0.0.1` للقائمة المسموحة
- **التحقق**: login v1 → 200، ثم `/api/auth/me` عبر الـ proxy → 200 (`admin`, role `admin`)

#### 4.4 اختصارات سطح المكتب لكل المستخدمين

- **المشكلة**: الاختصارات كانت تُنشأ في Public Desktop + All Users Start Menu → تظهر لكل المستخدمين
- **الإصلاح**:
  - `asaas.iss`: `{autodesktop}`/`{group}` → `{userdesktop}`/`{userprograms}`
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
- المشكلة كانت في قسم "جلسات وكلاء أساس" — كان فارغاً لأن الوكلاء غير شغالين

#### 5.2 الوكيل المحلي `local-live`

- تسجيل وكيل جديد مباشرة في `control_plane.db` (نفس منطق enroll)
- تشغيل `Asaas.Agent.exe` — heartbeat يرد 200
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

- `launcher/AsaasLauncher.exe` مبني بـ net8.0-windows
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
| --- | --- |
| سكربتات ترقيع لمرة واحدة | `scripts/` كاملة — 37 ملف `patch_*.py`/`fix_*.py` |
| Docker | `docker-compose.yml` + `control_plane/Dockerfile` |
| مخرجات بناء وسيطة | `build-py/` + `dist-py/` (~210MB) |
| ملفات ASAAS القديمة | `ASAAS-Server-Control-Setup.exe` + `data/asaas_*.db` |
| مجلدات سكراتش | `scratch/`، `unslop/`، `graphify-out/`، `.audit_workspace/` (20MB)، `test-results/` |
| أرشيفات | `skills.zip` + `stitch_*.zip` (~13MB) |
| لوقات وملفات مؤقتة | ~30 ملف `*.log` + `__pycache__` + `i18n-keys/missing` |
| تقارير تدقيق قديمة | `MASTER_AUDIT_REPORT.md` + `multi_agent_autonomous_audit_squad.md` |

#### 8.2 البنية النهائية النظيفة

```text
agent/          وكيل Windows C# (19 collector)
backend/        Legacy admin API :8765 (loopback)
control_plane/  v1 API + proxy + SPA host :8876
frontend/       React SPA (هوية kit مطبّقة)
launcher/       AsaasLauncher.exe
packaging/      asaas.iss + install scripts
tools/          build-release.ps1, gen-cert, sign-license
tests/ docs/ skills/   اختبارات + توثيق + مصدر الهوية
data/           runtime فقط (DBs حية + مفاتيح + tls)
dist/ release/ installer-out/   مخرجات البناء
```

**التحقق بعد الحذف**: backend 200، control plane 200، unittests 10/10.

---

### المرحلة 9 — إعادة بناء الـ Release

- Frontend build (Vite) ✅
- PyInstaller: `asaas-backend.exe` (14.3MB) + `asaas-control.exe` (29MB) ✅
- Agent: `Asaas.Agent.exe` (36.7MB) — من الثنائي الموجود (لا .NET SDK متاح للبناء الجديد)
- `release/web/` فيها الواجهة الجديدة بهوية kit
- **Inno Setup غير مثبت** — لم يُبنَ `ASAAS-Setup-1.0.0.exe` جديد؛ `release/` جاهز ومحدّث

---

## 3. commits Git الرئيسية

| Commit | الوصف |
| --- | --- |
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
| --- | --- |
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
4. **Inno Setup**: تثبيته لبناء `ASAAS-Setup` جديد بالواجهة المحدّثة.
5. **Agent كخدمة Windows**: `local-live` يعمل كعملية عادية — لا ينجو من إعادة التشغيل (`install-service` متاح).
6. **اختبار الـ installer**: على VM/جهاز نظيف — يدوياً.

---

## 6. بيانات الدخول (بيئة التطوير)

```text
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
*الاسم التجاري: أساس / ASAAS*
*الهوية البصرية: skills/frontend/asaas-ui/template*
*بدون Docker — بناء أصلي Windows.*

---

## 7. عكس الهوية: ZIMAM → ASAAS الرسمي (2026-11-17)

> بقرار المستخدم: إلغاء مسار ZIMAM بالكامل والعودة للهوية الرسمية للشركة من `github.com/AI-ASAAS/skills`.

### 7.1 الهوية البصرية

- مزامنة `skills/frontend/asaas-ui` مع GitHub — النسخة المحلية مطابقة لـ HEAD (فرق CRLF فقط)
- استبدال `frontend/src/zimam-ui` (النسخة المعدّلة "الداكنة السيادية") بـ `frontend/src/asaas-ui` الرسمي حرفياً
- نقل `ui/Table.tsx` المحلي (غير موجود في الرسمي) + إضافة exports في `index.ts`
- نقل امتدادات API المحلية المطلوبة من الصفحات إلى مكونات الكيت الرسمية: `Button.iconNode` + variant aliases، `Modal.open`، `Field required/error` + render-prop، `TextInput/PasswordInput error`، `Toast` tones info/warn
- `frontend/public/theme-init.js` → الرسمي (فاتح افتراضي، داكن محفوظ) — إلغاء الافتراضي الداكن
- استعادة `src/tokens/design-tokens.css` (طبقة الدلالات التي يستخدمها app.css) + ربطها في `tokens.css`؛ حذف `design-tokens.json`-meta القديمة واستبدالها
- إصلاح `caret-color: var(--primary)` → `var(--accent)` — آخر متغير ناقص
- `index.html`: عنوان ووصف BASIS → أساس / ASAAS

### 7.2 عكس التسمية في كامل المشروع

| المجال | التغيير |
| --- | --- |
| Frontend | `zimam-ui`→`asaas-ui`، `زِمام`→`أساس`، `ZIMAM`→`ASAAS`، `Zimam.Agent`→`Asaas.Agent`، storage keys → `asaas-*` |
| Backend | `ZIMAM_HOST/PORT` → `ASAAS_HOST/PORT` (fallback للاسم القديم)، logger `asaas.*` |
| Control plane | حزمة `zimam_control` → `asaas_control` + كل الـ imports |
| Cookies/Headers | `zimam_v1_session`→`asaas_v1_session`، `X-ZIMAM-Proxy-*`→`x-asaas-proxy-*` |
| DB | `zimam_v2.db` → `asaas_v2.db` + ترحيل تلقائي عند الإقلاع |
| Agent | `Zimam.Agent.csproj` → `Asaas.Agent.csproj`، `ASAAS_*` env vars، خدمة `ASAAS Windows Agent` |
| Launcher | `ZimamLauncher` → `AsaasLauncher`، manifest/اختصارات محدّثة |
| Packaging | `zimam.iss` → `asaas.iss` → `ASAAS-Setup-{ver}.exe`، `asaas-backend.exe`/`asaas-control.exe` |
| CI/Tests/Docs | `.github/workflows/ci.yml`، `tests/`، `docs/`، `tools/`، سكربتات التشغيل |

### 7.3 التحقق

- `npm run build` ✅ (tsc + vite نظيف)
- `oxlint` ✅ (تحذيران قديمان فقط)
- `python -m unittest` — 15/15 unit + 10/10 control_plane ✅
- enterprise_v25/v30 (اختبارات live-server) ما زالت 401 — تحتاج خادمًا يعمل بالكود الجديد + كلمة مرور `admin@asaas2026` المزروعة في CI
- **ملاحظة:** الخوادم الشغالة حالياً على :8765/:8876 ما زالت النسخة القديمة (ZIMAM) — تحتاج إعادة تشغيل لتحميل الكود الجديد

### 7.4 commits

| Commit | الوصف |
| --- | --- |
| (هذا الالتزام السابق) | `feat(ui): restore official ASAAS identity` — الكيت + النصوص |
| (هذا الالتزام) | `refactor: rename product identity ZIMAM -> ASAAS` — backend/agent/launcher/packaging |
| 2026-10-19 | الخطة | تحديث `PROJECT_MAP.md` (خريطة كاملة + قاعدة "أول ⬜ بالأولوية")؛ تنفيذ متسلسل: password complexity (تغيير كلمة المرور في Windows)، `restart-elevated.ps1`، e2e CI موجود مسبقاً، `/api/v1/sessions` مربوط بـ agent `session.list` + terminate بـ signed `session.logoff` job (202)، `/api/sessions/shadow` preflight حقيقي | اختبارات الوحدة 15/15 + control_plane 10/10 ✅ — enterprise live tests تفشل لغياب خادم حي/كلمة مرور `admin@asaas2026` (pre-existing) |
| 2026-11-17 | الخطة | fleet sessions في ControlPage صارت تفاعلية: زرّي disconnect/logoff لكل جلسة وكيل → `POST /api/v1/sessions/{terminate,disconnect}` (jobs موقّعة Ed25519، 202 queued) + `apiV1.disconnectSession`؛ agent يدعم `session.disconnect` عبر WTSDisconnectSession P/Invoke | build ✅ — C# agent غير متحقق محلياً (لا .NET 10 SDK) |
| 2026-11-18 | الخطة | ترحيل تبويبات `InfrastructurePage` إلى fleet collectors: roles→`windows.features`، services→`service.list`، tasks→`scheduled.tasks`، updates→`hotfix.list` — جداول مجمّعة عبر الأسطول بعمود «الوكيل» + بحث/فلاتر client-side + حالات فارغة صادقة لكل وكيل؛ تبويب الشهادات يبقى على `/api/*` (لا collector بعد) | `npm run build` ✅ — C# agent بُني نظيفاً بـ SDK 10.0.402 المحلي |

---

## 8. ترحيل InfrastructurePage إلى fleet collectors (2026-11-18)

### 8.1 ما تغيّر

**الواجهة (`frontend/src/pages/InfrastructurePage.tsx`)**

- التبويبات الأربعة صارت تقرأ من `apiV1.fleetSummary()` + `agentLatestResults()` بدل `api.getRoles/getServicesList/getTasksList/getUpdates`:
  - **أدوار وميزات** ← `windows.features` (DISM `/english` — `items[{name,state}]`؛ installed=`Enabled*`، available=`Disabled`)
  - **خدمات Windows** ← `service.list`
  - **مهام مجدولة** ← `scheduled.tasks` (`TaskName/TaskPath/State`)
  - **تحديثات** ← `hotfix.list` (`id/description/installed_on`، آخر 50 مرتبة تنازلياً)
- كل تبويب = جدول مجمّع عبر كل الوكلاء بعمود «الوكيل» (الاسم + hostname + last-collection في tooltip) — نفس نمط `sessionRows`/`procRows` في ControlPage.
- إضافة `asItemArray()`: `PsProbe` يُسلسل الصف الواحد ككائن عارٍ بدل مصفوفة — يُغلَّف تلقائياً مع استثناء أغلفة `{count, items, observed_at}`.
- `serviceRows()` يقبل الآن كائناً عارياً (حالة عنصر واحد) كـ fallback.
- **إزالة أزرار التحكم** (start/stop/restart للخدمات، تثبيت/إزالة الأدوار + Modal): الـ agent collectors read-only فقط — لا توجد job types للكتابة في `ALLOWED_JOB_TYPES` ولا في `AllowedJobs` بالوكيل. الواجهة الآن صادقة: عرض فقط.
- تحديث البيانات: زر «تحديث» يستدعي `loadFleetNet()` + `fetchCerts()` عند تبويب الشهادات؛ polling كل 60 ثانية مثل ControlPage.
- حالات فارغة صادقة لكل وكيل: «لم يُرسل الجامع بعد» / خطأ الجامع / عرض خام JSON عند استلام نتيجة غير قابلة للاستخراج + رابط «إدارة الوكلاء».
- تبويب **الشهادات** لم يُرحَّل — لا يوجد collector لها بعد، ويبقى على `api.getCertificatesList()`.

**الوكيل (`agent/Program.cs`)**

- `service.list` كان `sc.exe query` يُرجع `{name}` فقط (بلا حالة/نوع بدء/اسم عرض) — استُبدل بـ `Get-Service` عبر `PsProbe` يُصدر `{name, display_name, status, start_type}` (حتى 300 خدمة) — يطابق مفاتيح `serviceRows` مباشرة. حُذف `ServiceProbe` (لم يعد مستخدماً).
- **إصلاح bug**: `session.disconnect` كان مُعالجاً في `ExecuteJob` ومسموحاً في control plane لكن **غائباً عن `AllowedJobs`** — كانت jobs الفصل ستُرفض. أُضيف للقائمة.

### 8.2 التحقق

- `dotnet build agent/` ✅ — 0 warnings/errors (SDK 10.0.402 في `%LOCALAPPDATA%\Microsoft\dotnet`)
- `npm run build` (tsc + vite) ✅ — نُفّذ عبر junction لـ `node_modules` المستودع الرئيسي (worktree بلا تثبيت)
- `oxlint` ✅ — نفس التحذيرين القديمين فقط (`ui-audit.mjs` vh، `AssetsPage.tsx` `?? {}`)
- **ملاحظة**: `service.list` الجديد يتطلب إعادة بناء `Asaas.Agent.exe` ونشره على الوكلاء؛ الوكلاء القدامى يستمرون بإرجاع `{name}` فقط (الواجهة تتعامل مع الحالتين).

### 8.3 الخطوة التالية

- `SecurityPage` → `firewall.state` collector (الخطوة 3 في `PROJECT_MAP.md` §10)

---

## 9. SecurityPage firewall.state + NetworkStoragePage disk.list (2026-11-18)

### 9.1 SecurityPage — عرض منظم لحالة جدار الحماية لكل وكيل

- `firewall.state` كان يُعرض كـ JSON خام داخل `<details>` — صار يُعرض مهيكلاً: بطاقة لكل وكيل فيها صفوف profiles (`profile / enabled / rule_count`) + «آخر قياس» + حالة خطأ.
- بقية الصفحة (blocklist، command risk، security event stream) تبقى على `/api/*` — لا توجد collectors لها.

### 9.2 NetworkStoragePage — volumes → disk.list

- تبويب **وحدات التخزين** استُبدل `api.getVolumes()` (Get-Volume) بجدول مجمّع عبر الوكلاء من `disk.list` — أعمدة: الوحدة، الوكيل، السعة، المتاح، شريط نسبة الشغور، آخر قياس. حالة فارغة صادقة («أرسل disk.list من صفحة الوكلاء»).
- جلب موحّد `fetchFleetAgents`: يجلب `shares.list` + `disk.list` لكل وكيل في مسار واحد (polling كل 60 ثانية)؛ بطاقة مشاركات الوكلاء حُدّثت للبنية الجديدة.
- **ports → ports.list**: منفّذ مسبقاً في `PortsPage` (بطاقات منافذ لكل وكيل proto/addr/process/pid) — لا حاجة لعمل هنا.
- **أبقي عمداً على `/api/*`**: تبويب الأقراص الفيزيائية (Get-Disk — لا collector له)، إنشاء/حذف المشاركات، file explorer، adapters، firewall rules، diagnostics — كلها ميزات سيرفر محلي.

### 9.3 التحقق

- `npm run build` (tsc + vite) ✅
- `oxlint` ✅ — نفس التحذيرين القديمين فقط

---

## 10. Phase 0.6/0.7 — تغطية e2e للموبايل/الـ viewports (2026-11-18)

- وُجد مسبقاً: `mobile-responsiveness.spec.ts` (390px: tabbar/drawer/no-overflow على `/` فقط) و`visual-audit.spec.ts` (screenshots 13 صفحة @ desktop).
- **أُضيف `frontend/e2e/viewport-matrix.spec.ts`**: فحص horizontal overflow لكل الصفحات عند 375/768/900/1280px + تحقق `.mobile-tabbar` ظاهر ≤900px ومخفي >900px + مصفوفة screenshots كاملة 375/768/1280 × light/dark → `docs/visual-audit-screenshots/matrix/`.
- **لم تُشغَّل بعد** — تتطلب backend حي على `:8765` (كان متوقفاً وقت الكتابة). بعد توفر الخادم: `npx playwright test viewport-matrix` ثم تعليم 0.6/0.7 في PROJECT_MAP.

---

## 11. إعادة بناء release/ (2026-11-18)

- `tools/build-release.ps1` نُفّذ على الـ worktree بعد عمل junctions:
  - `.venv` → `.venv` المستودع الرئيسي (PyInstaller 6.22.3 موجودة فيه)
  - `node_modules` → الرئيسي (من جلسة سابقة)
  - `dotnet` → SDK محلي `%LOCALAPPDATA%\Microsoft\dotnet` (PATH system فيه runtime فقط)
- النتائج في `release/` (gitignored): `bin/asaas-backend.exe` 14.3MB، `bin/asaas-control.exe` 42.3MB (PyInstaller onefile)، `bin/Asaas.Agent.exe` 36.7MB + `libsodium.dll` (dotnet publish win-x64 self-contained single-file)، `web/` (vite dist)، `data/`.
- **متبقٍ في Phase 6**: Inno Setup (`ISCC` غير مثبت — blocker بيئي)، اختبار تثبيت على VM نظيف.

### 11.1 متابعة — Inno Setup وُجد محلياً

- Inno Setup 6.7.3 مثبت في `%LOCALAPPDATA%\Programs\Inno Setup 6` (ليس Program Files) — `winget list` أكد.
- `ISCC.exe packaging\asaas.iss` نجح في 23.6s → `installer-out\ASAAS-Setup-1.0.0.exe` (**75.7MB**، gitignored).
- تحذير Inno غير حرج: `PrivilegesRequired=admin` مع per-user areas — مراجعة اختيارية لاحقاً.
- **المتبقي الوحيد في Phase 6**: اختبار التثبيت على VM نظيف.

---

## 12. Phase 5 — Redis tokens + mTLS issuance (2026-11-18)

### 12.1 Redis-backed token consumption

- `ConnectionTokenStore._used` كان set في الذاكرة — غير آمن عبر multi-worker.
- الآن: `ASAAS_REDIS_URL` → استهلاك nonce ذرّي `SET NX EX`؛ بدونها fallback للذاكرة (single-worker فقط). `redis>=5,<7` في requirements. 10/10 tests ✅

### 12.2 mTLS issuance

- `control_plane/asaas_control/mtls.py` جديد: CA محلي ECDSA P-256 تحت `ASAAS_MTLS_DIR` (افتراضي `data/pki`) — `ca.crt/ca.key` (key بـ0600) + شهادات مصدرة في `issued/`.
- Endpoints (admin فقط): `GET /pki/status`، `POST /pki/ca`، `POST /pki/ca/rotate` (أرشفة القديمة)، `GET /pki/ca.crt`، `POST /agents/{id}/cert` → PEM bundle + حفظ على القرص + audit.
- **تحقق**: `ensure_ca` + `issue_client_cert` جُرّبتا فعلياً (serial/expiry صحيحان)؛ 10/10 control_plane tests ✅.
- **متبقٍ كنشر**: إنفاذ client-cert على الـ TLS terminator (proxy/uvicorn) + تحميل الوكيل لشهادته — موثق في CONTROL_PLANE.md.

### 12.3 SSH/SFTP proxy data path

- SSH الطرفي كان يعمل عبر guacd gateway. **SFTP data path** نُفّذ:
  - `asaas_control/sftp.py`: جلسات paramiko server-side (in-memory، TTL 15 دقيقة، lazy import — بدون paramiko يرجع 503).
  - Endpoints `/api/v1/sftp/*`: `POST /session` (يفتح paramiko SFTP ببيانات الاعتماد من الـ vault — لا تصل للمتصفح) + list/stat/download/upload/mkdir/rename/delete + `DELETE /session/{id}`.
  - الصلاحيات: فتح الجلسة يتطلب policy بـ action `connect`؛ عمليات الملفات تتطلب action `sftp` (list/stat/download/upload/mkdir/rename/delete)؛ admin يتجاوز كالمعتاد؛ audit على الفتح/الفشل.
  - `paramiko>=3.4,<4` في requirements + ثُبّت في `.venv` (3.5.1).
- **تحقق**: `py_compile` + `import asaas_control.api` ✅ في venv؛ session manager (get/wrong-user/close) ✅؛ 10/10 control_plane tests ✅. اختبار SFTP حي على سيرفر SSH حقيقي متبقٍ.

### 12.4 Screen/terminal recording + replay

- `asaas_control/recording.py`: `SessionRecorder` يلتقط كل instruction من guacd→client أثناء `pump_to_client` في `data/recordings/<id>.jsonl` (JSONL: `{t_ms, instruction}`) + `meta.json` جانبي؛ `ASAAS_GW_RECORD` (افتراضي on).
- `gateway.py`: `pump_to_client(send_text, recorder=...)` — التسجيل لا يعطّل الجلسة الحية (try/except).
- Endpoints: `GET /recordings` (non-admin يرى تسجيلاته فقط)، `GET /recordings/{id}`، `DELETE` (admin)، `WS /recordings/{id}/replay` — يعيد بث التعليمات المسجلة بنفس التوقيت لـ guacamole-common-js (cookie auth عبر `_current_user`).
- **تحقق**: record→list→replay→delete roundtrip فعلي ✅؛ compile+imports+10/10 tests ✅. replay بصري حقيقي يحتاج جلسة guacd حية.

### 12.5 AD/LDAP sync

- `asaas_control/directory.py`: connector عبر `ldap3` (lazy import → 503) — env config: `ASAAS_LDAP_URL` (ldap(s)://)، `ASAAS_LDAP_BIND_DN`/`_PASSWORD`، `ASAAS_LDAP_BASE_DN`، `ASAAS_LDAP_USER_FILTER` (default `(objectClass=user)`)، `ASAAS_LDAP_PAGE_SIZE`.
- جدول `directory_users` الجديد (read model — لا ينشئ حسابات دخول؛ للـ policies/JIT subjects): username/display_name/email/groups/synced_at؛ stale entries تُحذف عند غيابها عن المزامنة.
- Endpoints: `POST /directory/sync` (admin فقط + audit) و`GET /directory/users` (writer+).
- `ldap3>=2.9,<3` في requirements + ثُبّت 2.9.1 في `.venv`.
- **تحقق**: compile + imports + 10/10 tests ✅. مزامنة AD حقيقية تتطلب بيئة domain.

### 12.6 Off-box backup replication

- `asaas_control/replication.py`: `ASAAS_BACKUP_DEST` يدعم `file://`/مسار عادي (يشمل UNC)، `sftp://user@host[:port]/dir` (paramiko + `ASAAS_BACKUP_SFTP_PASSWORD`/`_KEY_PATH`)، `s3://bucket/prefix` (boto3 lazy → RuntimeError بدونها).
- `POST /system/backup` ينسخ تلقائياً عند الضبط — `replication` field في الرد + audit `system.backup.replicate`؛ الفشل يُبلَّغ ولا يُخفى. `GET /system/backup/replication` للتشخيص بدون أسرار.
- `boto3>=1.34,<2` في requirements + ثُبّت 1.44.5.
- **تحقق**: compile + imports + status + 10/10 tests ✅. نسخ فعلي لـ remote حقيقي خطوة نشر.

### 12.7 أول agent write job — `service.control`

- **Agent**: `service.control` في `AllowedJobs` + `ServiceControl(payload)` — `{name, action: start|stop|restart}` عبر `Start-Service`/`Stop-Service -Force`/`Restart-Service -Force` ثم `Get-Service` للتأكيد؛ تحقق من اسم الخدمة (أحرف آمنة فقط) — signed jobs فقط (Ed25519) كالمعتاد.
- **Control plane**: `service.control` في `ALLOWED_JOB_TYPES` — `POST /api/v1/jobs` يوقّع payload.
- **Frontend**: `InfrastructurePage` services tab — عمود «إجراءات» مع أزرار تشغيل/إيقاف/إعادة تشغيل لكل صف (agent_id مضاف لـ `ServiceFleetRow`) → `apiV1.createJob` + toast «ينفذ خلال ~15 ثانية» (polling agent).
- **تحقق**: `dotnet build` 0/0 ✅، `npm run build` ✅، oxlint ✅، 10/10 tests ✅. تنفيذ فعلي يحتاج agent منشور بالجديد + خدمة حقيقية.

### 12.8 ثاني agent write job — `process.kill`

- **Agent**: `process.kill` في `AllowedJobs` + `ProcessKill(payload)` — `{pid}` → `Process.Kill(entireProcessTree)`؛ يرفض pid ≤4 وعملية الوكيل نفسه.
- **Control plane**: `process.kill` في `ALLOWED_JOB_TYPES`.
- **Frontend**: `ControlPage` بطاقات عمليات الوكلاء — زر «إنهاء» لكل صف PID صالح (>4) مع `confirm` → `apiV1.createJob`.
- **تحقق**: dotnet build 0/0 ✅، npm build ✅، 10/10 tests ✅.

### 12.9 ثالث agent write job — `task.control`

- **Agent**: `task.control` في `AllowedJobs` + `TaskControl(payload)` — `{task_name, task_path?, action: run|enable|disable}` عبر `Start-ScheduledTask`/`Enable-ScheduledTask`/`Disable-ScheduledTask` ثم `Get-ScheduledTask` للتأكيد؛ تحقق من الاسم/المسار.
- **Control plane**: `task.control` في `ALLOWED_JOB_TYPES`.
- **Frontend**: `InfrastructurePage` tasks tab — عمود «إجراءات» (تشغيل/تفعيل/تعطيل) لكل مهمة → `apiV1.createJob`.
- **تحقق**: dotnet build 0/0 ✅، npm build ✅، 10/10 tests ✅.

### 12.10 رابع agent write job — `hyperv.power`

- **Agent**: `hyperv.power` في `AllowedJobs` + `HypervPower(payload)` — `{vm_name, action: start|stop|restart|save|pause|resume}` عبر `Start-VM`/`Stop-VM -TurnOff`/`Restart-VM`/`Save-VM`/`Suspend-VM`/`Resume-VM` ثم `Get-VM` للتأكيد؛ تحقق من اسم الآلة.
- **Control plane**: `hyperv.power` في `ALLOWED_JOB_TYPES`.
- **Frontend**: `ContainersPage` تبويب Hyper-V — أزرار تشغيل/إيقاف/إعادة لكل VM في بطاقات الوكلاء (مع confirm) → `apiV1.createJob`؛ حُدّث عنوان البطاقة (لم تعد «قراءة فقط»).
- **تحقق**: dotnet build 0/0 ✅، npm build ✅، 10/10 tests ✅.

### 12.11 خامس agent write job — `share.control`

- **Agent**: `share.control` في `AllowedJobs` + `ShareControl(payload)` — `{action: create|delete, name, path?, description?}` عبر `New-SmbShare`/`Remove-SmbShare -Force` ثم `Get-SmbShare` للتأكيد؛ create يتطلب مساراً مطلقاً؛ تحقق من الاسم.
- **Control plane**: `share.control` في `ALLOWED_JOB_TYPES`.
- **Frontend**: `NetworkStoragePage` بطاقات مشاركات الوكلاء — زر «حذف» لكل مشاركة (مع confirm) → `apiV1.createJob`؛ حُدّث العنوان (لم تعد «قراءة فقط»). الإنشاء متاح عبر API (لا نموذج UI بعد).
- **تحقق**: dotnet build 0/0 ✅، npm build ✅، 10/10 tests ✅.

### 12.12 سادس agent write job — `feature.toggle`

- **Agent**: `feature.toggle` في `AllowedJobs` + `FeatureToggle(payload)` — `{feature_name, action: enable|disable}` عبر `Enable/Disable-WindowsOptionalFeature -NoRestart`؛ يرجع `restart_needed`؛ تحقق من الاسم.
- **Control plane**: `feature.toggle` في `ALLOWED_JOB_TYPES`.
- **Frontend**: `InfrastructurePage` roles/features tab — عمود «إجراءات» (تفعيل/تعطيل مع confirm يوضح احتمال إعادة التشغيل) → `apiV1.createJob`.
- **تحقق**: dotnet build 0/0 ✅، npm build ✅، 10/10 tests ✅.

### 12.13 سابع agent write job — `firewall.rule` (+ جامع `firewall.rules`)

- **Agent**: `firewall.rules` (قراءة) في `AllowedJobs` — `Get-NetFirewallRule` (أول 500 قاعدة: Name/DisplayName/Direction/Action/Enabled/Profile). `firewall.rule` (كتابة) في `AllowedJobs` + `FirewallRuleControl(payload)`:
  - `add`: `{display_name, direction?, rule_action? (allow|block), protocol? (tcp|udp|any), local_port?, remote_address?, profile? (any|domain|private|public)}` → `New-NetFirewallRule` ثم `Get-NetFirewallRule` للتأكيد.
  - `remove|enable|disable`: `{name}` أو `{display_name}` → `Get-NetFirewallRule | Remove/Enable/Disable-NetFirewallRule` ثم قراءة تأكيد.
  - تحقق من كل الحقول (قوائم بيضاء للاتجاه/الإجراء/البروتوكول/الملف، أنماط للمنافذ والعناوين) — signed jobs فقط كالمعتاد.
- **Control plane**: `firewall.rules` + `firewall.rule` في `ALLOWED_JOB_TYPES`.
- **Frontend**: `SecurityPage` بطاقات «درع أساس عن بُعد» — قسم «قواعد جدار الحماية» لكل وكيل (قائمة + تفعيل/تعطيل/حذف مع confirm + نموذج إضافة قاعدة) → `apiV1.createJob('firewall.rule')`؛ `AgentsPage` أضيف `firewall.rules` لقائمة المهام ومجموعة «قياسات» (COLLECTOR_JOB_TYPES).
- **تحقق**: `dotnet build` 0/0 ✅، `tsc -b` + `vite build` ✅، 10/10 control_plane tests ✅. التنفيذ الفعلي يحتاج agent مُعاد نشره بالجديد.

### 12.14 ثامن agent write job — `docker.container` (+ جامع `docker.containers`)

- **Agent**: `docker.containers` (قراءة) في `AllowedJobs` — `docker ps -a --format '{{json .}}'` → ID/Names/Image/Status/State/Ports (فشل CLI/daemon يظهر كخطأ job بصدق). `docker.container` (كتابة) في `AllowedJobs` + `DockerContainerControl(payload)` — `{container, action: start|stop|restart|pause|unpause}` عبر `docker <verb>` ثم `docker inspect --format '{{.State.Status}}'` للتأكيد؛ تحقق من اسم الحاوية.
- **Control plane**: `docker.containers` + `docker.container` في `ALLOWED_JOB_TYPES`.
- **Frontend**: `ContainersPage` تبويب Docker — بطاقة «حاويات وكلاء أساس» لكل وكيل (قائمة + أزرار تشغيل/إيقاف/إعادة/إيقاف مؤقت/استئناف حسب الحالة، مع confirm) → `apiV1.createJob('docker.container')`؛ `AgentsPage` أضيف `docker.containers` للقائمتين.
- **تحقق**: `dotnet build` 0/0 ✅، `tsc -b` + `vite build` ✅، oxlint ✅، 10/10 control_plane tests ✅. التنفيذ الفعلي يحتاج docker CLI على الوكيل + agent مُعاد نشره.

### 12.15 تاسع agent write job — `cert.remove` (+ جامع `cert.list`)

- **Agent**: `cert.list` (قراءة) في `AllowedJobs` — `Get-ChildItem Cert:\LocalMachine\My` (أول 200 شهادة: subject/issuer/thumbprint/تواريخ/has_private_key/friendly_name). `cert.remove` (كتابة) في `AllowedJobs` + `CertRemove(payload)` — `{thumbprint (40|64 hex), store?}` عبر `Get-Item`/`Remove-Item Cert:\LocalMachine\<store>\<thumb>` ثم تأكيد بالغياب؛ قائمة بيضاء للمخازن (My/Root/CA/TrustedPeople/...).
- **Control plane**: `cert.list` + `cert.remove` في `ALLOWED_JOB_TYPES`.
- **Frontend**: `InfrastructurePage` تبويب الشهادات — بطاقة «شهادات وكلاء أساس» لكل وكيل (قائمة + شارة «منتهية» + زر حذف مع confirm) → `apiV1.createJob('cert.remove')`؛ الجدول القديم (local server) بقي أسفله. `AgentsPage` أضيف `cert.list` للقائمتين.
- **تحقق**: `dotnet build` 0/0 ✅، `tsc -b` + `vite build` ✅، oxlint ✅، 10/10 control_plane tests ✅. التنفيذ الفعلي يحتاج agent مُعاد نشره.
### 12.16 عاشر agent write job — `disk.state` (+ جامع `disk.physical`)

- **Agent**: `disk.physical` (قراءة) في `AllowedJobs` — `Get-Disk` (أول 100 قرص: Number/FriendlyName/Model/SerialNumber/size_gb/PartitionStyle/OperationalStatus/HealthStatus/BusType/IsOffline/IsReadOnly). `disk.state` (كتابة) في `AllowedJobs` + `DiskState(payload)` — `{disk_number (int >=0), action: online|offline|readonly|clear-readonly}` عبر `Set-Disk -IsOffline/-IsReadOnly` ثم `Get-Disk` للتأكيد.
- **Control plane**: `disk.physical` + `disk.state` في `ALLOWED_JOB_TYPES`.
- **Frontend**: `NetworkStoragePage` تبويب الأقراص — بطاقة «أقراص وكلاء أساس الفيزيائية» لكل وكيل (قائمة الأقراص مع الصحة/الحجم/حالة offline+readonly + أزرار توصيل/فصل/RO/إزالة RO مع confirm) → `apiV1.createJob('disk.state')`؛ الجدول القديم (السيرفر المحلي) بقي أسفله. `AgentsPage` أضيف `disk.physical` للقائمتين.
- **تحقق**: `dotnet build` 0/0 ✅، `tsc -b` + `vite build` ✅، oxlint ✅، 10/10 control_plane tests ✅. التنفيذ الفعلي يحتاج agent مُعاد نشره.
### 12.17 حادي عشر agent write job — `hotfix.install`

- **Agent**: `hotfix.install` في `AllowedJobs` + `HotfixInstall(payload)` — `{path}` مسار `.msu` محلي على الوكيل (regex: مسار مطلق `C:\` أو UNC، بدون علامات اقتباس/أحرف بدلية) → `wusa.exe /quiet /norestart` مع timeout 10 دقائق؛ exit code 0 = مثبّت، 3010 = مثبّت + reboot مطلوب، غير ذلك خطأ حقيقي يرفع كـ job error — لا نجاح مُختلَق.
- **Control plane**: `hotfix.install` في `ALLOWED_JOB_TYPES`.
- **Frontend**: `InfrastructurePage` بطاقة «أدوار ومهام مجدولة وتحديثات وكلاء أساس» — داخل قسم «آخر التحديثات المثبتة» حقل مسار `.msu` + زر «تثبيت .msu» مع confirm → `apiV1.createJob('hotfix.install')`.
- **تحقق**: `dotnet build` 0/0 ✅، `tsc -b` + `vite build` ✅، oxlint ✅، 10/10 control_plane tests ✅. يتطلب وسم الملف من طرف المشغّل (الوكيل لا يحمّل من الإنترنت) + agent مُعاد نشره.
### 12.18 ثاني عشر agent write job — `startup.program.remove`

- **Agent**: `startup.program.remove` في `AllowedJobs` + `StartupProgramRemove(payload)` — `{key, name}`؛ `key` مقيّد بقائمة بيضاء من 5 مفاتيح Run/RunOnce (HKLM Run/RunOnce/WOW6432Node Run + HKCU Run/RunOnce) و`name` اسم قيمة الريجستري (حتى 512 حرف، مع escaping للفواصل) → `Remove-ItemProperty` ثم تأكيد بالغياب عبر `GetValueNames()`.
- **Control plane**: `startup.program.remove` في `ALLOWED_JOB_TYPES`.
- **Frontend**: `SecurityPage` قسم «برامج بدء التشغيل (Run keys)» — زر «إزالة» أحمر لكل صف مع confirm → `apiV1.createJob('startup.program.remove', {key, name})`.
- **تحقق**: `dotnet build` 0/0 ✅، `tsc -b` + `vite build` ✅، oxlint ✅، 10/10 control_plane tests ✅. يتطلب agent مُعاد نشره.
### 12.19 ثالث عشر agent write job — `local.user`

- **Agent**: `local.user` في `AllowedJobs` + `LocalUserControl(payload)` — `{username, action: enable|disable|remove|create, password?}` عبر `Enable/Disable/Remove/New-LocalUser`؛ username مقيّد بـ regex (1-20 حرف)، الحسابات المدمجة (Administrator/Guest/DefaultAccount/WDAGUtilityAccount) محمية من التعطيل/الحذف، create يتطلب كلمة مرور ≥8 أحرف، كل أمر يتبعه `Get-LocalUser` للتأكيد.
- **Control plane**: `local.user` في `ALLOWED_JOB_TYPES`.
- **Frontend**: `UsersPage` بطاقة «حسابات وكلاء أساس» — أزرار تفعيل/تعطيل/حذف لكل مستخدم (مع confirm، والحذف مخفي للحسابات المدمجة) + صف إنشاء حساب (اسم + كلمة مرور) → `apiV1.createJob('local.user')`؛ أُزيلت صيغة «قراءة فقط» من العنوان.
- **تحقق**: `dotnet build` 0/0 ✅، `tsc -b` + `vite build` ✅، oxlint ✅، 10/10 control_plane tests ✅. يتطلب agent مُعاد نشره.

### 12.20 رابع عشر agent write job — `software.uninstall`

- **Agent**: `software.uninstall` في `AllowedJobs` + `SoftwareUninstall(payload)` — `{name}` يطابق `DisplayName` من مفاتيح Uninstall (HKLM 64/32 + HKCU) بتطابق تام غير حساس لحالة الأحرف؛ يتطلب تطابقاً واحداً فقط (يطلق قائمة اقتراحات عند عدم وجود تطابق تام). ترتيب التنفيذ: `QuietUninstallString` ← رمز منتج MSI عبر `msiexec /x {GUID} /qn /norestart` ← خطأ صريح «لا يوجد مسار إلغاء صامت»؛ timeout 10 دقائق، exit codes 0/3010/1641 مقبولة مع إبلاغ `reboot_required`.
- **Control plane**: `software.uninstall` في `ALLOWED_JOB_TYPES`.
- **Frontend**: `AssetsPage` درج الفحص الميداني — زر «إلغاء» أحمر لكل صف في جدول `software.list` (يظهر فقط عند وجود وكيل مرتبط) مع `window.confirm` → `apiV1.createJob('software.uninstall', {name})`؛ toast «ينفذ على الوكيل خلال ~15 ثانية».
- **تحقق**: `dotnet build` 0/0 ✅، `tsc -b` + `vite build` ✅، oxlint ✅، 10/10 control_plane tests ✅. يتطلب agent مُعاد نشره.

### 12.21 خامس عشر agent write job — واجهة إنشاء مشاركات SMB على الوكلاء

- **Frontend فقط**: `NetworkStoragePage` بطاقة «مشاركات وكلاء أساس» — زر «+ مشاركة» لكل وكيل يفتح modal (اسم + مسار محلي + وصف) مع `window.confirm` → `apiV1.createJob('share.control', {action:'create', name, path, description})`؛ toast «ينفذ على الوكيل خلال ~15 ثانية» ويعيد جلب القياسات بعد 20 ثانية. الـ backend `share.control` (create/delete عبر `New-SmbShare`/`Remove-SmbShare`) والـ collector `shares.list` كانا موجودين مسبقاً.
- **تحقق**: `tsc -b` + `vite build` ✅، oxlint ✅، 10/10 control_plane tests ✅.
