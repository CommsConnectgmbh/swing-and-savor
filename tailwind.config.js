/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:       '#05070a',
        surface:  'rgba(255,255,255,0.04)',
        elevated: 'rgba(255,255,255,0.08)',
        border:   'rgba(255,255,255,0.10)',
        hairline: 'rgba(255,255,255,0.06)',
        ink:      '#f5f7fa',
        muted:    '#8a92a3',
        subtle:   '#5b6473',
        fairway:  '#22c55e',
        rough:    '#15803d',
        flag:     '#ef4444',
        sand:     '#f59e0b',
        sky:      '#38bdf8',
        teamA:    '#3b82f6',
        teamB:    '#ef4444',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', 'SF Pro Text', 'Inter', 'Segoe UI', 'sans-serif'],
        display: ['"SF Pro Display"', '-apple-system', 'BlinkMacSystemFont', 'Inter', 'sans-serif'],
        mono: ['"SF Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem',
        '4xl': '2.25rem',
      },
      boxShadow: {
        glass:    '0 1px 0 rgba(255,255,255,0.08) inset, 0 -1px 0 rgba(255,255,255,0.04) inset, 0 20px 50px -20px rgba(0,0,0,0.6)',
        'glass-lg':'0 1px 0 rgba(255,255,255,0.10) inset, 0 -1px 0 rgba(255,255,255,0.05) inset, 0 30px 80px -30px rgba(0,0,0,0.7)',
        glow:     '0 0 0 1px rgba(34,197,94,0.35), 0 10px 40px -10px rgba(34,197,94,0.45)',
        pressed:  'inset 0 1px 2px rgba(0,0,0,0.4)',
      },
      backdropBlur: {
        xs: '4px',
      },
      animation: {
        'fade-in':   'fadeIn 0.35s ease-out',
        'slide-up':  'slideUp 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
        'pop':       'pop 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'shimmer':   'shimmer 2.4s linear infinite',
        'aurora':    'aurora 18s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:  { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        slideUp: { '0%': { transform: 'translateY(12px)', opacity: 0 }, '100%': { transform: 'translateY(0)', opacity: 1 } },
        pop:     { '0%': { transform: 'scale(0.92)', opacity: 0 }, '60%': { transform: 'scale(1.04)' }, '100%': { transform: 'scale(1)', opacity: 1 } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        aurora:  {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%':     { transform: 'translate3d(2%, -3%, 0) scale(1.08)' },
        },
      },
    },
  },
  plugins: [],
}
