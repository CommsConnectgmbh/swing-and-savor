/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        condensed: ['"Barlow Condensed"', 'sans-serif'],
        sans: ['"Barlow"', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      colors: {
        // Brand surfaces — dark to light, all green-tinted so the logo edge blends
        bg:        '#0d271e',
        surface:   '#143024',
        surface2:  '#1a3a2c',
        line:      '#244a37',
        lineSoft:  '#19362a',

        // Ink
        ink:       '#ffffff',
        inkMuted:  '#a8b5ad',
        inkDim:    '#6b7a72',

        // Brand accent
        accent:    '#98cd02',

        // Semantic state
        live:      '#98cd02',
        win:       '#98cd02',
        lock:      '#f5b94a',
        danger:    '#ef4444',
        warn:      '#f59e0b',

        // Match-play team identity (re-tuned for readability on dark green)
        teamA:     '#60a5fa',
        teamB:     '#fb7185',

        // Legacy aliases — keep so existing components render correctly
        brand:      '#1f3f2c',
        brandDark:  '#0d271e',
        brandGreen: '#98cd02',
        card:       '#143024',
        border:     '#244a37',
        muted:      '#6b7a72',
      },
      borderRadius: {
        'card': '16px',
        'pill': '999px',
      },
      boxShadow: {
        'lift': '0 6px 20px rgba(0,0,0,0.35)',
        'glow': '0 0 24px rgba(152,205,2,0.35)',
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
