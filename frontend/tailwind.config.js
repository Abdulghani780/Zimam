/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* -------------------------------------------------------------
         * SEMANTIC SURFACES (Driven by Design Tokens)
         * ----------------------------------------------------------- */
        canvas: "var(--surface-canvas)",
        ground: "var(--surface-ground)",
        surface: {
          DEFAULT: "var(--surface-ground)",
          canvas: "var(--surface-canvas)",
          alt: "var(--surface-alt)",
          dim: "var(--surface-container-low)",
          bright: "var(--surface-container-highest)",
          glass: "var(--surface-glass)",
          "glass-tint": "var(--surface-glass-tint)",
          "glass-tint-strong": "var(--surface-glass-tint-strong)",
          lowest: "var(--surface-container-lowest)",
          low: "var(--surface-container-low)",
          container: "var(--surface-container)",
          high: "var(--surface-container-high)",
          highest: "var(--surface-container-highest)",
        },

        /* -------------------------------------------------------------
         * SOVEREIGN BRAND METALLICS & ACTIONS
         * ----------------------------------------------------------- */
        primary: {
          DEFAULT: "var(--action-primary)",
          hover: "var(--action-primary-hover)",
          fg: "var(--action-primary-fg)",
          container: "var(--primitive-color-gold-500)",
          fixed: "var(--primitive-color-gold-100)",
          "fixed-dim": "var(--primitive-color-gold-400)",
        },
        gold: {
          DEFAULT: "var(--primitive-color-gold-500)",
          glow: "var(--primitive-color-gold-400)",
          shade: "var(--primitive-color-gold-700)",
          rim: "var(--border-gold-rim)",
          "rim-strong": "var(--border-gold-rim-strong)",
        },

        /* -------------------------------------------------------------
         * TYPOGRAPHY & LUMINANCE
         * ----------------------------------------------------------- */
        text: {
          title: "var(--text-title)",
          body: "var(--text-body)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          gold: "var(--text-gold)",
          inverse: "var(--text-inverse)",
        },

        /* -------------------------------------------------------------
         * BORDERS & OUTLINES
         * ----------------------------------------------------------- */
        border: {
          hairline: "var(--border-hairline)",
          "hairline-strong": "var(--border-hairline-strong)",
          "gold-rim": "var(--border-gold-rim)",
          "gold-rim-strong": "var(--border-gold-rim-strong)",
        },

        /* -------------------------------------------------------------
         * DIAGNOSTICS & TELEMETRY STATUSES
         * ----------------------------------------------------------- */
        status: {
          safe: "var(--status-safe)",
          "safe-surface": "var(--status-safe-surface)",
          "safe-border": "var(--status-safe-border)",
          warning: "var(--status-warning)",
          "warning-surface": "var(--status-warning-surface)",
          "warning-border": "var(--status-warning-border)",
          danger: "var(--status-danger)",
          "danger-surface": "var(--status-danger-surface)",
          "danger-border": "var(--status-danger-border)",
          info: "var(--status-info)",
          "info-surface": "var(--status-info-surface)",
          "info-border": "var(--status-info-border)",
        },

        /* -------------------------------------------------------------
         * HARDWARE CORES DIAGNOSTIC ARRAY
         * ----------------------------------------------------------- */
        core: {
          "01": "var(--primitive-core-01)",
          "02": "var(--primitive-core-02)",
          "03": "var(--primitive-core-03)",
          "04": "var(--primitive-core-04)",
          "05": "var(--primitive-core-05)",
          "06": "var(--primitive-core-06)",
          "07": "var(--primitive-core-07)",
          "08": "var(--primitive-core-08)",
        },

        /* -------------------------------------------------------------
         * DIRECT STITCH COMPATIBILITY ALIASES
         * ----------------------------------------------------------- */
        "outline": "var(--primitive-color-carbon-400)",
        "outline-variant": "var(--border-hairline)",
        "surface-dim": "var(--surface-container-low)",
        "surface-bright": "var(--surface-container-highest)",
        "surface-container-lowest": "var(--surface-container-lowest)",
        "surface-container-low": "var(--surface-container-low)",
        "surface-container": "var(--surface-container)",
        "surface-container-high": "var(--surface-container-high)",
        "surface-container-highest": "var(--surface-container-highest)",
        "on-surface": "var(--text-title)",
        "on-surface-variant": "var(--text-secondary)",
        "inverse-surface": "var(--text-title)",
        "inverse-on-surface": "var(--surface-ground)",
        "surface-tint": "var(--action-primary)",
        "primary-container": "var(--primitive-color-gold-500)",
        "on-primary": "var(--action-primary-fg)",
        "on-primary-container": "var(--primitive-color-gold-950)",
        "secondary": "#fff9ef",
        "on-secondary": "#3a3000",
        "secondary-container": "#ffdb3c",
        "on-secondary-container": "#725f00",
        "tertiary": "#e9c07c",
        "on-tertiary": "#422c00",
        "tertiary-container": "#c8a261",
        "on-tertiary-container": "#523800",
        "error": "var(--status-danger)",
        "on-error": "#690005",
        "error-container": "#93000a",
        "on-error-container": "#ffdad6",
        "canvas-background": "var(--surface-canvas)",
        "surface-glass": "var(--surface-glass)",
        "surface-alt": "var(--surface-alt)",
        "surface-glass-tint": "var(--surface-glass-tint)",
        "gold-glow": "var(--primitive-color-gold-400)",
        "gold-shade": "var(--primitive-color-gold-700)",
        "gold-rim": "var(--border-gold-rim)",
        "text-titles": "var(--text-title)",
        "text-body": "var(--text-body)",
        "text-muted": "var(--text-muted)",
        "status-safe": "var(--status-safe)",
        "status-safe-surface": "var(--status-safe-surface)",
        "status-warning": "var(--status-warning)",
        "status-warning-surface": "var(--status-warning-surface)",
        "status-danger": "var(--status-danger)",
        "status-danger-surface": "var(--status-danger-surface)",
        "status-info": "var(--status-info)",
        "status-info-surface": "var(--status-info-surface)",
        "core-01": "var(--primitive-core-01)",
        "core-02": "var(--primitive-core-02)",
        "core-03": "var(--primitive-core-03)",
        "core-04": "var(--primitive-core-04)",
        "core-05": "var(--primitive-core-05)",
        "core-06": "var(--primitive-core-06)",
        "core-07": "var(--primitive-core-07)",
        "core-08": "var(--primitive-core-08)",
      },
      borderRadius: {
        "xs": "var(--primitive-radius-xs)",
        "sm": "var(--primitive-radius-sm)",
        "DEFAULT": "var(--primitive-radius-sm)",
        "md": "var(--primitive-radius-md)",
        "lg": "var(--primitive-radius-lg)",
        "xl": "var(--primitive-radius-xl)",
        "2xl": "var(--primitive-radius-2xl)",
        "full": "var(--primitive-radius-full)",
      },
      spacing: {
        "space-1": "var(--primitive-space-1)",
        "space-2": "var(--primitive-space-2)",
        "space-3": "var(--primitive-space-3)",
        "space-4": "var(--primitive-space-4)",
        "space-5": "var(--primitive-space-5)",
        "space-6": "var(--primitive-space-6)",
        "space-8": "var(--primitive-space-8)",
        "space-10": "var(--primitive-space-10)",
        "space-12": "var(--primitive-space-12)",
        "space-16": "var(--primitive-space-16)",
        "space-xs": "var(--primitive-space-1)",
        "space-sm": "var(--primitive-space-2)",
        "space-md": "var(--primitive-space-4)",
        "space-lg": "var(--primitive-space-6)",
        "space-xl": "var(--primitive-space-8)",
        "space-2xl": "var(--primitive-space-12)",
        "gutter": "var(--frame-gutter)",
        "gutter-lg": "var(--frame-margin)",
        "margin": "var(--frame-margin)",
        "margin-mobile": "var(--primitive-space-4)",
      },
      fontFamily: {
        sans: ["Thmanyah Sans", "system-ui", "sans-serif"],
        serif: ["Thmanyah Serif Display", "serif"],
        mono: ["JetBrains Mono", "Consolas", "monospace"],
        "body-base": ["Thmanyah Sans", "system-ui", "sans-serif"],
        "display-metric-mobile": ["Thmanyah Serif Display", "serif"],
        "title-sm": ["Thmanyah Sans", "system-ui", "sans-serif"],
        "title-md": ["Thmanyah Sans", "system-ui", "sans-serif"],
        "telemetry-mono-sm": ["JetBrains Mono", "Consolas", "monospace"],
        "body-sm": ["Thmanyah Sans", "system-ui", "sans-serif"],
        "caption": ["Thmanyah Sans", "system-ui", "sans-serif"],
        "headline-lg": ["Thmanyah Serif Display", "serif"],
        "headline-md": ["Thmanyah Serif Display", "serif"],
        "display-metric": ["Thmanyah Serif Display", "serif"],
        "headline-sm": ["Thmanyah Serif Display", "serif"],
        "telemetry-mono": ["JetBrains Mono", "Consolas", "monospace"],
      },
      fontSize: {
        "body-base": ["14px", { lineHeight: "22px", fontWeight: "500" }],
        "display-metric-mobile": ["28px", { lineHeight: "36px", letterSpacing: "-0.01em", fontWeight: "800" }],
        "title-sm": ["15px", { lineHeight: "22px", fontWeight: "600" }],
        "title-md": ["16px", { lineHeight: "24px", fontWeight: "600" }],
        "telemetry-mono-sm": ["11px", { lineHeight: "16px", fontWeight: "400" }],
        "body-sm": ["13px", { lineHeight: "20px", fontWeight: "400" }],
        "caption": ["11px", { lineHeight: "16px", fontWeight: "400" }],
        "headline-lg": ["24px", { lineHeight: "32px", letterSpacing: "-0.01em", fontWeight: "700" }],
        "headline-md": ["20px", { lineHeight: "28px", fontWeight: "700" }],
        "display-metric": ["36px", { lineHeight: "44px", letterSpacing: "-0.02em", fontWeight: "800" }],
        "headline-sm": ["18px", { lineHeight: "26px", fontWeight: "700" }],
        "telemetry-mono": ["13px", { lineHeight: "18px", fontWeight: "500" }],
      },
    },
  },
};
