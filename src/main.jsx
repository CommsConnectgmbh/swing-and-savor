import './sentry'
import * as Sentry from '@sentry/react'
import ReactDOM from 'react-dom/client'
import { applyTheme, getStoredTheme } from './lib/theme'
import './index.css'

// Reflect the saved colour theme before the first paint (no flash).
applyTheme(getStoredTheme())

const root = ReactDOM.createRoot(document.getElementById('root'))

// lib/supabase (and everything that depends on it) throws at import time
// when these are missing, which would otherwise crash the whole app before
// a single React component renders. Check first so a misconfigured deploy
// shows a readable message instead of a blank page.
if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
  Sentry.captureException(
    new Error('App-Start abgebrochen: VITE_SUPABASE_URL und/oder VITE_SUPABASE_ANON_KEY fehlen.')
  )
  root.render(
    <div role="alert" style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1>Die App ist vorübergehend nicht verfügbar</h1>
      <p>Bitte versuche es in Kürze erneut.</p>
    </div>
  )
} else {
  import('./bootstrap').then(({ default: renderApp }) => renderApp(root))
}
