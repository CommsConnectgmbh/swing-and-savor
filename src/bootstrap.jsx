import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './lib/auth'
import ErrorReportsBanner from './components/ErrorReportsBanner'
import './lib/i18n'

export default function renderApp(root) {
  root.render(
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <App />
          <ErrorReportsBanner />
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  )
}
