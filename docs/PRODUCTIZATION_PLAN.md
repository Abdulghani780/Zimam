# ASAAS Server Control — خطة تحويل المشروع إلى منتج تجاري

> الهدف: تحويل المستودع الحالي إلى **منتج Appliance** قابل للبيع باشتراكات —
> العميل ينصّب على Windows Server عنده، يدير خوادمه ووكلاءه، ويدفع حسب الباقة.
> القرار المعتمد: نموذج Appliance (بيانات العميل داخلية 100%).

---

## 1. المعمارية المستهدفة للمنتج

```
┌────────────────────────────── جهاز العميل (Windows Server) ──────────────────────────────┐
│                                                                                          │
│  ASAAS Appliance (خدمة Windows واحدة أو أكثر)                                            │
│  ├── asaas-backend.exe      FastAPI :8765  (legacy API + proxy source)                   │
│  ├── asaas-control.exe      FastAPI :8876  (SPA + /api/v1 + proxy + agent channel)        │
│  ├── data/                  SQLite + vault key + backups (مجلد محمي ACL)                  │
│  └── frontend/dist          ملفات static تُقدَّم من الـ control plane                     │
│                                                                                          │
│  ASAAS Agent (خدمة Windows على كل جهاز مُدار)                                             │
│  └── Asaas.WindowsAgent.exe  outbound-only، مهام موقّعة Ed25519                          │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

**مبدأ أساسي**: لا شيء من مكونات التطوير (Python, .NET SDK, Node) يُطلب من العميل —
كل شيء binary/self-contained داخل الـ MSI.

---

## 2. خط الأنابيب — من كود إلى MSI

### 2.1 المكونات القابلة للتغليف

| المكوّن | التقنية الحالية | شكل التوزيع |
|---|---|---|
| Backend | Python 3 + FastAPI (`backend/main.py`) | **PyInstaller onefile exe** (`asaas-backend.exe`) |
| Control Plane | Python + FastAPI + SQLAlchemy (`control_plane/`) | **PyInstaller onefile exe** (`asaas-control.exe`) |
| Frontend | React/Vite `dist/` | static files داخل الـ MSI (لا يحتاج Node) |
| Agent | .NET 10 (`agent/`) | **`dotnet publish -r win-x64 --self-contained`** single exe — بدون .NET runtime |
| SQLite | مدمج في Python | لا يحتاج تثبيت |

### 2.2 أدوات البناء (تُثبَّت على جهاز التطوير فقط)

- `pyinstaller` (للبايثونين)
- `dotnet` SDK 10 (موجود ✅)
- `npm` build (موجود ✅)
- **Inno Setup 6** (مجاني، الأفضل لـ MSI على Windows — Wix أصعب)
- سكربت `tools/build-release.ps1` يوحّد كل الخطوات

### 2.3 محتوى الـ MSI (Inno Setup)

```
C:\Program Files\ASAAS\
├── bin\asaas-backend.exe
├── bin\asaas-control.exe
├── bin\Asaas.WindowsAgent.exe      (للنشر على الأجهزة المُدارة)
├── web\                            (frontend dist)
├── data\                           (يُنشأ عند أول تشغيل، ACL: SYSTEM+Admins فقط)
└── unins000.dat

Windows Services:
├── ASAAS Control Plane   → asaas-control.exe --service
├── ASAAS Backend         → asaas-backend.exe --service
└── (Agent يُثبَّت اختيارياً على نفس الجهاز أو يُوزَّع على الباقي)
```

- الخدمات `Automatic` + `Recovery` (restart on failure)
- قاعدة Firewall: السماح لـ 8876 inbound من localhost فقط (أو subnet محدد اختياري)
- اختصار "ASAAS Console" في Start Menu → يفتح `http://127.0.0.1:8876`
- إضافة/إزالة من Programs and Features بشكل نظيف

### 2.4_FIRST RUN WIZARD_ (صفحة `/setup` في الواجهة)

عند أول إقلاع (علامة `data/.initialized` غائبة):

1. إنشاء حساب admin (اسم + كلمة مرور ≥16 حرف — موجود في bootstrap)
2. إدخال **license key** (أو وضع trial 30 يوم)
3. توليد vault key + agent signing key تلقائياً (موجود ✅)
4. عرض agent install command جاهز للنسخ
5. فحص صحة: DB ✓ / vault ✓ / port ✓

---

## 3. نظام الباقات والاشتراكات

### 3.1 الفكرة — License موقّع Ed25519

نفس بنية توقيع agent jobs الموجودة تُعاد استخدامها:

```json
{
  "license_id": "LIC-2026-XXXX",
  "customer": "شركةExample",
  "tier": "pro",
  "max_agents": 25,
  "max_users": 5,
  "features": ["vault", "policies", "audit", "jit"],
  "issued_at": "2026-11-16T00:00:00Z",
  "expires_at": "2027-11-16T00:00:00Z",
  "grace_days": 30
}
```

- **التوقيع**: مفتاح خاص عندك (أنت البائع) — **عام** يُضمَّن في المنتج
- **التحقق**: محلي 100% — offline يعمل، لا phone-home إجباري
- **التفعيل**: لصق الـ key في `/setup` → يُحفظ في `data/license.json` + audit event
- **التجديد**: ملف جديد بنفس الـ license_id يمدد expires_at

### 3.2 الباقات المقترحة

| | **Starter** | **Pro** | **Enterprise** |
|---|---|---|---|
| Agents | 5 | 25 | غير محدود |
| مستخدمون | 1 (admin) | 5 | غير محدود |
| الميزات | monitoring + agents + audit | + vault + policies + backup | + JIT + bastion + replay + SSO لاحقاً |
| الدعم | community | email | dedicated |
| السعر المقترح | $49/شهر أو $490/سنة | $149/شهر | custom |

### 3.3 نقاط الفرض (Enforcement) — كلها في `control_plane`

| الحد | أين يُفرض | السلوك عند التجاوز |
|---|---|---|
| `max_agents` | `POST /agents/enroll` | 403 + رسالة ترقية |
| `max_users` | `POST /users` | 403 + رسالة ترقية |
| `features` | middleware على الـ endpoints | 402/403 + upgrade prompt في UI |
| `expires_at` | middleware عام | بعد grace → read-only mode (لا يوقف الخدمة — أمان العمليات أولاً) |

**قاعدة ذهبية**: انتهاء الرخصة **لا يوقف** المراقبة/التحكم — يتحول لوضع read-only مع banner واضح. أداة إدارة طوارئ ما تنطفئ أبداً.

### 3.4 التفعيل والتجديد (اختياري — Phase لاحقة)

- **Offline أولاً** (ملف موقّع) — يكفي للإطلاق
- لاحقاً: portal ترخيص على موقعك (license.asaas.example) — توليد/تجديد تلقائي للعملاء المتصلين
- telemetry opt-in فقط (عدد agents، إصدار المنتج) — بلا بيانات حساسة

---

## 4. الفجوات مقابل الحالة الحالية

| # | الفجوة | الحالة الآن | المطلوب |
|---|---|---|---|
| 1 | تشغيل يدوي (`run_asaas.ps1`) | يدوي | Windows Services + auto-start ✅ قابل |
| 2 | لا installer | لا يوجد | Inno Setup script + build pipeline |
| 3 | لا license | لا يوجد | `license.py` + Ed25519 verify + middleware |
| 4 | Python/.NET dependencies على جهاز العميل | مطلوبة | PyInstaller + self-contained publish |
| 5 | HTTP فقط (localhost) | HTTP | TLS عبر reverse proxy أو Kestrel — Phase 2 |
| 6 | First-run wizard | bootstrap API موجود | صفحة `/setup` + flow |
| 7 | Agent distribution | exe محلي | نفس الـ exe داخل MSI + `agent install` command |
| 8 | Agent auto-update | يدوي | Phase 3: signed update package عبر نفس قناة المهام |
| 9 | وثائق | جزئية | INSTALL.md + ADMIN_GUIDE.md + LICENSE_TERMS |
| 10 | بوابات 501 (guacd/recordings/AD) | غير منفذة | تُطلق كـ " roadmap" — لا تمنع البيع؛ نضعها Enterprise لاحقاً |

---

## 5. خارطة الطريق — المراحل

### Phase A — أساس المنتج (الأولوية القصوى)

1. `tools/build-release.ps1` — يبني frontend + PyInstaller للبايثونين + agent publish + يتحقق من المخرجات
2. `packaging/asaas.iss` — Inno Setup script كامل (services + firewall + start menu + data ACLs)
3. `asaas_control/license.py` — نموذج License + تحقق Ed25519 + `GET /api/v1/license` + `POST /api/v1/license/activate`
4. `asaas_control/entitlements.py` — middleware يفرض max_agents/max_users/features + read-only expiry mode
5. First-run `/setup` wizard في الواجهة (شروط: DB فارغة + لا license)
6. `tools/sign-license.py` — أداة لك (البائع) لتوقيع licenses

**معيار الخروج**: MSI يُثبَّت على جهاز Windows نظيف → خدمات تعمل → `/setup` → license trial → agents تُسجَّل → كل شيء بدون Python/Node/.NET

### Phase B — صلابة الإنتاج

7. TLS: شهادة داخلية تلقائية (self-signed CA محلي) أو توثيق Let's Encrypt reverse proxy — يُقرَّر حسب نموذج الشبكة
8. Agent installer UX: `Asaas.Agent.Setup.exe` (Inno بسيط) أو `agent.exe install` subcommand — يسجّل service + يطبّق cert
9. Secrets hygiene: vault key + DB ACLs + عدم كتابة secrets في logs (مراجعة)
10. نسخ احتياطي مجدول (موجود backup endpoint — نضيف scheduler بسيط)

### Phase C — نمو الباقات

11. Agent auto-update عبر قناة المهام الموقعة (job type `agent.update` + hash verify)
12. License portal (توليد/تجديد عبر موقع)
13. telemetry opt-in + dashboard "fleet health" عندك كـ vendor
14. guacd gateway / recordings / AD sync — تُضاف كـ Enterprise features لاحقاً

### Phase D — جودة إطلاق

15. e2e CI على الـ MSI المثبَّت (VM نظيف)
16. security review خارجي قبل أول بيع
17. EULA + privacy policy + SLA docs

---

## 6. قرارات تحتاج حسم منك

| القرار | الخيارات | توصيتي |
|---|---|---|
| اسم المنتج التجاري | ASAAS Server Control / ASAAS Fleet / غيره | قرر قبل الـ branding في installer |
| نموذج التسعير | subscription فقط / + perpetual license | subscription فقط — أبسط وأوضح |
| Trial | 30 يوم full features / limited | 30 يوم full — يبيع نفسه |
| التفعيل | offline key فقط / + portal | offline أولاً |
| حد أدنى أجهزة | لا يوجد / 5 agents minimum | لا يوجد — Starter يكفي |
| الدعم | email / portal / Discord | email + docs أولاً |

---

## 7. المخاطر

| الخطر | التخفيف |
|---|---|
| عميل يعدّل ملفات الـ exe | signature check على binaries + licensing tamper-evident |
| تسريب license key | keys موقّعة per-customer + revoke list اختيارية |
| اكتشاف الـ license منطقياً | obfuscation خفيف + verify في أكثر من نقطة (defense in depth) |
| dependence على جهاز واحد | appliance single-node مقبول لـ SMB؛ HA لاحقاً Enterprise |
| منافسة JumpServer/open-source | نبيع simplicity + Arabic support +.local deployment + SLA |

---

## 8. الخطوة التالية المقترحة

**بدء Phase A-1**: `tools/build-release.ps1` + أول PyInstaller build تجريبي
للكشف المبكر عن مشاكل التجميد (hidden imports, static files, data paths).
بعدها A-3/A-4 (license + entitlements) لأنهما يحددان وش يُباع.

> ملاحظة: كل هذا قابل للتنفيذ محلياً بدون خدمات خارجية —
> الـ 501 gates تبقى خارج نطاق الإطلاق الأول.
