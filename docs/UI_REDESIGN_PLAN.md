# ASAAS Console — خطة إعادة التصميم الشاملة (Signature Edition)

> الهدف: واجهة feels like a physical luxury instrument — not a dashboard template.
> المرجعيات: هوية ASAAS الرسمية (brand.md) + Apple Design Principles + Pinterest-grade art direction.

> **الحالة: مكتملة ✅** — نُفذت المراحل 0–5 (Foundation → Shell → Pages → Polish → Verification).
> التحقق: 76 screenshot (20 صفحة × ديسكتوب/موبايل × ثيمين)، 8/8 smoke، صفر أخطاء، صفر overflow،
> صفر مشاكل a11y، تغطية ترجمة 100% (1,584 مفتاح ar/en مع تبديل RTL/LTR كامل).

---

## 1. الرؤية — "المقصورة السيادية"

المنتج ليس dashboard عادي — هو **غرفة عمليات سيادية** تدير خوادم دولة. التصميم يجب أن يوحي بـ:

- **الهدوء السلطوي**: كل بكسل مقصود، لا ضجيج، لا decorations عبثية
- **العمق المادي**: طبقات زجاجية حقيقية، ضوء يلمع من اتجاه واحد، أسطح تُحس لا تُرى فقط
- **الخط كهوية**: ثمانية Serif Display للعناوين + swash/Stretch في اللحظات التعبيرية — هذا ما يميزنا عن أي dashboard غربي
- **الحياة**: حركة فيزيائية مقاطِعة (interruptible springs) — الواجهة تستجيب لللمس فوراً

**ممنوع**: neon cyberpunk، gradients عشوائية، أرقام mono، scanlines، أي شيء "هاكرواني". هذا مشروع حكومي فاخر — مو movie props.

---

## 2. مراجع Pinterest — اتجاهات مختارة

| الاتجاه | المرجع | نأخذ منه |
|---|---|---|
| **Editorial Luxury** | Kendall Jenner/Revive-led brand sites, high-end Arabic perfume/jewellery pages | طبقات عمق، whitespace واسع، serif display كبير، صورة hero واحدة قوية |
| **Spatial OS** | Apple Vision Pro interfaces, iPadOS materials | translucency متدرجة، dimming scrims، material weight = hierarchy |
| **Mission Control** | NASA/JPL mission control aesthetics | دقة بيانات، grid صارم، أرقام tabular، لكن بهدوء |
| **Arabic Editorial** | مواقع بنوك خليجية فاخرة (الراجحي، أبيك) | خط عربي display، تنسيق أرقام لاتينية، voice رسمي ودافئ |

**الكلمة المفتاحية**: *Restraint*. الفخامة = حذف لا إضافة.

---

## 3. نظام الهوية — Tokens

### 3.1 الألوان (dark theme is canonical — شاشة عمليات ليلية)

نعود للهوية الرسمية لكن بعمق أعلى:

```
--bg:            #0e0c0a   (near-black دافئ — ليس أزرق)
--surface-1:     #16130f   (ground)
--surface-2:     #1e1a15   (container)
--surface-3:     #28231c   (raised)
--ink:           #f5efe4   (نص أساسي)
--ink-2:         #c9bfa9   (ثانوي)
--ink-3:         #8a7f6a   (meta)
--gold:          #d4af6a   (accent — أدفأ من #ba9555، يتوهج على الأسود)
--gold-bright:   #e8c98a   (hover/active)
--gold-dim:      rgba(212,175,106,.12)  (soft fills)
--hairline:      rgba(245,239,228,.08)
--paid:          #7bc98f   (أخضر هادئ)
--warning:       #e0b25c
--danger:        #e07a6a
```

**قاعدة ذهبية**: اللون الوحيد المميز = Gold. لا cyan، لا neon، لا purple. الحالة (success/warn/danger) reserved.

### 3.2 الزجاج — ثلاث درجات فقط (Apple material hierarchy)

```
--glass-nav:     blur(28px) saturate(160%) — rails, sidebar, headers
--glass-card:    blur(20px) saturate(140%) — panels, stat cards
--glass-pop:     blur(40px) saturate(180%) — modals, drawers (الأثقل)
```

- لا stacking زجاج على زجاج — card داخل card = surface صلب `--surface-2`
- كل زجاج له specular edge واحد: `inset 0 1px 0 rgba(255,255,255,.5)` + rim gradient

### 3.3 التايبوغرافي — ثمانية بخطة three-tier

| الدور | Font | الحجم | Weight | Tracking |
|---|---|---|---|---|
| Display (hero/أرقام كبيرة) | Thmanyah Serif Display | clamp(28-56px) | 700 | -0.02em |
| Titles (page h1, card titles) | Thmanyah Serif Display | 20-26px | 700 | -0.01em |
| UI/Body | Thmanyah Sans | 14-15px | 400/500 | 0 |
| Numbers/data | Thmanyah Sans + `font-variant-numeric: tabular-nums` | inherits | 500 | 0 |
| Arabic prose | Thmanyah Serif Text | 15px | 400 | 0 |

**اللمسات التعبيرية** (من brand.md):
- `<Swash>` على آخر حرف من عنوان واحد في الصفحة hero فقط
- `<Stretch>` في تحية/لحظة واحدة — "مســاء الخير" في login
- **أبداً** mono font, أبداً cyber styling

### 3.4 Shape & Depth

```
--radius-xl: 24px   (cards, panels)
--radius-lg: 18px   (buttons inner, wells)
--radius-md: 12px   (inputs, small cards)
--radius-pill: 999px (buttons, badges, chips)

--shadow-card:  0 1px 2px rgba(0,0,0,.4), 0 12px 32px -12px rgba(0,0,0,.6)
--shadow-pop:   0 24px 64px -16px rgba(0,0,0,.7), 0 0 0 1px var(--hairline)
--shadow-gold:  0 0 24px -4px rgba(212,175,106,.35)  (active/focus فقط)
```

---

## 4. الحركة — Apple Fluid Interface principles

### 4.1 Motion tokens

```css
--dur-instant: 120ms   /* press feedback, hover */
--dur-fast:    220ms   /* color, opacity */
--dur-base:    380ms   /* cards, panels */
--dur-slow:    560ms   /* page transitions, drawers */

--ease-standard: cubic-bezier(0.2, 0, 0, 1)
--ease-out:     cubic-bezier(0.22, 1, 0.36, 1)
--ease-spring:  cubic-bezier(0.34, 1.4, 0.64, 1)   /* للـ overshoot المقصود فقط */
```

### 4.2 القواعد

1. **كل حركة transform+opacity فقط** — لا width/height/top/left
2. **Page transitions**: enter = fade + translateY(8px) + slight scale(.985) → 0؛ exit معكوس تماماً
3. **Cards hover**: translateY(-2px) + shadow تعمّق — 250ms ease-out
4. **Modals/drawers**: scale from trigger + fade scrim — spring damping 1.0 response 0.4
5. **Stagger**: عناصر الصفحة تتأخر 40ms لكل واحد (max 8 عناصر)
6. **Reduced motion**: كل شيء → cross-fade 150ms
7. **No looping animations** في الـ chrome — الـ ambient ثابت أو يتنفس ببطء شديد (>20s cycle)

### 4.3 اللمسات الحية (Apple "direct manipulation")

- Buttons: `:active` scale(0.97) فوري (100ms) — مش على release
- Sidebar links: background transition 150ms
- Cards: hover state فوري
- Inputs: focus ring gold glow
- **لا** parallax, لا scroll-jacking, لا auto-playing carousels

---

## 5. Art Direction — الصفحة الرئيسية (Overview)

الصفحة الرئيسية = **غلاف المجلة**: أول ما يشوفه المستخدم يجب أن يبهر.

### 5.1 Hero Panel (أول شاشة)

```
┌─────────────────────────────────────────────────────┐
│  ╭─ gradient gold hairline ─╮                      │
│  │  ASAAS CONTROL            │   [status pill]    │
│  │  لوحة القيادة السيادية     │                    │
│  │  "مســاء الخير"             │   [4 stat chips]  │
│  │                            │                    │
│  │  [big serif display]       │                    │
│  ╰────────────────────────────╯                    │
│                                                     │
│  Ambient: 3 orbs gold/crimson واضحة جداً           │
│  Pattern: diamond lattice خفيف (logo echo)          │
│  Watermark: logo-dark opacity 0.04                  │
└─────────────────────────────────────────────────────┘
```

- h1 بـ Serif Display + Swash على آخر كلمة
- Subtitle بـ Serif Text
- Status chips = pills زجاجية صغيرة
- خلفية الـ hero: gradient radial من gold (8%) في الزاوية

### 5.2 Stat Cards — "command deck tiles"

```
┌──────────────┐
│  ● CPU        │  ← dot + label (small caps)
│  42%          │  ← Serif Display 40px tabular
│  ▁▂▃▅▇ spark  │  ← sparkline SVG حقيقي أو "—"
│  +2.1% 24h   │  ← delta pill
└──────────────┘
```

- الزجاج + gold hairline top
- Hover: lift + gold glow
- Numbers: tabular-nums + weight 700
- **لا sparkline وهمي** — إذا لا بيانات → "—" صادق

### 5.3 الجداول — "ledger" style

- Header: small caps + tracking أوسع + gold underline
- Rows: hairline separators فقط، no zebra
- Row hover: `rgba(212,175,106,.04)` subtle
- Status: dot + text (مش badge ملوّن صارخ)
- Numbers right-aligned (في RTL = left) tabular

---

## 6. صفحة الدخول — أول انطباع

```
┌──────────────────────────────────────┐
│         [logo] ASAAS                 │
│                                      │
│      «مســاء الخير»                   │  ← Stretch on greeting
│      لوحة القيادة السيادية           │  ← Serif Display
│                                      │
│   ┌──────────────────────────┐      │
│   │  [input]                 │      │
│   │  [input]                 │      │
│   │  [● دخول]                │      │
│   └──────────────────────────┘      │
│                                      │
│   "وصول مقيد • كل عملية مدققة"       │  ← small trust line
└──────────────────────────────────────┘
```

- Card زجاجية thick + gold rim glow
- زر primary = gold gradient (مش neon)
- خلفية: ambient orbs gold/crimson + logo watermark كبير جداً شفاف
- **لا** scanlines, **لا** grids — هدوء مطلق

---

## 7. المكونات — مواصفات كل واحد

### Button
- Primary: gold gradient (top light → bottom deep) + specular edge + glow
- Glass: translucent + blur
- Ghost: text only, hover = inset gold tint
- Danger: crimson subdued (not neon red)
- `:active` = scale(.97) + shadow collapse — فوري

### Card / Glass
- Radius 24px
- Specular top edge + gradient rim (135deg)
- Shadow: soft + deep
- Hover (if interactive): translateY(-2px) + border gold .3

### Input
- Height 48px, radius 12px
- Inset well (not floating)
- Focus: gold ring + subtle glow
- Error: crimson ring + message

### Table
-见上 §5.3
- Sticky header with blur backdrop
- Pagination: minimal ghost buttons

### Modal/Drawer
- Scale .96→1 + fade, spring damping 1.0
- Scrim: `rgba(10,8,6,.6)` + blur(8px)
- Origin: from trigger (bottom-sheet on mobile)

### Sidebar
- Width 264px, glass-nav
- Active: gold pill + left bar indicator
- Sections: label small-caps tracking
- Collapse on mobile → drawer

### Status pills
- Dot + text, subdued colors
- `paid` green, `warning` amber, `danger` crimson — always with icon

---

## 8. الخلفية Ambient — "المقصورة"

```
Layer 0: bg #0e0c0a (warm black)
Layer 1: 3 radial orbs:
  - gold #d4af6a @ top-right (opacity .18)
  - crimson #8b3a3a @ bottom-left (opacity .12)
  - warm gray #4a4038 @ center (opacity .08)
Layer 2: diamond lattice pattern (logo echo) opacity .03
Layer 3: logo watermark opacity .035 (bottom-left, rotated)
Layer 4: vignette radial (edges darker)
```

- **Static** — لا animation على الـ orbs (Apple: material stability)
- Update happens only on theme change

---

## 9. الصفحات — خطة تنفيذ لكل واحدة

| الصفحة | التغيير الرئيسي |
|---|---|
| Overview | Hero editorial + stat tiles + activity ledger |
| Governor | Command-center grid, real gauges, no fake metrics |
| Servers/Assets | Card grid → ledger list, detail drawer bottom-sheet |
| Vault | Vault door metaphor — sealed cards, reveal animation |
| Users | Table + role badges + modal forms |
| Audit | Timeline-style chain visualization |
| Bastion | Session cards + connect flow |
| Agents | Status grid + job dispatch modal |
| Login | Editorial split: brand left, form right (desktop) |
| Settings | Grouped sections, toggles |

---

## 10. مراحل التنفيذ

### Phase 1 — Foundation (tokens + primitives)
- [ ] إعادة كتابة `tokens.css` dark theme → warm black + gold
- [ ] `design-tokens.css` semantic → gold/cyan→gold remap
- [ ] `glass.css` → 3 material tiers + specular edges
- [ ] `components.css` → buttons, inputs, cards gold spec
- [ ] `app.css` → إزالة cyber layer + إضافة luxury layer نظيف
- [ ] `Ambient` → warm orbs + lattice + watermark
- [ ] Typography → tracking/leading polish + swash/Stretch wiring

### Phase 2 — Shell & Navigation
- [ ] Sidebar → gold pill active + glass-nav
- [ ] Header → translucent + scroll edge blur
- [ ] Mobile nav → bottom bar + drawer
- [ ] Page transitions → staggered rise

### Phase 3 — Pages (one by one)
- [ ] Overview (hero + stats + ledger)
- [ ] Governor
- [ ] Assets/Servers
- [ ] Vault
- [ ] Users
- [ ] Audit
- [ ] Bastion
- [ ] Agents
- [ ] Remaining 10 pages

### Phase 4 — Polish & Motion
- [ ] Spring physics on modals/drawers
- [ ] Hover states audit
- [ ] Focus rings gold
- [ ] Reduced-motion pass
- [ ] Empty states editorial

### Phase 5 — Verification
- [ ] Screenshot diff every page dark theme
- [ ] Mobile 390px + tablet 768px + desktop 1440px
- [ ] Playwright smoke 8/8
- [ ] tsc + lint + build
- [ ] Arabic text rendering check (swash/Stretch)

---

## 11 — معايير القبول

- [ ] **لا ذهبي صارخ** — gold فقط كـ accent، مو كل شيء
- [ ] **لا neon/cyber** — убран полностью
- [ ] **Swash/Stretch** مستخدمان في الأماكن الصحيحة فقط
- [ ] **3 درجات زجاج فقط** — لا stacking
- [ ] **كل الأرقام tabular** — لا跳动
- [ ] **Motion <400ms** — لا شيء أطول
- [ ] **Empty states** editorial مو "لا توجد بيانات"
- [ ] **0 console errors** + **0 fake metrics**
- [ ] **يعمل على 390px → 2560px**

---

## 12. مخاطر & قرارات

| القرار | الاختيار | السبب |
|---|---|---|
| Dark-only؟ | نعم default + light theme ثانوي | شاشة عمليات = ليلية |
| خط الأرقام | Thmanyah Sans tabular | مو mono — هوية مو cyber |
| الصور/illustrations | لا — typographic only | فخامة = restraint |
| Hover effects | subtle lift + glow | مو scale كبير |
| Loading | skeletons matching layout | مو spinners |

---

*الخطة جاهزة للتنفيذ — Phase 1 يبدأ بتغيير tokens ثم نبني فوقها.*
