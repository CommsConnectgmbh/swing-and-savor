import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAccessToken, postAuthedFunction } from '../lib/functions'
import { useAuth } from '../lib/auth'
import { useProAccess } from '../lib/proAccess'
import {
  launchMonitorPlatformSupported,
  probeLaunchMonitor,
  openLaunchMonitor,
} from '../lib/launchMonitor'

// "Range" — entry point for the Pro AR Launch Monitor (embedded QuickLaunch engine).
// Gating ladder:
//   1. Not iOS native shell        -> upsell ("open in the iPhone app")
//   2. iOS but no LiDAR            -> "requires iPhone Pro" notice
//   3. iOS + LiDAR but not Pro     -> paywall (Stripe checkout via create-pro-checkout)
//   4. iOS + LiDAR + Pro           -> launch button (presents native SwiftUI)
const PRICE_LABEL = '€29.99'

export default function RangeScreen() {
  const { t } = useTranslation()
  const { user, refreshProfile } = useAuth()
  const isPro = useProAccess()

  const isNativeIOS = launchMonitorPlatformSupported()
  const [probe, setProbe] = useState({ supported: false, reason: 'pending' })
  const [busy, setBusy] = useState(false)
  const [consent, setConsent] = useState(false)
  const [err, setErr] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    let alive = true
    ;(async () => {
      const p = await probeLaunchMonitor()
      if (alive) setProbe(p)
    })()
    return () => { alive = false }
  }, [])

  // Returning from Stripe success -> refresh profile so the new entitlement lands.
  useEffect(() => {
    if (searchParams.get('pro') === 'success') {
      refreshProfile?.()
      const next = new URLSearchParams(searchParams); next.delete('pro')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams])

  async function startCheckout() {
    if (!user?.id) { setErr(t('range.mustLogin', 'Please sign in first.')); return }
    if (!consent) { setErr(t('range.consentRequired', 'Please confirm to continue.')); return }
    setErr(null); setBusy(true)
    try {
      const jwt = await getAccessToken()
      if (!jwt) throw new Error('no_session')
      const res = await postAuthedFunction('create-pro-checkout', jwt, {
        plan_key: 'launch_monitor_lifetime', instant_execution_consent: true,
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.checkout_url) {
        setErr(j.error || t('range.checkoutFailed', 'Checkout failed. Please try again later.'))
        return
      }
      window.location.href = j.checkout_url
    } catch (e) {
      setErr(e.message || t('range.checkoutFailed', 'Checkout failed. Please try again later.'))
    } finally {
      setBusy(false)
    }
  }

  async function launch() {
    setErr(null)
    try {
      await openLaunchMonitor({ isPro: true })
    } catch (e) {
      setErr(e?.message || t('range.launchFailed', 'Could not open the launch monitor.'))
    }
  }

  return (
    <div className="px-4 py-6 max-w-xl mx-auto text-white">
      <h1 className="text-2xl font-semibold mb-1">{t('range.title', 'Launch Monitor')}</h1>
      <p className="text-sm opacity-70 mb-6">
        {t('range.subtitle', 'AR launch monitor — carry, ball speed, spin & launch angle, plus the AR green reader. Powered by QuickLaunch.')}
      </p>

      {/* 1. Not the iOS app */}
      {!isNativeIOS && (
        <Card>
          <Badge>{t('range.proBadge', 'PRO')}</Badge>
          <p className="text-sm">
            {t('range.iosOnly', 'The Launch Monitor uses your iPhone’s LiDAR camera and is only available inside the Swing & Savor iOS app on an iPhone 12 Pro or newer.')}
          </p>
        </Card>
      )}

      {/* 2. iOS but unsupported hardware */}
      {isNativeIOS && !probe.supported && probe.reason !== 'pending' && (
        <Card>
          <Badge>{t('range.proBadge', 'PRO')}</Badge>
          <p className="text-sm">
            {t('range.needsLidar', 'This feature needs a LiDAR-equipped iPhone (iPhone 12 Pro or newer). Your device isn’t supported.')}
          </p>
        </Card>
      )}

      {/* 3. iOS + supported, not entitled -> paywall */}
      {isNativeIOS && probe.supported && !isPro && (
        <Card>
          <Badge>{t('range.proBadge', 'PRO')}</Badge>
          <p className="text-sm mb-4">
            {t('range.paywall', 'Unlock the AR Launch Monitor & Green Reader — a one-time purchase tied to your account.')}
          </p>
          <label className="flex items-start gap-2 text-xs opacity-80 mb-4">
            <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-0.5" />
            <span>
              {t('range.consent', 'I expressly request immediate access and acknowledge that my right of withdrawal lapses once the feature is unlocked.')}
            </span>
          </label>
          <button
            onClick={startCheckout}
            disabled={busy || !consent}
            className="w-full rounded-xl bg-emerald-500 disabled:opacity-50 text-emerald-950 font-semibold py-3"
          >
            {busy ? t('range.opening', 'Opening…') : t('range.unlock', { price: PRICE_LABEL, defaultValue: 'Unlock — {{price}}' })}
          </button>
        </Card>
      )}

      {/* 4. Entitled + supported -> launch */}
      {isNativeIOS && probe.supported && isPro && (
        <Card>
          <button
            onClick={launch}
            className="w-full rounded-xl bg-emerald-500 text-emerald-950 font-semibold py-3"
          >
            {t('range.open', 'Open Launch Monitor')}
          </button>
        </Card>
      )}

      {err && <p className="text-sm text-red-400 mt-4">{err}</p>}
    </div>
  )
}

function Card({ children }) {
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 p-5 mb-4">
      {children}
    </div>
  )
}

function Badge({ children }) {
  return (
    <span className="inline-block text-[10px] tracking-widest font-bold bg-emerald-500/20 text-emerald-300 rounded px-2 py-0.5 mb-3">
      {children}
    </span>
  )
}
