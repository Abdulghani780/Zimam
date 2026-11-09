from pathlib import Path

p = Path('frontend/src/styles/app.css')
text = p.read_text(encoding='utf-8')

craft_polish = """

/* ───────── Impeccable Craft Polish Layer ───────── */

/* 1. Browser Surfaces Theming (Selection, Caret, Scrollbars) */
::selection {
  background: rgba(212, 160, 23, 0.35);
  color: #fcfaf7;
}

input, textarea, select {
  caret-color: var(--primary);
}

/* Global Smooth Thin Scrollbar */
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(212, 160, 23, 0.25) transparent;
}

::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(212, 160, 23, 0.25);
  border-radius: 9999px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(212, 160, 23, 0.5);
}

/* 2. Micro-interactions & Smooth Transitions */
button, .btn, .sidebar-link, .stat-card, a, [role="button"] {
  transition: transform 0.18s cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 0.2s cubic-bezier(0.16, 1, 0.3, 1),
              background-color 0.18s ease,
              border-color 0.18s ease,
              color 0.18s ease;
}

button:active:not(:disabled), .btn:active:not(:disabled), [role="button"]:active:not(:disabled) {
  transform: scale(0.975);
}

/* Stat Card Hover Depth */
.stat-card {
  transition: transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 0.25s cubic-bezier(0.16, 1, 0.3, 1),
              border-color 0.2s ease;
}
.stat-card:hover {
  border-color: rgba(212, 160, 23, 0.35);
  box-shadow: 0 12px 32px -4px rgba(0, 0, 0, 0.6), 0 0 20px -2px rgba(212, 160, 23, 0.15);
  transform: translateY(-2px);
}

/* Hero banners subtle elevation without thick borders */
.hero-banner {
  border: 1px solid rgba(212, 160, 23, 0.22) !important;
  box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.5);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}
.hero-banner:hover {
  border-color: rgba(212, 160, 23, 0.45) !important;
  box-shadow: 0 12px 32px -4px rgba(0, 0, 0, 0.65), 0 0 24px -2px rgba(212, 160, 23, 0.2);
}

/* Sidebar links directional hover */
.sidebar-link:hover {
  transform: translateX(-3px);
  color: var(--text-1);
}
[dir="ltr"] .sidebar-link:hover {
  transform: translateX(3px);
}

/* 3. Universal WCAG-Compliant Focus Rings */
:focus-visible {
  outline: none !important;
  box-shadow: 0 0 0 2px var(--surface-canvas, #0c0c0e), 0 0 0 4px var(--primary, #d4a017) !important;
}

/* 4. Table Row Smooth Highlight & Focus */
.app-table tbody tr:hover, [data-row]:hover {
  background-color: rgba(212, 160, 23, 0.05);
}

/* 5. Zero Layout Shift (CLS < 0.01) Container Stability */
.oscilloscope-canvas-wrap {
  min-height: 220px;
  contain: layout;
}

/* 6. Mobile Viewport & Safe Area Containment */
@media (max-width: 900px) {
  .page-container {
    padding: 16px 14px max(84px, calc(70px + env(safe-area-inset-bottom)));
  }
}

/* 7. Reduced Motion Support */
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
"""

if '/* ───────── Impeccable Craft Polish Layer ───────── */' not in text:
    text += craft_polish
    p.write_text(text, encoding='utf-8')
    print("app.css updated with Impeccable craft polish!")
else:
    print("Already present in app.css")
