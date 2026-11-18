# دليل نظام التصميم والتوكنز الموحد (ASAAS Sovereign Design System Guide)

> **الإصدار**: v2.5.0 Enterprise  
> **النمط البصري**: Cyber Dark Luxury Glassmorphism  
> **حالة التطبيق**: مدمج بالكامل مع CSS Variables و Tailwind Config و React Components

---

## 1. الهيكل المعماري ثلاثي الطبقات (Three-Layer Token Architecture)

يعتمد نظام التصميم في أساس على المعمارية القياسية ثلاثية الطبقات الموصى بها في أنظمة التصميم العالمية (W3C Design Tokens Community Group):

```
┌───────────────────────────────────────────────────────────────┐
│  الطبقة 3: توكنز المكونات (Component Tokens)                  │
│  --btn-primary-bg, --card-bg, --modal-border, --input-focus   │
└───────────────────────────────▲───────────────────────────────┘
                                │ تخصص لكل عنصر
┌───────────────────────────────┴───────────────────────────────┐
│  الطبقة 2: التوكنز الوظيفية (Semantic Tokens)                 │
│  --surface-canvas, --text-title, --border-gold-rim, --status  │
└───────────────────────────────▲───────────────────────────────┘
                                │ تُعيّن المعنى للثيم (Dark/Light)
┌───────────────────────────────┴───────────────────────────────┐
│  الطبقة 1: التوكنز الأساسية (Primitive Tokens)                │
│  --primitive-color-carbon-950, --primitive-color-gold-500     │
│  لوحة الألوان الخام، شبكة المسافات (4px)، ومقاييس الخطوط     │
└───────────────────────────────────────────────────────────────┘
```

### لماذا ثلاث طبقات؟
1. **الطبقة الأساسية (Primitives):** قيم خام ثابتة (أرقام وأكواد Hex) لا تتغير بتغير الثيم أو السياق.
2. **الطبقة الوظيفية (Semantics):** تمنح القيم معنى منطقياً (`surface`, `text`, `action`, `status`) مما يسمح بالتبديل الفوري بين الوضع الداكن والوضع الفاتح دون لمس مكونات واجهة المستخدم.
3. **طبقة المكونات (Components):** تتيح تخصيص كل زر، نافذة منبثقة، أو كرت بشكل مستقل ومنع التأثير غير المقصود على باقي العناصر.

---

## 2. ملفات النظام ومساراتها في المشروع (File Structure)

| الملف | المسار | الوظيفة |
| :--- | :--- | :--- |
| **مصدر الحقيقة (JSON)** | `frontend/src/tokens/design-tokens.json` | ملف الإعدادات الكامل بصيغة JSON الموحدة للتوكنز. |
| **متغيرات CSS المُصدّرة** | `frontend/src/tokens/design-tokens.css` | ملف متغيرات CSS الرسمي (يتضمن الطبقات الثلاث وفئات المساعدة). |
| **تكامل Tailwind** | `frontend/tailwind.config.js` | ربط فئات Tailwind مباشرة بمتغيرات CSS. |
| **جسر التوافقية القديم** | `frontend/src/asaas-ui/styles/tokens.css` | توفير متغيرات التوافقية العكسية للمكونات السابقة. |

---

## 3. كتالوج المتغيرات الكامل (Tokens Catalog)

### 3.1 الطبقة الأساسية (Primitives)

#### أ. ألوان الكربون والأسطح (Neutral Carbon Spectrum)
| المتغير | القيمة | الاستخدام النموذجي |
| :--- | :--- | :--- |
| `--primitive-color-carbon-950` | `#0c0c0e` | خلفية الفضاء العميق (Canvas Background) |
| `--primitive-color-carbon-900` | `#131315` | السطح الأرضي الأساسي للتطبيق |
| `--primitive-color-carbon-850` | `#141111` | أسطح البطاقات الفرعية الداكنة |
| `--primitive-color-carbon-800` | `#1b1b1d` | حاويات المستويات المنخفضة |
| `--primitive-color-carbon-700` | `#201f21` | الحاوية الافتراضية للبطاقات |
| `--primitive-color-carbon-600` | `#2a2a2c` | الحاويات المرتفعة وزر الثانوي |
| `--primitive-color-carbon-500` | `#353437` | حواف الحاويات وحالة التحويم (Hover) |
| `--primitive-color-carbon-300` | `#8a8478` | نصوص التيليميتري والوحدات الخافتة |
| `--primitive-color-carbon-150` | `#d6d0c4` | نص القراءة الرملي المريح للعين |
| `--primitive-color-carbon-50`  | `#fcfaf7` | لون العناوين البيضاء اللؤلؤية |

#### ب. لوحة الذهب السيادي (Sovereign Gold Spectrum)
| المتغير | القيمة | الاستخدام النموذجي |
| :--- | :--- | :--- |
| `--primitive-color-gold-950` | `#261a00` | نص الزر الذهبي الأساسي عالي التباين |
| `--primitive-color-gold-700` | `#8b6914` | الظلال العميقة للذهب |
| `--primitive-color-gold-600` | `#ba9555` | برونز تراثي معتق |
| `--primitive-color-gold-500` | `#d4a017` | **الذهب الأساسي للمنظومة (Primary Gold)** |
| `--primitive-color-gold-400` | `#f6be39` | ذهب ساطع لحالات التحويم والتوهج |
| `--primitive-color-gold-300` | `#ffd700` | توهج الإشعارات وحالات الذكاء الاصطناعي |

#### ج. ألوان تشخيص الأنوية الثمانية (Hardware CPU Cores)
| المتغير | القيمة | النواة |
| :--- | :--- | :--- |
| `--primitive-core-01` | `#f87171` | نواة 01 (مرجاني / أحمر) |
| `--primitive-core-02` | `#fb923c` | نواة 02 (برتقالي) |
| `--primitive-core-03` | `#facc15` | نواة 03 (ذهبي) |
| `--primitive-core-04` | `#4ade80` | نواة 04 (زمردي) |
| `--primitive-core-05` | `#38bdf8` | نواة 05 (سماوي) |
| `--primitive-core-06` | `#818cf8` | نواة 06 (نيلي) |
| `--primitive-core-07` | `#c084fc` | نواة 07 (بنفسجي) |
| `--primitive-core-08` | `#f472b6` | نواة 08 (وردي / ماجنتا) |

#### د. شبكة المسافات (Spacing Scale - 4px Base)
* `--primitive-space-1`: `4px`
* `--primitive-space-2`: `8px`
* `--primitive-space-3`: `12px`
* `--primitive-space-4`: `16px` (افتراضي للبطاقات الداخلية)
* `--primitive-space-5`: `20px`
* `--primitive-space-6`: `24px` (الفواصل بين الأقسام)
* `--primitive-space-8`: `32px`
* `--primitive-space-12`: `48px`

---

### 3.2 الطبقة الوظيفية (Semantic Tokens)

تُستخدم هذه المتغيرات دائماً في كتابة الأنماط لأنها تتغير تلقائياً بحسب الثيم:

| الفئة الوظيفية | اسم التوكن | القيمة في الوضع الداكن (Dark) | القيمة في الوضع الفاتح (Light) |
| :--- | :--- | :--- | :--- |
| **الأسطح** | `--surface-canvas` | `#0c0c0e` | `#f7f4ef` |
| | `--surface-ground` | `#131315` | `#ede7da` |
| | `--surface-glass` | `rgba(22, 20, 20, 0.76)` | `rgba(255, 253, 249, 0.85)` |
| | `--surface-glass-tint` | `rgba(255, 255, 255, 0.035)` | `rgba(0, 0, 0, 0.02)` |
| **الحدود** | `--border-hairline` | `rgba(255, 255, 255, 0.08)` | `rgba(34, 31, 31, 0.08)` |
| | `--border-gold-rim` | `rgba(212, 160, 23, 0.22)` | `rgba(186, 149, 85, 0.45)` |
| | `--border-gold-rim-strong` | `rgba(212, 160, 23, 0.45)` | `rgba(186, 149, 85, 0.75)` |
| **النصوص** | `--text-title` | `#fcfaf7` | `#1a1818` |
| | `--text-body` | `#d6d0c4` | `#2d2926` |
| | `--text-muted` | `#8a8478` | `#7a746c` |
| | `--text-gold` | `#f6be39` | `#8f6626` |
| **الإجراءات** | `--action-primary` | `#d4a017` | `#ba9555` |
| | `--action-primary-hover`| `#f6be39` | `#a88243` |
| | `--action-primary-fg` | `#261a00` | `#ffffff` |
| **الحالات** | `--status-safe` | `#22c55e` | `#16a34a` |
| | `--status-safe-surface` | `rgba(34, 197, 94, 0.12)` | `rgba(22, 163, 74, 0.12)` |
| | `--status-danger` | `#ef4444` | `#dc2626` |
| | `--status-danger-surface`| `rgba(239, 68, 68, 0.14)` | `rgba(220, 38, 38, 0.12)` |

---

### 3.3 طبقة المكونات (Component Tokens)

* **الأزرار:** `--btn-primary-bg`, `--btn-primary-fg`, `--btn-glass-bg`, `--btn-danger-bg`, `--btn-radius`
* **البطاقات:** `--card-bg`, `--card-border`, `--card-radius`, `--card-padding`, `--card-shadow`, `--card-backdrop`
* **النوافذ:** `--modal-backdrop`, `--modal-bg`, `--modal-border`, `--modal-radius`, `--modal-shadow`
* **الحقول:** `--input-bg`, `--input-border`, `--input-border-focus`, `--input-text`, `--input-radius`
* **الجداول:** `--table-head-bg`, `--table-head-fg`, `--table-row-hover`, `--table-border`
* **الراسم البياني:** `--oscilloscope-bg`, `--oscilloscope-grid`, `--oscilloscope-time-grid`, `--oscilloscope-shadow`

---

## 4. جدول فئات Tailwind المدمجة (Tailwind Utility Mapping)

تم ربط إعدادات Tailwind مباشرة بالتوكنز، بحيث يمكنك استخدام الفئات التالية فوراً:

| نوع التنسيق | فئة Tailwind المتاحة | الوصف والمكافئ في التوكنز |
| :--- | :--- | :--- |
| **الخلفيات** | `bg-surface-canvas` | خلفية الشاشة الفحمية العميقة |
| | `bg-surface-glass` | خلفية زجاجية فاخرة نصف شفافة |
| | `bg-surface-container` | خلفية كرت أو حاوية افتراضية |
| | `bg-surface-container-high`| خلفية حاوية مرتفعة (Hover/Active) |
| | `bg-primary` | الزر الذهبي الأساسي للمنظومة |
| | `bg-status-safe-surface` | خلفية خضراء خافتة لمؤشرات الأمان |
| | `bg-status-danger-surface` | خلفية حمراء خافتة للتحذيرات وحظر IP |
| **النصوص** | `text-title` | عناوين رئيسية واضحة بدرجة بياض لؤلؤي |
| | `text-body` | نصوص المحتوى والقراءة الرملية |
| | `text-muted` | نصوص فرعية وبيانات إرشادية خافتة |
| | `text-gold` | تمييز النص بالذهب السيادي |
| | `text-status-safe` | نص أخضر ساطع (متصل / سليم) |
| | `text-status-danger` | نص أحمر ساطع (هجوم / محظور / خطأ) |
| **الحدود** | `border-hairline` | حد شعري دقيق جداً (0.08 شفافية) |
| | `border-gold-rim` | إطار ذهبي سيادي أنيق |
| | `border-gold-rim-strong` | إطار ذهبي بارز ومضيء |
| | `border-status-danger-border`| إطار أحمر لحالات الخطر |
| **الأنوية** | `border-core-01` .. `08` | إطار بلون النواة المحددة من 1 إلى 8 |
| | `text-core-01` .. `08` | نص بلون النواة المطابقة |
| **المسافات** | `p-space-4`, `p-space-6` | حشو داخلي 16px أو 24px |
| | `gap-space-3`, `gap-space-4` | فواصل شبكية 12px أو 16px |

---

## 5. أمثلة برمجية عملية للمطورين (Copy-Paste Component Recipes)

### أ. إنشاء بطاقة زجاجية إحصائية (Glass KPI Stat Card)
```tsx
import { Cpu } from 'lucide-react';

export function CoreStatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="relative p-space-5 rounded-lg bg-surface-glass backdrop-blur-xl border border-border-gold-rim shadow-lg overflow-hidden group hover:border-border-gold-rim-strong transition-all duration-300">
      {/* الخط الذهبي العلوي المتوهج */}
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-70 group-hover:opacity-100 transition-opacity" />

      <div className="flex items-center justify-between mb-2">
        <span className="text-muted text-caption font-semibold">{label}</span>
        <Cpu size={18} className="text-primary" />
      </div>

      <div className="text-title text-headline-lg font-bold font-telemetry" dir="ltr">
        {value}
      </div>
    </div>
  );
}
```

---

### ب. إنشاء أزرار النظام (Primary, Glass, and Danger Action Buttons)
```tsx
// زر الأساس الذهبي (Primary CTA)
<button className="py-2.5 px-space-5 rounded-sm bg-gradient-to-r from-primary via-[#f6be39] to-[#ffd700] text-primary-fg font-bold shadow-md hover:shadow-lg active:scale-[0.99] transition-all flex items-center gap-2">
  <span>حفظ وتطبيق السياسة</span>
</button>

// زر الزجاج السيادي (Glass Button)
<button className="py-2.5 px-space-4 rounded-sm bg-surface-glass-tint border border-border-gold-rim hover:bg-primary/10 text-title font-semibold transition-all flex items-center gap-2">
  <span>فحص السجلات</span>
</button>

// زر الحظر / الإلغاء الخطر (Danger Button)
<button className="py-2.5 px-space-4 rounded-sm bg-status-danger-surface border border-status-danger-border hover:bg-status-danger/25 text-status-danger font-semibold transition-all flex items-center gap-2">
  <span>حظر عنوان IP فورياً</span>
</button>
```

---

### ج. شارة حالة تشغيلية نابضة (Live Telemetry Status Badge)
```tsx
export function StatusPill({ status }: { status: 'safe' | 'warning' | 'danger' }) {
  const isSafe = status === 'safe';
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-semibold ${
      isSafe ? 'bg-status-safe-surface text-status-safe' : 'bg-status-danger-surface text-status-danger'
    }`}>
      <span className="relative flex h-2 w-2">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
          isSafe ? 'bg-status-safe' : 'bg-status-danger'
        }`} />
        <span className={`relative inline-flex rounded-full h-2 w-2 ${
          isSafe ? 'bg-status-safe' : 'bg-status-danger'
        }`} />
      </span>
      <span>{isSafe ? 'متصل ومحمي' : 'محيط العزل مفعل'}</span>
    </div>
  );
}
```

---

## 6. قواعد الاتجاهات والبيانات التقنية (Bidirectional & Telemetry Rules)

1. **الاتجاه العام RTL**: واجهة المنظومة مبنية من اليمين إلى اليسار (`dir="rtl"`) لكافة العناوين، القوائم الجانبية، الأزرار، والرسائل التوضيحية.
2. **عزل البيانات التقنية LTR**: أي نص تقني يتضمن:
   * عناوين IP أو نطاقات شبكية (`192.168.1.1` أو IPv6).
   * بصمات تشفيرية (`SHA-256`, `MD5`).
   * مؤشرات الذاكرة والمعالج والأرقام التنازلية (`64.5 MB`, `8.2%`, `-30s`).
   * منافذ الشبكة وأوامر الطرفية (`sc.exe`, `PID 4032`).
   
   **يجب دائماً** تغليفه بوسم يحمل السمة `dir="ltr"` واستخدام فئة الخط المونو:
   ```html
   <span dir="ltr" className="font-telemetry text-muted">194.26.29.114:8765</span>
   ```
3. **تجنب استخدام درجات Hex المباشرة في المكونات**: لا تقم بكتابة `#d4a017` أو `#131315` يدوياً داخل ملفات الصفحات والمكونات؛ استخدم دائماً فئات Tailwind (`text-title`, `bg-surface-glass`, `border-gold-rim`) أو المتغيرات (`var(--surface-canvas)`).
