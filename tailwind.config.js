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
        // ---- Forest Green base (Premium Golf Club) ----
        bg:        '#0A1A12',  // deepest forest, almost black with green hue
        surface:   '#102822',  // moss-on-shadow
        surface2:  '#16332B',  // raised surface
        line:      '#1F4537',  // hairline border tint
        lineSoft:  '#15302A',

        // ---- Ink (Bone on Forest) ----
        ink:       '#F4F1EA',  // bone
        inkMuted:  '#9CAFA4',  // muted sage-tinted bone
        inkDim:    '#5C7068',

        // ---- Brand accent: Champagne / Gold ----
        accent:    '#D9C9A8',
        accentDeep:'#A8956A',

        // ---- Course Green (semantic, sparingly) ----
        course:    '#5C9A6E',  // sage / fairway green for "live" dots

        // ---- Semantic ----
        live:      '#D9C9A8',
        win:       '#D9C9A8',
        lock:      '#A8956A',
        danger:    '#E07B5B',
        warn:      '#D9B26A',

        // Team identity (gedeckt, lifestyle-tauglich)
        teamA:     '#9BB5C9',
        teamB:     '#D9A38E',

        // Legacy aliases — keep so existing components render correctly
        brand:      '#102822',
        brandDark:  '#0A1A12',
        brandGreen: '#D9C9A8',  // mapped to champagne, so old "brandGreen" CTAs still work
        card:       '#102822',
        border:     '#1F4537',
        muted:      '#5C7068',
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
