/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg:      '#0a0a0a',
        surface: '#141414',
        border:  '#2a2a2a',
        accent:  '#22c55e',
        danger:  '#ef4444',
        warn:    '#f59e0b',
        muted:   '#6b7280',
      },
    },
  },
  plugins: [],
}
