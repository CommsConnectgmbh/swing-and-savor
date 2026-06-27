/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Editorial display (Fraunces, variable serif)
        serif:     ['"Fraunces"', 'Georgia', 'serif'],
        // UI grotesk
        sans:      ['"Inter"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        // Legacy alias (used in BrandHeader etc.) — kept so existing code renders
        condensed: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        // Colours are driven by CSS variables (see index.css) so the whole app
        // can flip between the dark forest palette and a light bone palette via
        // `html[data-theme="light"]`. Channel-triple form keeps Tailwind's
        // `/<alpha>` opacity utilities (e.g. `bg-accent/12`) working.

        // ---- Forest Green base (Premium Golf Club) ----
        bg:        'rgb(var(--c-bg) / <alpha-value>)',        // deepest forest
        surface:   'rgb(var(--c-surface) / <alpha-value>)',   // moss-on-shadow
        surface2:  'rgb(var(--c-surface2) / <alpha-value>)',  // raised surface
        line:      'rgb(var(--c-line) / <alpha-value>)',      // hairline border tint
        lineSoft:  'rgb(var(--c-lineSoft) / <alpha-value>)',

        // ---- Ink (Bone on Forest) ----
        ink:       'rgb(var(--c-ink) / <alpha-value>)',       // bone
        inkMuted:  'rgb(var(--c-inkMuted) / <alpha-value>)',  // muted sage-tinted bone
        inkDim:    'rgb(var(--c-inkDim) / <alpha-value>)',

        // ---- Brand accent: Champagne / Gold ----
        accent:    'rgb(var(--c-accent) / <alpha-value>)',
        accentDeep:'rgb(var(--c-accentDeep) / <alpha-value>)',

        // ---- Course Green (semantic, sparingly) ----
        course:    'rgb(var(--c-course) / <alpha-value>)',    // sage / fairway green for "live" dots

        // ---- Semantic ----
        live:      'rgb(var(--c-accent) / <alpha-value>)',
        win:       'rgb(var(--c-accent) / <alpha-value>)',
        lock:      'rgb(var(--c-accentDeep) / <alpha-value>)',
        danger:    'rgb(var(--c-danger) / <alpha-value>)',
        warn:      'rgb(var(--c-warn) / <alpha-value>)',

        // Team identity (gedeckt, lifestyle-tauglich) — pastels that read on
        // both palettes (also used as winner-cell fills with dark ink).
        teamA:     'rgb(var(--c-teamA) / <alpha-value>)',
        teamB:     'rgb(var(--c-teamB) / <alpha-value>)',

        // Legacy aliases — keep so existing components render correctly.
        // `brandDark` stays a fixed dark ink: it is the contrast colour painted
        // on top of the champagne accent (`bg-accent text-brandDark`), so it
        // must NOT flip with the theme.
        brand:      'rgb(var(--c-surface) / <alpha-value>)',
        brandDark:  '#0A1A12',
        brandGreen: 'rgb(var(--c-accent) / <alpha-value>)',
        card:       'rgb(var(--c-surface) / <alpha-value>)',
        border:     'rgb(var(--c-line) / <alpha-value>)',
        muted:      'rgb(var(--c-inkDim) / <alpha-value>)',
      },
      borderRadius: {
        'card': '14px',
        'pill': '999px',
      },
      boxShadow: {
        'lift': '0 8px 24px rgba(0,0,0,0.55)',
        'glow': '0 0 24px rgba(217,201,168,0.28)',
        'hairline': 'inset 0 0 0 1px rgba(244,241,234,0.08)',
      },
      letterSpacing: {
        'editorial': '0.18em',
      },
      keyframes: {
        'fade-up': {
          '0%':   { opacity: 0, transform: 'translateY(6px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 240ms ease-out both',
      },
    },
  },
  plugins: [],
}
