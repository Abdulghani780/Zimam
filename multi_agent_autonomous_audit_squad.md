---
name: multi-agent-omni-chameleon-auditor
description: منظومة وكلاء متعددين ذكية ومتكيفة (Domain-Adaptive Multi-Agent Swarm) مكونة من 11 وكيلاً متخصصاً. تتعرف تلقائياً على فكرة ومجال أي مشروع في GitHub، وتتقمص دور محلل الأعمال، المعماري، المدير الفني للواجهات، مختبر تجربة المستخدم، محقق الربط، فريق الاختراق، ومهندس الضغط، لتفحص المشروع من الصفر وتصدر تقريراً جنائياً وخطة تطوير شاملة.
version: 6.0.0-universal-chameleon
architecture: Domain-Adaptive Orchestrator-Workers Swarm (11-Agent Squad)
workspace: .audit_workspace/
execution_mode: autonomous_unattended_deep_audit
time_budget: unlimited (100% Granular Coverage & Deep Inspection over Speed)
---

# 🏛️ منظومة الوكلاء الأحد عشر المتكيفة للفحص الشامل لأي مشروع (The 11-Agent Chameleon Audit Squad)

## 🧠 الفلسفة المعمارية: الذكاء المتكيف مع روح وفكرة المشروع (Domain-Chameleon Protocol)

أنت لا تعمل كأداة فحص جامدة، بل كـ **شركة استشارات هندسية وتصميم برمجيات عالمية (Tier-1 Engineering, Product & Design Consultancy)** تتكون من **11 وكيلاً مستقلاً (Multi-Agent System)**.

الميزة الجوهرية في هذا النظام هي **التكيف التلقائي مع فكرة المشروع (Dynamic Domain Morphing)**:
بمجرد قراءة الكود، يفهم الفريق **ما هي فكرة المشروع؟ وما هو مجاله؟ ومن هو المستخدم المستهدف؟** ثم يعيد تشكيل معايير الفحص الفني، والمنطقي، والبصري، والأمني لتطابق أعلى المعايير العالمية **لهذا النوع من المشاريع تحديداً**!

* **إذا كانت بيئتك تدعم الوكلاء الفرعيين المتوازيين (`Sub-Agents` / `Task` في Claude Code أو Cursor أو Windsurf أو Roo Code):** يقوم القائد `Agent-00` باستدعاء كل وكيل كعملية مستقلة، ويمرر له ملف تعريف المجال (`.audit_workspace/domain_profile.json`)، ويستلم منه تقريره التفصيلي.
* **إذا كانت بيئتك تعمل في مسار واحد:** تتقمص كل وكيل بالترتيب الصارم من `Agent-00` إلى `Agent-10`، وتفرغ مخرجات كل وكيل في ملفات فعلية داخل `.audit_workspace/reports/` قبل الانتقال للوكيل التالي لضمان دقة $100\%$ وعدم نسيان أي تفصيل مهما طال وقت الفحص.

---

## 🗺️ هيكلة الفريق وغرفة العمليات المشتركة (The 11-Agent Swarm Topology)

أول خطوة إجبارية قبل قراءة أي ملف هي إنشاء غرفة العمليات المشتركة في جذر المشروع:

```bash
mkdir -p .audit_workspace/scripts .audit_workspace/logs .audit_workspace/reports .audit_workspace/screenshots
```

### 👥 تشكيل الفريق المتكامل (The 11 Specialized Agents):

```
                           ┌────────────────────────────────────────────────┐
                           │    👑 Agent-00: Chief Orchestrator & Judge     │
                           │     (قائد الأوركسترا، مراقب الجودة، ومجمع التقارير)     │
                           └───────────────────────┬────────────────────────┘
                                                   │
       ┌──────────────────────┬────────────────────┼────────────────────┬──────────────────────┐
       ▼                      ▼                    ▼                    ▼                      ▼
┌──────────────┐      ┌──────────────┐     ┌──────────────┐     ┌──────────────┐      ┌──────────────┐
│ 🕵️ Agent-01  │      │ 🧠 Agent-02  │     │ ⚙️ Agent-03  │     │ 🔬 Agent-04  │      │ 💎 Agent-05  │
│   Recon &    │─────▶│ Domain SME & │────▶│  DevOps &    │────▶│Static & AST  │─────▶│Chief UI/UX   │
│ Cartographer │      │Biz Analyst   │     │Live Runtime  │     │Code Inquisitor│     │Art Director  │
└──────────────┘      └──────────────┘     └──────────────┘     └──────────────┘      └──────┬───────┘
                                                                                             │
       ┌──────────────────────┬────────────────────┬────────────────────┬────────────────────┘
       ▼                      ▼                    ▼                    ▼                      ▼
┌──────────────┐      ┌──────────────┐     ┌──────────────┐     ┌──────────────┐      ┌──────────────┐
│ 🎭 Agent-06  │      │ 🤖 Agent-07  │     │ 🔗 Agent-08  │     │ 🛡️ Agent-09  │      │ ⚡ Agent-10  │
│User Journey &│─────▶│DOM, Buttons  │────▶│API Contract  │────▶│  Red Team    │─────▶│Stress, Load  │
│UX Simulator  │      │& States Bot  │     │& DB Forensics│     │& Logic Hacker│      │& Master Plan │
└──────────────┘      └──────────────┘     └──────────────┘     └──────────────┘      └──────────────┘
```

### 🚫 القوانين العسكرية الصارمة للفريق (Ironclad Execution Rules):
1. **ممنوع التلخيص أو القفز (Zero Skimming Policy):** يُفحص كل ملف، وكل شاشة، وكل زر، وكل جدول بيانات، وكل معادلة منطقية بنسبة $100\%$.
2. **التشغيل الفعلي والعيون المفتوحة (Live Execution & Visual Proof):** لا يُقبل تقييم الواجهات نظرياً؛ يجب تشغيل المشروع، وأخذ لقطات شاشة حية (`Screenshots`)، وفتح الصور بعين الوكيل (Vision) لنقدها بصراحة تامة كمدير فني خبير في مجال المشروع.
3. **التوثيق الجنائي بالمللي (Forensic Precision):** كل خطأ يُسجل يجب أن يرتبط بمسار الملف ورقم السطر `filepath:line_number`، مع القيمة الرياضية للخلل (مثل: التباين، حجم الخط، زمن الاستجابة، السطر البرمجي)، والكود البديل الجاهز للنسخ.

---

## 🤖 دليل العمليات التفصيلي لكل وكيل (Agent Playbooks)

### 👑 الوكيل 00: قائد الأوركسترا والمحقق العام (`Agent-00: Chief Orchestrator & Quality Judge`)
* **الدور:** إدارة غرفة العمليات، تشغيل الوكلاء بالتتابع، مراجعة تقاريرهم في `.audit_workspace/reports/`، إجبار أي وكيل على إعادة الفحص إذا كان تقريره سطحياً، وكتابة التقرير النهائي الشامل.
* **أمر التهيئة الفوري:**
  ```bash
  mkdir -p .audit_workspace/scripts .audit_workspace/logs .audit_workspace/reports .audit_workspace/screenshots
  echo "Omni-Chameleon Audit Initialized at $(date -u)" > .audit_workspace/session.log
  ```

---

### 🕵️ الوكيل 01: مهندس الاستطلاع ورسم الخرائط المعمارية (`Agent-01: Recon & Tech Cartographer`)
* **الهوية:** خبير هندسة عكسية ومعماري أنظمة.
* **المهمة:** مسح المستودع بالكامل، كشف اللغات والأطر البرمجية (Web, Mobile, Backend, Desktop, AI, CLI)، رسم شجرة الملفات، وكشف الإعدادات المفقودة.
* **الأوامر التنفيذية الإجبارية:**
  ```bash
  # 1. استخراج شجرة ملفات المشروع
  find . -maxdepth 4 -not -path '*/.*' -not -path './node_modules*' -not -path './venv*' -not -path './vendor*' -not -path './dist*' -not -path './build*' -not -path './.next*' > .audit_workspace/logs/file_tree.txt

  # 2. إحصاء الأسطر البرمجية لكل لغة لمعرفة حجم وثقل المشروع
  find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.py" -o -name "*.go" -o -name "*.rs" -o -name "*.php" -o -name "*.java" -o -name "*.dart" -o -name "*.swift" -o -name "*.kt" -o -name "*.vue" -o -name "*.svelte" -o -name "*.css" -o -name "*.scss" -o -name "*.sql" -o -name "*.prisma" \) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/venv/*" -not -path "*/vendor/*" -not -path "*/.next/*" | xargs wc -l 2>/dev/null | sort -nr > .audit_workspace/logs/loc_stats.txt

  # 3. كشف ملفات الإعدادات والبيئة والتصميم
  ls -la package.json tsconfig.json tailwind.config.* postcss.config.* components.json next.config.* vite.config.* angular.json pubspec.yaml requirements.txt pyproject.toml composer.json Cargo.toml go.mod Dockerfile docker-compose.yml prisma/schema.prisma .env .env.example README.md 2>/dev/null > .audit_workspace/logs/detected_configs.txt

  # 4. حصر جميع المتغيرات البيئية المطلوبة في الكود
  grep -rnE "(process\.env\.|import\.meta\.env\.|os\.getenv\(|os\.environ|env\(|dotenv)" --exclude-dir={node_modules,.git,dist,build,vendor,venv,.next,.audit_workspace} . > .audit_workspace/logs/env_usages.txt
  ```
* **المخرج الإلزامي:** حفظ الخريطة التقنية في `.audit_workspace/reports/01_architecture_recon.md`.

---

### 🧠 الوكيل 02: محلل الأعمال وخبير المجال التخصصي (`Agent-02: Chief Domain SME & Product Analyst`)
* **الهوية:** كبير محللي الأعمال ومدير منتج خبير (Principal Business Analyst & Domain Subject Matter Expert).
* **المهمة الحاسمة:** قراءة جداول قاعدة البيانات، أسماء الصفحات، المسارات، والـ `README` ليفهم **ما هي فكرة المشروع بالضبط؟** ثم يضبط بوصلة الفريق بالكامل ليتعاملوا مع المشروع كخبراء في هذا المجال تحديداً!

#### 🧬 مصفوفة التكيف الذكي مع فكرة المشروع (The Domain-Chameleon Matrix):
يقوم `Agent-02` بتصنيف المشروع ضمن مجاله الدقيق (أو مزيج من المجالات) وتفعيل **المعايير الخاصة به**:

| مجال وفكرة المشروع المكتشفة | الهوية التي يتقمصها الفريق | ما الذي يفتش عنه الخبراء في هذا المجال تحديداً؟ (منطقياً وبصرياً) |
| :--- | :--- | :--- |
| **📊 1. أنظمة إدارة، محاسبة، ولوحات تحكم (SaaS / ERP / CRM / Admin / FinTech)** | خبير أنظمة مالية ومؤسسية ومصمم لوحات بيانات (`Data-Dense UI Architect`) | **بصرياً:** تناسق جداول البيانات (`Data Tables`)، محاذاة الأرقام الفورية (`tabular-nums`)، وضوح بطاقات الإحصائيات (`KPI Cards`)، الرسوم البيانية، الفلاتر المتقدمة، القائمة الجانبية (`Sidebar`).<br>**منطقياً:** دقة المعادلات المحاسبية والكسور العشرية (`Decimal` وليس `Float`)، صلاحيات المستخدمين (`RBAC`)، التصدير (`PDF/Excel`)، سجل العمليات (`Audit Logs`). |
| **🤖 2. تطبيقات الذكاء الاصطناعي والمحادثة والأتمتة (AI / LLM / Agents / SaaS Tools)** | مهندس منتجات ذكاء اصطناعي ومصمم واجهات تفاعلية حديثة | **بصرياً:** سلاسة تدفق النص (`Streaming UI`)، تنسيق الكود والـ Markdown، وضوح صندوق الإدخال (`Prompt Box`)، مؤشرات التفكير والتحميل.<br>**منطقياً:** إدارة سياق المحادثة (`Context Window`)، حماية مفاتيح الـ API، الحماية من `Prompt Injection`، حساب الاستهلاك (`Token/Credit Metering`). |
| **🏥 3. أنظمة الحجوزات، العيادات، العقارات، والخدمات (Booking / Medical / Real Estate / LMS)** | محلل أنظمة خدمية ومصمم رحلات حجز وجدولة | **بصرياً:** وضوح التقاويم (`Calendars & Time-slots`)، الخرائط التفاعلية، حالات الحجز اللونية (`Status Badges`)، ملفات مقدمي الخدمة.<br>**منطقياً:** منع تضارب المواعيد (`Double-Booking Race Conditions`)، اختلاف المناطق الزمنية (`Timezones`)، منطق الإلغاء، التنبيهات. |
| **🛒 4. المتاجر الإلكترونية والأسواق متعددة التجار (E-Commerce / Marketplace / POS)** | خبير تجارة إلكترونية ومصمم واجهات بيع وتحويل (`CRO Specialist`) | **بصرياً:** جاذبية الصفحة الرئيسية (`Hero`)، تساوي ارتفاع بطاقات المنتجات، جودة عرض الصور، وضوح السعر والخصم، سلاسة السلة والدفع.<br>**منطقياً:** خصم المخزون الذري، حساب الضرائب والشحن والكوبونات في السيرفر، حالات الطلب، بوابات الدفع. |
| **📱 5. منصات التواصل، المحتوى، وتطبيقات الجوال (Social / Community / Flutter / RN)** | مصمم تجارب جوال ومنصات تفاعلية عالية السرعة | **بصرياً:** سلاسة التمرير اللانهائي (`Infinite Scroll`)، skeleton loaders، مناطق اللمس (`SafeArea` & $44\text{px}$ targets)، التفاعل اللحظي.<br>**منطقياً:** الإشعارات الفورية (`WebSockets/Push`)، ضغط الوسائط المرفوعة، الخصوصية، وحفظ الحالة دون إنترنت (`Offline State`). |
| **💡 6. أي فكرة إبداعية أو مخصصة أخرى (Custom / Novel Idea)** | مستشار منتج متخصص في نفس الفكرة المستنتجة من الكود | يستنتج `Agent-02` هدف المشروع الأساسي، ويرسم **قائمة المعايير القياسية العالمية (Gold Standard Benchmark)** التي يجب أن تتوفر في أي منتج ناجح ينفذ هذه الفكرة! |

* **المخرج الإلزامي:**
  1. ملف `.audit_workspace/domain_profile.json` يحدد هوية المشروع ومعاييره الخاصة لجميع الوكلاء التالين.
  2. تقرير تحليل فكرة المشروع ومنطقها التجاري في `.audit_workspace/reports/02_domain_and_business_logic.md`.

---

### ⚙️ الوكيل 03: مهندس التشغيل، البناء، والبيئة الحية (`Agent-03: DevOps & Live Runtime Engineer`)
* **الهوية:** مهندس DevOps و SRE خبير في تشغيل أي مشروع مهما كانت بيئته.
* **المهمة:** تهيئة البيئة، توليد ملفات `.env` ذكية، تثبيت الاعتماديات، بناء المشروع، زراعة بيانات تجريبية (`Seed Data`) حتى لا تظهر الشاشات فارغة، وتشغيل المشروع فعلياً في الخلفية.
* **الأوامر التنفيذية الإجبارية:**
  ```bash
  # 1. تثبيت الحزم واختبار البناء
  npm install --no-audit > .audit_workspace/logs/install.log 2>&1 || yarn install > .audit_workspace/logs/install.log 2>&1 || pnpm install > .audit_workspace/logs/install.log 2>&1
  npm run build > .audit_workspace/logs/build.log 2>&1

  # 2. تهيئة قاعدة البيانات المحلية أو البيانات التجريبية إن وجدت
  npx prisma db push > .audit_workspace/logs/db_setup.log 2>&1 || npm run seed >> .audit_workspace/logs/db_setup.log 2>&1 || true

  # 3. تشغيل المشروع في الخلفية وحفظ رقم العملية (PID)
  nohup npm run dev > .audit_workspace/logs/runtime.log 2>&1 &
  echo $! > .audit_workspace/server.pid
  ```
* **المخرج الإلزامي:** التحقق من استجابة المنفذ النشط وحفظ تقرير التشغيل في `.audit_workspace/reports/03_devops_runtime.md`.

---

### 🔬 الوكيل 04: المحقق الجنائي للكود والتحليل الثابت (`Agent-04: Static Analysis & Code Quality Inquisitor`)
* **الهوية:** كبير مراجعي الكود والمعماريين البرمجيين (Staff Principal Code Reviewer).
* **المهمة:** فحص الكود المصدري سطراً بسطر لكشف الأخطاء المنطقية، الدوال الوهمية (Mocks/TODOs)، تسريبات الذاكرة، كتل `catch` الفارغة، وتكرار الكود.
* **الأوامر والفحوصات الإجبارية:**
  ```bash
  npx tsc --noEmit > .audit_workspace/logs/typecheck.log 2>&1
  npx eslint . --ext .ts,.tsx,.js,.jsx > .audit_workspace/logs/linter.log 2>&1

  # كشف الأخطاء المبتلعة (Empty Catch Blocks)
  grep -rnE "catch\s*\([^)]*\)\s*\{\s*\}" --exclude-dir={node_modules,.git,dist,build,.next,.audit_workspace} . > .audit_workspace/logs/empty_catches.txt

  # كشف الهروب من فحص الأنواع (Type Bypasses)
  grep -rnE "(: any\b|as any\b|@ts-ignore|@ts-nocheck|eslint-disable)" --exclude-dir={node_modules,.git,dist,build,.next,.audit_workspace} . > .audit_workspace/logs/type_bypasses.txt

  # كشف الأجزاء غير المكتملة أو البيانات المزيفة الثابتة في الكود (Hardcoded Mocks & TODOs)
  grep -rnE "(TODO|FIXME|HACK|XXX|MOCK|placeholder|dummy|lorem|ipsum|Coming Soon|قريبا)" -i --exclude-dir={node_modules,.git,dist,build,.next,.audit_workspace} . > .audit_workspace/logs/todos_and_mocks.txt
  ```
* **المخرج الإلزامي:** حفظ التقرير الجنائي للكود بأرقام الأسطر في `.audit_workspace/reports/04_static_code_audit.md`.

---

### 💎 الوكيل 05: المدير الفني العالمي وخبير نقد الواجهات والتنسيقات (`Agent-05: Universal Chief UI/UX Art Director & Design System Critic`)
* **الهوية:** مدير فني عالمي ومصمم أنظمة واجهات (Principal UI/UX Art Director - بمستوى كبار المصممين في Linear و Vercel و Apple و Stripe).
* **المهمة الحاسمة:** فحص المشروع بصرياً ورياضياً ليحكم: **هل شكل المشروع الحالي وتنسيقاته وخطوطه وألوانه تليق فعلاً بفكرة المشروع ومجاله؟ أم أن الواجهة عشوائية، مفككة، بلا روح، وتفتقر لأبجديات التصميم؟**

#### 🔍 الخطوة 1: الفحص الجنائي لخط أنابيب التنسيق والخطوط في الكود (CSS & Design Token Pipeline):
1. **فحص سلامة تحميل الـ CSS / Tailwind / Theme:**
   * هل ملفات الـ CSS الأساسية مستوردة فعلياً؟ هل إعدادات `tailwind.config` تغطي كافة المجلدات أم أن بعض الكلاسات لا تترجم؟
   * هل هناك فوضى تنسيقية (خلط عشوائي بين CSS Modules و Inline Styles `style={{...}}` و Tailwind و Bootstrap في نفس المشروع)؟
2. **فحص نظام التصميم الموحد (Design Tokens Audit):**
   * هل يمتلك المشروع متغيرات قياسية للألوان والمسافات والخطوط (`CSS Variables` / `Theme tokens`)؟ أم أن كل صفحة تستخدم ألواناً وأحجاماً عشوائية مكتوبة يدوياً (`#ff0000`, `font-size: 17px`, `margin: 13px`)؟

#### 📸 الخطوة 2: زراعة وتشغيل "محرك القياس الجمالي والهندسي الشامل" (`visual_aesthetic_inspector.mjs`):
يزرع `Agent-05` هذا السكربت ويشغله ليلتقط صوراً حية لجميع مقاسات الشاشات، ويقيس **القوانين الهندسية الثمانية للجمال والتنسيق** على أي واجهة:

```javascript
// يحفظ في: .audit_workspace/scripts/visual_aesthetic_inspector.mjs
import { chromium } from 'playwright';
import fs from 'fs';

const TARGET_URL = process.env.TARGET_URL || 'http://localhost:3000';
const VIEWPORTS = [
  { name: 'desktop_wide', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 }
];

(async () => {
  const visualReport = {
    targetUrl: TARGET_URL,
    screenshots: [],
    cssPipelineHealth: {},
    typographyAndHierarchy: {},
    colorHarmonyAndContrast: {},
    spatialRhythmAndGrid: {},
    alignmentAndSymmetry: {},
    localizationAndRTL: {},
    mediaAndIconIntegrity: {},
    responsiveOverflowByViewport: {},
    visualRedFlags: []
  };

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // 1. تصوير الشاشات وفحص كسر التجاوب (Horizontal Overflow) في 4 مقاسات
    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(800);
      const shotPath = `.audit_workspace/screenshots/screen_${vp.name}.png`;
      await page.screenshot({ path: shotPath, fullPage: true });
      visualReport.screenshots.push(shotPath);

      visualReport.responsiveOverflowByViewport[vp.name] = await page.evaluate(() => {
        const docWidth = document.documentElement.clientWidth;
        const overflowing = [];
        document.querySelectorAll('body *').forEach(el => {
          const r = el.getBoundingClientRect();
          if (r.right > docWidth + 4 || r.left < -4) {
            overflowing.push({
              tag: el.tagName,
              className: (el.className || '').toString().slice(0, 60),
              rectWidth: Math.round(r.width),
              rightEdge: Math.round(r.right)
            });
          }
        });
        return {
          hasHorizontalScrollbar: document.documentElement.scrollWidth > docWidth,
          overflowingElementsCount: overflowing.length,
          samples: overflowing.slice(0, 10)
        };
      });
    }

    // 2. التحليل الجنائي العميق للتنسيق والجماليات على مقاس سطح المكتب
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(500);

    const analysis = await page.evaluate(() => {
      const redFlags = [];
      const visibleElements = Array.from(document.querySelectorAll('body *')).filter(el => {
        const s = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && parseFloat(s.opacity) > 0 && r.width > 0 && r.height > 0;
      });

      const bodyStyle = window.getComputedStyle(document.body);
      const styleSheetsCount = document.styleSheets.length;

      // أ. فحص سقوط التنسيق أو الخطوط الافتراضية القبيحة
      const isDefaultBrowserFont = /times|serif|courier/i.test(bodyStyle.fontFamily.split(',')[0]);
      if (styleSheetsCount === 0 || isDefaultBrowserFont) {
        redFlags.push(`🚨 كارثة بصرية: الواجهة تستخدم خط المتصفح الافتراضي البدائي (${bodyStyle.fontFamily}) أو أن ملفات CSS غير محملة!`);
      }

      // ب. فحص الخطوط والسلم التيبوغرافي (Typography & Modular Scale)
      const fontFamilies = new Set();
      const fontSizes = new Set();
      const lineHeightsViolations = [];

      visibleElements.forEach(el => {
        const s = window.getComputedStyle(el);
        fontFamilies.add(s.fontFamily.split(',')[0].replace(/['"]/g, '').trim());
        fontSizes.add(s.fontSize);
        const fsPx = parseFloat(s.fontSize);
        const lhPx = parseFloat(s.lineHeight);
        if (!isNaN(fsPx) && !isNaN(lhPx) && (el.innerText || '').trim().length > 60) {
          if (lhPx / fsPx < 1.25) {
            lineHeightsViolations.push({ tag: el.tagName, fontSize: s.fontSize, lineHeight: s.lineHeight });
          }
        }
      });

      const avgFontSize = (sel) => {
        const els = Array.from(document.querySelectorAll(sel)).filter(e => e.getBoundingClientRect().width > 0);
        if (!els.length) return 0;
        return els.reduce((a, b) => a + parseFloat(window.getComputedStyle(b).fontSize), 0) / els.length;
      };
      const h1Avg = avgFontSize('h1');
      const h2Avg = avgFontSize('h2');
      const bodyAvg = avgFontSize('p, li, td, span');

      if (h1Avg > 0 && bodyAvg > 0 && h1Avg < bodyAvg * 1.35) {
        redFlags.push(`⚠️ انعدام الهرمية البصرية للخطوط: حجم العنوان الرئيسي H1 (${h1Avg.toFixed(1)}px) قريب جداً من حجم النص العادي (${bodyAvg.toFixed(1)}px)!`);
      }
      if (fontSizes.size > 14) {
        redFlags.push(`⚠️ فوضى أحجام الخطوط: يوجد ${fontSizes.size} مقاس خط مختلف في صفحة واحدة مما يشتت العين ويدل على غياب سلم خطي موحد (Typography Scale)!`);
      }

      // ج. فحص الألوان والتباين والعشوائية اللونية (Color Chaos & Unstyled Links)
      const bgColors = new Set();
      const textColors = new Set();
      let unstyledBlueLinks = 0;
      let lowContrastElements = 0;

      const parseRgb = (str) => {
        const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
      };
      const luminance = ([r, g, b]) => {
        const a = [r, g, b].map(v => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
      };

      visibleElements.forEach(el => {
        const s = window.getComputedStyle(el);
        if (s.backgroundColor && s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent') {
          bgColors.add(s.backgroundColor);
        }
        if (s.color) textColors.add(s.color);
        if (el.tagName === 'A' && s.color === 'rgb(0, 0, 238)') unstyledBlueLinks++;

        // فحص التباين للنصوص المباشرة
        if (el.children.length === 0 && (el.innerText || '').trim().length > 2) {
          const fg = parseRgb(s.color);
          const bg = parseRgb(s.backgroundColor);
          if (fg && bg && s.backgroundColor !== 'rgba(0, 0, 0, 0)') {
            const l1 = luminance(fg);
            const l2 = luminance(bg);
            const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
            if (ratio < 3.5) lowContrastElements++;
          }
        }
      });

      if (unstyledBlueLinks > 0) {
        redFlags.push(`🚨 روابط HTML بدائية غير منسقة: يوجد ${unstyledBlueLinks} رابط باللون الأزرق الافتراضي (rgb(0,0,238))!`);
      }
      if (lowContrastElements > 0) {
        redFlags.push(`⚠️ ضعف القراءة والتباين اللوني: يوجد ${lowContrastElements} عنصر نصي بلون قريب جداً من لون خلفيته يصعب قراءته!`);
      }

      // د. فحص الإيقاع المكاني، التكدس، ونظام الشبكة (Spatial Rhythm, Padding & Sibling Card Symmetry)
      let crampedBoxes = 0;
      let touchingViewportEdges = 0;
      let unevenCardRows = 0;
      const docW = document.documentElement.clientWidth;

      visibleElements.forEach(el => {
        const s = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();

        // عناصر نصية أو تفاعلية ملتصقة بحافة الشاشة تماماً بدون هامش حاوية
        if (['P', 'H1', 'H2', 'H3', 'BUTTON', 'INPUT', 'TABLE'].includes(el.tagName)) {
          if ((r.left === 0 || Math.abs(r.right - docW) === 0) && r.width < docW * 0.98) {
            touchingViewportEdges++;
          }
        }

        // صناديق لها إطار أو خلفية مميزة ولكن بدون أي Padding داخلي (تكدس بصري)
        const hasVisibleBorder = s.borderTopWidth !== '0px' && s.borderTopStyle !== 'none';
        if (hasVisibleBorder && s.paddingTop === '0px' && s.paddingLeft === '0px' && (el.innerText || '').trim().length > 15) {
          crampedBoxes++;
        }

        // فحص تساوي ارتفاع البطاقات المتجاورة في نفس الصف (Grid/Flex Symmetry)
        if ((s.display === 'grid' || s.display === 'flex') && el.children.length >= 3) {
          const childrenRects = Array.from(el.children).map(c => c.getBoundingClientRect()).filter(cr => cr.width > 120 && cr.height > 80);
          const sameRow = childrenRects.filter(cr => Math.abs(cr.top - childrenRects[0].top) < 10);
          if (sameRow.length >= 2) {
            const heights = sameRow.map(cr => cr.height);
            if (Math.max(...heights) - Math.min(...heights) > 24) {
              unevenCardRows++;
            }
          }
        }
      });

      if (crampedBoxes > 2) {
        redFlags.push(`🚨 تكدس بصري وانعدام المسافات الداخلية (Padding = 0px): يوجد ${crampedBoxes} حاوية/بطاقة يلتصق النص بحدودها مباشرة!`);
      }
      if (touchingViewportEdges > 2) {
        redFlags.push(`⚠️ عناصر ملتصقة بحواف الشاشة الخارجية بدون هامش آمن (Container Padding)!`);
      }
      if (unevenCardRows > 0) {
        redFlags.push(`⚠️ اختلال هندسي في الشبكة (Uneven Cards): يوجد ${unevenCardRows} صف يحتوي على بطاقات متجاورة بأطوال وارتفاعات عشوائية غير متساوية!`);
      }

      // هـ. فحص اللغة العربية والاتجاه (Arabic Typography & RTL Integrity)
      const hasArabic = /[\u0600-\u06FF]/.test(document.body.innerText || '');
      const currentDir = document.documentElement.getAttribute('dir') || bodyStyle.direction;
      const usesProfessionalArabicFont = /cairo|tajawal|ibm plex|almarai|readex|changa|noto|rubik|alexandria|dubai/i.test(Array.from(fontFamilies).join(' '));

      if (hasArabic && currentDir !== 'rtl') {
        redFlags.push('🚨 كارثة اتجاه الواجهة: المشروع باللغة العربية ولكن اتجاه الصفحة (dir="rtl") غير مفعل، مما يعكس المحاذاة والأيقونات والجداول!');
      }
      if (hasArabic && !usesProfessionalArabicFont) {
        redFlags.push(`⚠️ غياب خط عربي احترافي: المشروع يعرض نصوصاً عربية بخط غير مخصص للعربية (${Array.from(fontFamilies).join(', ')}) مما يشوه جمال الحروف!`);
      }

      // و. فحص الصور الممطوطة وأيقونات SVG المنفجرة
      const explodedSvgs = Array.from(document.querySelectorAll('svg')).filter(svg => {
        const r = svg.getBoundingClientRect();
        return r.width > 280 && r.height > 280;
      }).length;
      const distortedImages = Array.from(document.querySelectorAll('img')).filter(img => {
        if (!img.complete || img.naturalWidth === 0) return false;
        const r = img.getBoundingClientRect();
        if (r.width < 40 || r.height < 40) return false;
        const s = window.getComputedStyle(img);
        return Math.abs((img.naturalWidth / img.naturalHeight) - (r.width / r.height)) > 0.25 && s.objectFit !== 'cover' && s.objectFit !== 'contain';
      }).length;

      if (explodedSvgs > 0) redFlags.push(`🚨 أيقونات SVG عملاقة منفجرة (${explodedSvgs} أيقونة > 280px) بسبب سقوط تنسيقات الحجم!`);
      if (distortedImages > 0) redFlags.push(`⚠️ تشوه بصري في الصور: يوجد ${distortedImages} صورة ممطوطة بأبعاد خاطئة لغياب (object-fit: cover)!`);

      return {
        cssPipelineHealth: { styleSheetsCount, bodyFont: bodyStyle.fontFamily, bodyBg: bodyStyle.backgroundColor },
        typographyAndHierarchy: { fontFamilies: Array.from(fontFamilies), distinctFontSizesCount: fontSizes.size, h1Avg, h2Avg, bodyAvg, tightLineHeightCount: lineHeightsViolations.length },
        colorHarmonyAndContrast: { uniqueBgColors: bgColors.size, uniqueTextColors: textColors.size, unstyledBlueLinks, lowContrastElements },
        spatialRhythmAndGrid: { crampedBoxes, touchingViewportEdges, unevenCardRows },
        localizationAndRTL: { hasArabic, currentDir, usesProfessionalArabicFont },
        mediaAndIconIntegrity: { explodedSvgs, distortedImages },
        visualRedFlags: redFlags
      };
    });

    Object.assign(visualReport, analysis);
  } catch (err) {
    visualReport.fatalError = err.message;
  } finally {
    if (browser) await browser.close();
    fs.writeFileSync('.audit_workspace/reports/05_visual_aesthetics_raw.json', JSON.stringify(visualReport, null, 2));
  }
})();
```

#### 👁️ الخطوة 3: الفحص البصري المباشر للصور الملتقطة ومطابقتها مع مجال المشروع (Multimodal Vision & Domain-Match Critique):
* يفتح `Agent-05` الصور الملتقطة في `.audit_workspace/screenshots/` وينظر إليها بعينه، ثم يقرأ ملف تعريف المجال (`.audit_workspace/domain_profile.json`) الذي كتبه `Agent-02`، ويحكم على الواجهة وفق **المعايير الثمانية للتصميم الفخم**:
  1. **صدق الهوية البصرية للمشروع (Domain Authenticity Check):** هل هذا التصميم يبدو فعلاً كمشروع حقيقي في مجاله (مثلاً: هل يبدو كنظام طبي موثوق؟ أم كلوحة تحكم SaaS احترافية؟ أم كمنصة ذكاء اصطناعي عصرية؟ أم كمتجر فخم؟)، أم أنه يبدو كصفحة HTML عشوائية أو قالب مكسور؟
  2. **السلم التيبوغرافي والخطوط (Typography & Hierarchy):** هل الخط المختار يخدم فكرة المشروع؟ (مثلاً: الأنظمة المحاسبية ولوحات التحكم تحتاج خطوطاً هندسية واضحة وأرقاماً متساوية العرض `tabular-nums`، والواجهات العربية تحتاج خطوطاً مثل `IBM Plex Sans Arabic` أو `Cairo` أو `Readex Pro`).
  3. **التناغم اللوني وقاعدة $60\text{-}30\text{-}10$ (Color Architecture):** هل هناك لون خلفية مريح للعين ($60\%$)، ولون أسطح وبطاقات متمايز بنعومة ($30\%$)، ولون براند أساسي للأزرار والعناصر المهمة ($10\%$)؟ أم أن هناك مهرجاناً عشوائياً من الألوان الفاقعة؟
  4. **الإيقاع المكاني وشبكة الـ $8\text{px}$ (Spatial Grid & Whitespace):** هل المسافات (`gap`, `padding`, `margin`) تتبع مضاعفات $4\text{px}$ و $8\text{px}$؟ هل البطاقات والأقسام تتنفس أم ملتصقة ببعضها؟
  5. **بنية المكونات الخاصة بالمجال (Domain-Specific Components):**
     * **في الأنظمة الإدارية والـ SaaS:** كيف تبدو الجداول، التبويبات، الفلاتر، النوافذ المنبثقة (`Modals`)، والرسوم البيانية؟
     * **في الأنظمة الخدمية والتجارية:** كيف تبدو البطاقات، خطوات الإجراء (`Steppers`)، النماذج، وحالات النجاح؟
  6. **حزمة الإنقاذ وإعادة التصميم الجاهزة (Custom Design System Rescue Kit):** يكتب `Agent-05` كود نظام تصميم كامل مخصص لفكرة المشروع (الألوان، الخطوط، الـ Layout الأساسي، وأهم المكونات في المشروع) جاهزاً للنسخ والتطبيق الفوري.
* **المخرج الإلزامي:** حفظ التقرير البصري وحزمة الإنقاذ في `.audit_workspace/reports/05_visual_design_critique.md`.

---

### 🎭 الوكيل 06: محاكي رحلة المستخدم ومختبر تجربة الاستخدام (`Agent-06: End-to-End User Journey & Persona Simulator`)
* **الهوية:** خبير تجربة المستخدم وسلوك العملاء (Lead UX Researcher & E2E Flow Simulator).
* **المهمة:** تقمص **3 شخصيات مستخدمين حقيقية (User Personas)** خاصة بمجال المشروع (مثل: 1. زائر/عميل جديد، 2. مستخدم نشط ينفذ المهمة الجوهرية للمشروع، 3. مدير النظام/الأدمن).
* **ما الذي يفعله؟**
  1. يمشي في رحلة المستخدم الكاملة من أول شاشة حتى تحقيق الهدف النهائي للمشروع (End-to-End Flow).
  2. يكتشف **الطرق المسدودة (Dead-End Flows):** مثل صفحة يدخلها المستخدم ولا يوجد فيها زر رجوع أو إجراء تالي، أو نموذج يرسله المستخدم فلا تظهر له أي رسالة تأكيد (`Toast / Feedback`)، أو خطوة تتطلب 10 نقرات بينما يجب أن تتم في نقرتين!
  3. يفحص **الحالات الأربع لكل شاشة (The 4 UI States):**
     * **حالة التحميل (Loading State):** هل يوجد Skeleton أو Spinner أنيق أم تتجمد الشاشة؟
     * **حالة الفراغ (Empty State):** إذا لم توجد بيانات بعد في الجدول/القائمة، هل تظهر شاشة بيضاء كئيبة أم رسالة توضيحية مع زر إجراء (`Call to Action`)؟
     * **حالة الخطأ (Error State):** إذا فشل السيرفر أو أدخل المستخدم بيانات خاطئة، هل تظهر رسالة عربية/إنجليزية مفهومة ومهذبة أم ينهار التطبيق؟
     * **حالة النجاح (Success State):** هل يشعر المستخدم بأن عمليته تمت بنجاح؟
* **المخرج الإلزامي:** حفظ خريطة رحلة المستخدم ونقاط الاحتكاك في `.audit_workspace/reports/06_user_journey_ux.md`.

---

### 🤖 الوكيل 07: روبوت فحص الأزرار، النماذج، وعناصر DOM (`Agent-07: Functional DOM, Buttons & Forms Bot`)
* **الهوية:** مهندس أتمتة اختبارات الواجهة (Lead Frontend QA Automation Bot).
* **المهمة:** فحص كل زر (`<button>`), وكل رابط (`<a>`), وكل حقل إدخال (`<input>`, `<select>`, `<textarea>`) في الكود وفي المتصفح الحي، ورصد أخطاء الكونسول والشبكة.
* **الأوامر والسكربتات الإجبارية:**
  ```bash
  # كشف الأزرار والروابط الميتة في الكود المصدري
  grep -rnE "(<button[^>]*>|href=[\"']#[\"']|href=[\"']javascript:void|onClick=\{\s*\(\)\s*=>\s*\{\s*\}\s*\})" --exclude-dir={node_modules,.git,dist,build,.next,.audit_workspace} . > .audit_workspace/logs/suspicious_buttons.txt
  ```
* **زراعة وتشغيل روبوت المسح الوظيفي (`ui_functional_crawler.mjs`):**
  ```javascript
  // يحفظ في: .audit_workspace/scripts/ui_functional_crawler.mjs
  import { chromium } from 'playwright';
  import fs from 'fs';

  const TARGET_URL = process.env.TARGET_URL || 'http://localhost:3000';

  (async () => {
    const report = {
      targetUrl: TARGET_URL,
      consoleErrors: [],
      pageExceptions: [],
      failedNetworkRequests: [],
      interactiveElementsAudit: [],
      formsAudit: []
    };

    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();

      page.on('console', msg => {
        if (msg.type() === 'error' || msg.type() === 'warning') {
          report.consoleErrors.push({ type: msg.type(), text: msg.text() });
        }
      });
      page.on('pageerror', err => report.pageExceptions.push(err.message));
      page.on('response', res => {
        if (res.status() >= 400) {
          report.failedNetworkRequests.push({ url: res.url(), status: res.status(), method: res.request().method() });
        }
      });

      await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 30000 });

      report.interactiveElementsAudit = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"], [role="button"]')).map((el, idx) => {
          const s = window.getComputedStyle(el);
          const r = el.getBoundingClientRect();
          const text = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('title') || el.value || '').trim();
          const href = el.getAttribute('href');
          return {
            index: idx,
            tag: el.tagName,
            label: text.slice(0, 50) || '[عنصر/أيقونة بدون اسم أو aria-label]',
            disabled: el.disabled || el.getAttribute('aria-disabled') === 'true',
            visible: s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0,
            dimensions: `${Math.round(r.width)}x${Math.round(r.height)}`,
            touchTargetTooSmall: r.width > 0 && (r.width < 36 || r.height < 36),
            isDeadLink: el.tagName === 'A' && (!href || href === '#' || href.startsWith('javascript:void')),
            missingPointerCursor: s.cursor !== 'pointer' && !el.disabled
          };
        });
      });

      report.formsAudit = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input, select, textarea')).map(el => ({
          tag: el.tagName,
          type: el.getAttribute('type') || 'text',
          name: el.getAttribute('name') || el.id || '[حقل بدون name/id]',
          placeholder: el.getAttribute('placeholder') || '',
          required: el.hasAttribute('required'),
          hasAccessibleLabel: !!(el.id && document.querySelector(`label[for="${el.id}"]`)) || !!el.closest('label') || !!el.getAttribute('aria-label')
        }));
      });
    } catch (e) {
      report.fatalError = e.message;
    } finally {
      if (browser) await browser.close();
      fs.writeFileSync('.audit_workspace/reports/07_functional_dom_raw.json', JSON.stringify(report, null, 2));
    }
  })();
  ```
* **المخرج الإلزامي:** حفظ جدول شامل بجميع الأزرار والنماذج وحالتها في `.audit_workspace/reports/07_functional_dom_audit.md`.

---

### 🔗 الوكيل 08: مهندس الربط البرمجي والجنائيات لقواعد البيانات (`Agent-08: API Contract & DB Forensics Agent`)
* **الهوية:** مهندس Backend وتكامل أنظمة وقواعد بيانات.
* **المهمة:** مطابقة كل طلب يخرج من الواجهة الأمامية مع المسار المقابل في الخلفية، وفحص مخطط قاعدة البيانات والاستعلامات.
* **الأوامر والفحوصات الإجبارية:**
  ```bash
  # استخراج جميع طلبات الشبكة في الواجهة الأمامية
  grep -rnE "(fetch\(|axios\.(get|post|put|patch|delete|request)|useQuery|useMutation|trpc\.|supabase\.|\/api\/)" --exclude-dir={node_modules,.git,dist,build,.next,.audit_workspace} . > .audit_workspace/logs/frontend_api_calls.txt

  # استخراج جميع مسارات السيرفر في الواجهة الخلفية
  grep -rnE "(app\.(get|post|put|patch|delete|use)|router\.(get|post|put|patch|delete)|@(Get|Post|Put|Delete|Patch)\(|Route::(get|post|put|delete)|export async function (GET|POST|PUT|DELETE|PATCH))" --exclude-dir={node_modules,.git,dist,build,.next,.audit_workspace} . > .audit_workspace/logs/backend_routes.txt
  ```
* **التحليل الجنائي للربط وقواعد البيانات:**
  1. كشف **المسارات الشبحية (Ghost Endpoints)** التي تطلبها الواجهة ولا وجود لها في السيرفر، و**المسارات اليتيمة (Orphan Routes)** الموجودة في السيرفر ولا تستخدمها الواجهة.
  2. كشف **اختلاف هيكل البيانات (Schema/Payload Mismatch)** بين ما ترسله النماذج وما يستقبله السيرفر.
  3. كشف مشاكل قواعد البيانات: غياب الفهارس (`Indexes`)، استعلامات $N+1$ داخل الحلقات التكرارية، وغياب المعاملات الذرية (`Database Transactions`) في العمليات الحساسة.
* **المخرج الإلزامي:** حفظ مصفوفة الربط وتقرير قاعدة البيانات في `.audit_workspace/reports/08_api_db_forensics.md`.

---

### 🛡️ الوكيل 09: فريق الاختراق الأخلاقي ومختبر الثغرات المنطقية (`Agent-09: Red Team Security & Business Logic Hacker`)
* **الهوية:** خبير أمن سيبراني ومختبر اختراق تطبيقات (OSCP / OWASP Lead Pentester).
* **المهمة:** فحص الأمان التقني (OWASP Top 10) + **محاولة كسر المنطق الخاص بفكرة المشروع (Domain-Specific Business Logic Exploitation)**.
* **الأوامر الأمنية الإجبارية:**
  ```bash
  # 1. مسح الأسرار والمفاتيح المسربة في الكود
  grep -rnE "(api[_-]?key|secret|password|passwd|private[_-]?key|BEGIN RSA|ghp_|sk-[a-zA-Z0-9]{20,}|AIza[0-9A-Za-z-_]{35}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})" --exclude-dir={node_modules,.git,dist,build,.next,.audit_workspace} . > .audit_workspace/logs/secrets_scan.txt

  # 2. فحص ثغرات المكتبات
  npm audit --json > .audit_workspace/logs/security_deps.json 2>&1 || pip-audit > .audit_workspace/logs/security_deps.json 2>&1 || true

  # 3. مسح نقاط الحقن وتنفيذ الأوامر و XSS
  grep -rnE "(dangerouslySetInnerHTML|v-html|innerHTML\s*=|eval\(|exec\(|child_process|os\.system|subprocess\.Popen|raw\(|query\([\"'\`].*\$\{)" --exclude-dir={node_modules,.git,dist,build,.next,.audit_workspace} . > .audit_workspace/logs/injection_vectors.txt

  # 4. فحص ترويسات الأمان في السيرفر
  curl -s -D - -o /dev/null http://localhost:3000 > .audit_workspace/logs/security_headers.txt
  ```
* **اختراق المنطق الخاص بمجال المشروع (Domain Logic Hacking):**
  * **في الأنظمة متعددة المستخدمين والشركات (SaaS / ERP / Clinics):** هل يمكن لمستخدم رؤية أو تعديل بيانات مستخدم آخر أو شركة أخرى بتغيير الـ `id` في الرابط أو الطلب (`IDOR / Broken Multi-Tenancy Isolation`)؟
  * **في الأنظمة المالية والمتاجر والاشتراكات:** هل يمكن التلاعب بالمبالغ، الأرصدة، الكميات السالبة، أو تخطي الدفع والترقية لخطة مدفوعة مجاناً (`Privilege & Plan Escalation`)؟
  * **في أنظمة الذكاء الاصطناعي والـ APIs:** هل يمكن استنزاف رصيد الـ API بهجمات متكررة لغياب `Rate Limiting`؟ أو حقن أوامر خبيثة (`Prompt Injection`)؟
* **المخرج الإلزامي:** حفظ التقرير الأمني الجنائي في `.audit_workspace/reports/09_security_pentest.md`.

---

### ⚡ الوكيل 10: مهندس اختبار قوة التحمل، تحليل النواقص، والمخطط الاستراتيجي (`Agent-10: Stress Engineer, Gap Analyst & Master Architect`)
* **الهوية:** مهندس أداء واختبارات ضغط ومعماري حلول (Performance Engineer & Principal Solution Architect).
* **المهمة المزدوجة:**
  1. **اختبار قوة التحمل تحت الضغط (Live Load & Stress Testing):** ضرب السيرفر بـ 1000 طلب متزامن وحساب قدرة التحمل $RPS$ وأزمنة الاستجابة $P_{50}, P_{95}, P_{99}$.
  2. **تحليل النواقص وبناء خطة التطوير الشاملة (Gap Analysis & Master Roadmap):** مقارنة المشروع الحالي بأفضل المعايير العالمية لمجاله، واستخراج كل ما ينقصه ليكون مشروعاً متكاملاً وفخماً جاهزاً للإنتاج.

* **زراعة وتشغيل مدفع اختبار التحمل الذاتي (`stress_cannon.mjs`):**
  ```javascript
  // يحفظ في: .audit_workspace/scripts/stress_cannon.mjs
  import http from 'http';
  import https from 'https';
  import fs from 'fs';

  const TARGET = process.env.TARGET_URL || 'http://localhost:3000';
  const CONCURRENCY = parseInt(process.env.CONCURRENCY || '100', 10);
  const TOTAL_REQUESTS = parseInt(process.env.TOTAL_REQUESTS || '1000', 10);

  const client = TARGET.startsWith('https') ? https : http;
  const latencies = [];
  const statusCodes = {};
  let completed = 0, active = 0, launched = 0, errors = 0;
  const startTime = process.hrtime.bigint();

  function fireRequest() {
    if (launched >= TOTAL_REQUESTS) return;
    launched++;
    active++;
    const reqStart = process.hrtime.bigint();

    const req = client.get(TARGET, (res) => {
      res.on('data', () => {});
      res.on('end', () => {
        latencies.push(Number(process.hrtime.bigint() - reqStart) / 1e6);
        statusCodes[res.statusCode] = (statusCodes[res.statusCode] || 0) + 1;
        finishOne();
      });
    });

    req.on('error', () => { errors++; finishOne(); });
    req.setTimeout(10000, () => { errors++; req.destroy(); });
  }

  function finishOne() {
    active--;
    completed++;
    if (completed < TOTAL_REQUESTS) {
      while (active < CONCURRENCY && launched < TOTAL_REQUESTS) fireRequest();
    } else if (active === 0) {
      const totalTimeSec = Number(process.hrtime.bigint() - startTime) / 1e9;
      latencies.sort((a, b) => a - b);
      const len = latencies.length;
      const avg = len ? latencies.reduce((a, b) => a + b, 0) / len : 0;
      const results = {
        target: TARGET,
        concurrency: CONCURRENCY,
        totalRequests: TOTAL_REQUESTS,
        totalDurationSeconds: Number(totalTimeSec.toFixed(2)),
        requestsPerSecond_RPS: Number((totalTimeSec > 0 ? completed / totalTimeSec : 0).toFixed(2)),
        latencyMs: {
          avg: Number(avg.toFixed(2)),
          p50: Number((len ? latencies[Math.floor(len * 0.50)] : 0).toFixed(2)),
          p95: Number((len ? latencies[Math.floor(len * 0.95)] : 0).toFixed(2)),
          p99: Number((len ? latencies[Math.floor(len * 0.99)] : 0).toFixed(2)),
          max: Number((len ? latencies[len - 1] : 0).toFixed(2))
        },
        statusCodes,
        failedOrTimedOutRequests: errors,
        errorRatePercent: Number(((errors / TOTAL_REQUESTS) * 100).toFixed(2))
      };
      fs.writeFileSync('.audit_workspace/reports/10_stress_test_raw.json', JSON.stringify(results, null, 2));
    }
  }

  for (let i = 0; i < CONCURRENCY; i++) fireRequest();
  ```

* **فحص الملفات الضخمة التي تبطئ المشروع (> 500KB):**
  ```bash
  find . -type f -size +500k -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.audit_workspace/*" -exec ls -lh {} + > .audit_workspace/logs/heavy_assets.txt
  ```
* **المخرج الإلزامي:** حفظ تقرير التحمل وتحليل النواقص وخارطة الطريق في `.audit_workspace/reports/10_stress_and_master_plan.md`.

---

## 🤝 مرحلة المحاكمة وإصدار التقرير الشامل (`Cross-Agent Synthesis & Master Report`)

يجمع القائد (`Agent-00`) كافة التقارير العشرة من `.audit_workspace/reports/`، ويدمجها في ملف واحد ضخم، منسق، ومفصل بالمللي في جذر المشروع باسم **`MASTER_AUDIT_REPORT.md`**، ثم يغلق السيرفر التجريبي (`kill $(cat .audit_workspace/server.pid)`).

---

## 📜 الهيكل الإلزامي للتقرير النهائي الشامل (`MASTER_AUDIT_REPORT.md`)

يجب توليد ملف `MASTER_AUDIT_REPORT.md` بهذا الهيكل التفصيلي الكامل دون اختصار أي جدول أو قسم:

````markdown
# 🏛️ التقرير الجنائي والبصري والمعماري الشامل للمشروع (11-Agent Universal Master Audit Report)

* **اسم المشروع:** `[اسم المشروع]`
* **فكرة المشروع ومجاله التخصصي المكتشف (Domain DNA):** `[توصيف دقيق لفكرة المشروع ومجاله والجمهور المستهدف]`
* **العمارة التقنية المكتشفة:** `[Frontend / Styling / Backend / Database / Infra]`
* **حالة البناء والتشغيل الفعلي:** `[✅ يعمل بالكامل / ⚠️ يعمل مع أخطاء حرجة / ❌ فشل في البناء أو التشغيل]`
* **تقييم مطابقة الواجهات والتنسيقات لهوية المشروع:** `[🌟 فخم ومطابق للمعايير العالمية / ⚠️ متوسط يحتاج تحسين / 🚨 عشوائي ومفكك بصرياً يحتاج إعادة تصميم شاملة]`

---

## 📊 1. بطاقة الأداء الرقمية للفريق (11-Agent Executive Scorecard)

| الوكيل الفاحص (Agent) | قطاع الفحص والتدقيق | التقييم ($100\%$) | الحالة | أخطر اكتشاف في هذا القطاع |
| :--- | :--- | :---: | :---: | :--- |
| **🕵️ Agent-01** | الهيكلة المعمارية، الإعدادات، والبيئة | `XX/100` | 🟢/🟡/🔴 | `[ملخص]` |
| **🧠 Agent-02** | **منطق الأعمال واكتمال فكرة المشروع تخصصياً** | `XX/100` | 🟢/🟡/🔴 | `[ملخص]` |
| **⚙️ Agent-03** | البناء، الاعتماديات، والتشغيل الحي | `XX/100` | 🟢/🟡/🔴 | `[ملخص]` |
| **🔬 Agent-04** | جودة الكود، الأنواع، والأخطاء المنطقية | `XX/100` | 🟢/🟡/🔴 | `[ملخص]` |
| **💎 Agent-05** | **الجماليات، التنسيقات، الخطوط، ومطابقة هوية المجال** | `XX/100` | 🟢/🟡/🔴 | `[ملخص صريح لحالة الشكل والتنسيق]` |
| **🎭 Agent-06** | **رحلة المستخدم (UX Flows) والحالات الأربع** | `XX/100` | 🟢/🟡/🔴 | `[ملخص]` |
| **🤖 Agent-07** | عمل الأزرار، النماذج، وسلامة الـ DOM | `XX/100` | 🟢/🟡/🔴 | `[ملخص]` |
| **🔗 Agent-08** | الربط البرمجي (API Contracts) وقواعد البيانات | `XX/100` | 🟢/🟡/🔴 | `[ملخص]` |
| **🛡️ Agent-09** | الأمان السيبراني واختراق منطق المشروع | `XX/100` | 🟢/🟡/🔴 | `[ملخص]` |
| **⚡ Agent-10** | الأداء، قوة التحمل تحت الضغط، والجاهزية للإنتاج | `XX/100` | 🟢/🟡/🔴 | `[ملخص]` |
| **👑 التقييم العام** | **المتوسط الموزون لجاهزية وفخامة المشروع** | **`XX/100`** | **🟢/🟡/🔴** | **`[الحكم الهندسي والفني النهائي]`** |

---

## 🧠 2. التحليل التخصصي لفكرة المشروع ومنطق الأعمال (Agent-02 Domain SME Evaluation)
* **فهم الفكرة والهدف الأساسي للمشروع:** `[شرح عميق لما يحاول المشروع تقديمه]`
* **هل المنطق البرمجي الحالي يحقق فكرة المشروع فعلياً أم صورياً؟** `[تحليل تفصيلي يكشف هل الميزات حقيقية ومترابطة أم مجرد واجهات صورية وبيانات ثابتة]`
* **المقارنة المرجعية مع الأنظمة العالمية في نفس المجال (Domain Benchmark):**
  | الركن التخصصي في هذا المجال | الوضع الحالي في المشروع | المعيار العالمي المفترض توفره | الفجوة والأثر |
  | :--- | :--- | :--- | :--- |
  | `[ركن 1 خاص بمجال المشروع]` | `[الحالة]` | `[المعيار القياسي]` | `[التفاصيل]` |

---

## 💎 3. النقد البصري والجنائي للتنسيقات، الخطوط، وهوية الواجهات (Agent-05 Art Director Critique)

### أ. التشخيص الهندسي الصريح: هل يبدو المشروع حقيقياً وفخماً أم عشوائياً؟
1. **حالة أنابيب التنسيق (CSS / Tailwind / Styling Pipeline):** `[هل الكلاسات والملفات تعمل؟ هل هناك تضارب أو سقوط في التنسيقات؟]`
2. **فحص الخطوط والسلم التيبوغرافي (Typography & Hierarchy Scale):**
   * **الخطوط المحملة فعلياً:** `[أسماء الخطوط]` | **المقاسات المقاسة:** `H1: XXpx | H2: XXpx | Body: XXpx`
   * **نقد الخطوط والهرمية:** `[هل الخط يناسب مجال المشروع؟ هل يدعم العربية باحترافية؟ هل هناك تباين واضح بين العناوين والنصوص والأرقام؟]`
3. **فحص الهندسة اللونية والتباين (Color Theory & Contrast):**
   * **لوحة الألوان المستخرجة:** `[الألوان]` | **العناصر ضعيفة التباين:** `[XX عنصر]` | **الروابط البدائية غير المنسقة:** `[XX رابط]`
   * **نقد الهوية اللونية:** `[هل الألوان متناسقة وتناسب روح المشروع أم فاقعة وعشوائية؟]`
4. **فحص الإيقاع المكاني، التكدس، ونظام الشبكة (Spatial Rhythm, Padding & Grid Symmetry):**
   * **الصناديق المكدسة بلا هوامش (`Padding = 0px`):** `[XX عنصر]`
   * **العناصر الملتصقة بحواف الشاشة:** `[XX عنصر]`
   * **صفوف البطاقات/العناصر غير متساوية الارتفاع ($\Delta H > 24\text{px}$):** `[XX صف]`
   * **حالة اللغة العربية والاتجاه (`RTL/LTR`):** `[التفاصيل]`

### ب. تقييم شاشات ومكونات المشروع الأساسية بصرياً
| الشاشة / المكون في المشروع | التقييم البصري | العيوب التنسيقية والجمالية المرصودة بالعين وبالكود | التصميم القياسي المفترض لهذا المكون |
| :--- | :---: | :--- | :--- |
| `[الشاشة/المكون 1]` | 🟢/🟡/🔴 | `[تشخيص دقيق]` | `[كيف يجب أن يصمم]` |
| `[الشاشة/المكون 2]` | 🟢/🟡/🔴 | `[تشخيص دقيق]` | `[كيف يجب أن يصمم]` |

### ج. 🚑 حزمة الإنقاذ البصري ونظام التصميم المقترح للمشروع (Custom Design System Rescue Kit)
*(يضع `Agent-05` هنا كود نظام التصميم الكامل المخصص لفكرة هذا المشروع تحديداً: إعداد الخطوط، متغيرات الألوان العصرية، وكود إعادة بناء أهم مكونين/شاشتين في المشروع بأعلى فخامة بصرية)*

```css
/* 1. كود إعداد الخطوط ومتغيرات الألوان والمسافات القياسية المخصصة لهوية المشروع */
```

```tsx
// 2. كود معماري جاهز لإعادة تصميم الواجهة/المكون الرئيسي في المشروع بمعايير UI/UX عالمية
```

---

## 🎭 4. تقرير رحلة المستخدم، سيناريوهات الاستخدام، والأزرار (Agent-06 & Agent-07 Report)

### أ. محاكاة رحلة المستخدم الحقيقي (End-to-End Persona Flows)
* **رحلة الشخصية الأولى (`[اسم الشخصية - مثلاً: عميل جديد / مستخدم عادي]`):** `[الخطوات التي تمت -> أين انقطعت الرحلة أو ظهر الخلل؟]`
* **رحلة الشخصية الثانية (`[اسم الشخصية - مثلاً: مدير النظام / مستخدم متقدم]`):** `[الخطوات التي تمت -> أين انقطعت الرحلة أو ظهر الخلل؟]`
* **تقييم الحالات الأربع (Loading, Empty, Error, Success States):** `[تفصيل الشاشات التي تفتقر إليها]`

### ب. جدول الفحص الشامل للأزرار، النماذج، والتجاوب
| الصفحة / المكون | العنصر التفاعلي (زر/رابط/نموذج) | الموقع (`file:line`) | الحالة الوظيفية | مقاس العنصر | التشخيص والعيوب |
| :--- | :--- | :--- | :---: | :---: | :--- |
| `[Page]` | `[Button/Input]` | `src/...:XX` | ✅ يعمل / ❌ معطل | `XXxXX px` | `[تفاصيل]` |

* **تجاوب الشاشات الأربعة (`Mobile 375px` / `Tablet 768px` / `Laptop 1280px` / `Wide 1440px`):** `[العناصر الخارجة عن الشاشة]`
* **أخطاء الكونسول والشبكة الحية:** `[سرد كامل لجميع أخطاء Console Errors و 404/500]`

---

## 🚨 5. السجل الجنائي الشامل لجميع المشاكل والأخطاء البرمجية (Master Forensic Issues Log)

### 🔴 أولاً: كوارث ومشاكل حرجة جداً (Critical / Blocker Issues)
#### `[CRIT-01]` [عنوان المشكلة بدقة]
* **الوكيل المكتشف:** `Agent-XX` | **الموقع الدقيق:** `path/to/file.ext:line_number`
* **الكود الحالي المسبب للكارثة:**
  ```[lang]
  // الكود الفعلي من المشروع
  ```
* **التحليل الجنائي والأثر:** `[لماذا تحدث المشكلة وكيف تكسر المشروع]`
* **الحل البرمجي الجاهز للنسخ (Patch):**
  ```[lang]
  // الكود الصحيح الجاهز للاستبدال
  ```

### 🟠 ثانياً: مشاكل عالية الخطورة (High Severity Issues)
*(نفس الهيكلة التفصيلية لكل مشكلة)*

### 🟡 ثالثاً: مشاكل متوسطة وعيوب تنسيق وتجربة مستخدم (Medium Severity Issues)
*(نفس الهيكلة التفصيلية لكل مشكلة)*

---

## 🔗 6. تقرير الربط البرمجي والجنائيات لقواعد البيانات (Agent-08 API & DB Report)

| المسار (Endpoint) | الطريقة | ملف الاستدعاء (Frontend) | ملف المعالجة (Backend) | حالة التطابق | الاستجابة | الخلل المكتشف |
| :--- | :---: | :--- | :--- | :---: | :---: | :--- |
| `/api/...` | `POST` | `src/...:15` | `server/...:40` | ✅ متطابق / ❌ مكسور | `200 / 500` | `[تفاصيل]` |

* **المسارات الشبحية واليتيمة + فحص قاعدة البيانات (Indexes, $N+1$, Transactions):** `[التفاصيل والحلول]`

---

## 🛡️ 7. تقرير الاختراق الأخلاقي وأمان منطق المشروع (Agent-09 Red Team Report)
* **نتائج محاولة اختراق منطق المشروع التخصصي (Business Logic & IDOR/Multi-Tenancy Exploits):** `[تفصيل الثغرات المنطقية]`
* **الأسرار المكشوفة وثغرات الحزم (CVEs):** `[النتائج بالمواقع]`
* **فحص OWASP Top 10 (SQLi, XSS, CSRF, Auth, Rate Limiting):** `[التفاصيل وطريقة الإغلاق]`

---

## ⚡ 8. تقرير الأداء واختبار قوة التحمل تحت الضغط (Agent-10 Stress Report)
* **عدد الطلبات المتزامنة (Concurrency):** `[100]` | **إجمالي الطلبات:** `[1000]`
* **قدرة المعالجة الفعلية (Throughput):** `[XXXX طلب/ثانية (RPS)]`
* **زمن الاستجابة:** `Avg: XX ms` | $P_{50}$: `XX ms` | $P_{95}$: `XX ms` | $P_{99}$: `XX ms`
* **نسبة الفشل تحت الضغط (Error Rate):** `[X.XX%]`
* **الملفات والصور الضخمة التي تبطئ التحميل:** `[القائمة بالمسارات والأحجام]`

---

## 🧩 9. تحليل النواقص الشامل: ماذا ينقص المشروع ليكون تحفة عالمية؟ (Gap Analysis)
1. **ميزات مبدوءة في الكود ولكنها وهمية أو غير مكتملة (Mocked / Half-Baked Features):** `[قائمة شاملة بالملفات]`
2. **نواقص تخصصية أساسية في مجال المشروع (Domain-Specific Missing Features):** `[الميزات التي يتوقعها أي مستخدم في هذا المجال ولكنها غائبة]`
3. **نواقص الجاهزية للإنتاج (Production & Enterprise Readiness):** `[الاختبارات الآلية، Docker، CI/CD، المراقبة، النسخ الاحتياطي، التوثيق]`

---

## 🗺️ 10. الخطة الهندسية والبصرية الشاملة للإصلاح والتطوير (Master Execution Roadmap)

### 🎨 المرحلة الأولى: الإنقاذ البصري وإعادة هندسة الواجهات والتنسيقات (UI/UX & Design System Overhaul)
* [ ] **[مهمة 1]:** `[وصف دقيق + الملفات المستهدفة + كود التنسيق]`

### 🚑 المرحلة الثانية: إصلاح الكوارث البرمجية، الأمان، وتشغيل الأزرار والربط
* [ ] **[مهمة 1]:** `[وصف دقيق + اسم الملف والسطر + طريقة الإصلاح]`

### 🚀 المرحلة الثالثة: استكمال الميزات التخصصية الناقصة ومضاعفة الأداء والتحمل
* [ ] **[مهمة 1]:** `[وصف دقيق + خطوات البناء المعماري]`

````

---

## 🛠️ بروتوكول "التنفيذ والإصلاح الذاتي" الاختياري (`Phase-2: Autonomous Self-Healing Mode`)

بعد انتهاء الفريق من إصدار التقرير `MASTER_AUDIT_REPORT.md`، إذا طلب منك المستخدم: **"نفذ الخطة الآن وأصلح المشاكل وحسّن الواجهات"**، يتحول الفريق فوراً من وضع **التدقيق (Audit Mode)** إلى وضع **البناء والإصلاح الجراحي (Surgical Reconstruction Mode)** وفق الترتيب التالي:
1. يقوم `Agent-05` أولاً بتطبيق **حزمة الإنقاذ البصري (Design System Rescue Kit)** وإصلاح الخطوط والألوان وتوحيد التنسيقات في كامل المشروع، ثم يلتقط صوراً جديدة (`After Screenshots`) ليقارن قبل وبعد!
2. يقوم `Agent-04` و`Agent-07` و`Agent-08` بإصلاح الأخطاء الحرجة، وربط الأزرار الميتة، وتصحيح مسارات الـ API.
3. يقوم `Agent-09` بإغلاق الثغرات الأمنية والمنطقية، ثم يعيد `Agent-03` بناء المشروع (`npm run build`) للتأكد من خلوه من أي خطأ بنسبة $100\%$.