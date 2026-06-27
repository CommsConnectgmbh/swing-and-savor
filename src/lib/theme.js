// App-wide colour theme (dark ⇄ light).
//
// The actual colours live as CSS custom properties in index.css — `:root`
// holds the dark palette, `html[data-theme="light"]` overrides it. All we do
// here is flip the `data-theme` attribute on <html> and remember the choice.
// Tailwind tokens (bg, surface, ink, accent …) resolve to those variables, so
// a single attribute switch repaints the whole app.

const STORAGE_KEY = 'sw_theme'
export const THEMES = ['dark', 'light']
// App startet hell; Dunkel ist optional über den Umschalter im Profil.
const DEFAULT_THEME = 'light'

// Browser-Chrome (Statusleiste) passend einfärben.
const THEME_COLOR = { dark: '#0A1A12', light: '#EFEBE1' }

export function getStoredTheme() {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return THEMES.includes(v) ? v : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

// Reflect a theme onto the document and persist it. Safe to call before React
// mounts (used by main.jsx to avoid a flash of the wrong palette).
export function applyTheme(theme) {
  const next = THEMES.includes(theme) ? theme : DEFAULT_THEME
  const root = document.documentElement
  root.setAttribute('data-theme', next)
  // Lets the browser paint native UI (form controls, scrollbars) to match.
  root.style.colorScheme = next
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLOR[next])
  try { localStorage.setItem(STORAGE_KEY, next) } catch {}
  return next
}

// Read the theme currently reflected on <html> (falls back to storage).
export function getCurrentTheme() {
  const attr = document.documentElement.getAttribute('data-theme')
  return THEMES.includes(attr) ? attr : getStoredTheme()
}
