import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { functionUrl, authFunctionHeaders } from '../lib/functions'
import { fmtEur } from '../lib/format'
import { isPromoActive } from '../lib/promo'

const TIERS = [
  { id: 'top',       icon: '↑', prices: { 3: 499, 7: 999, 14: 1499 } },
  { id: 'highlight', icon: '✦', prices: { 3: 299, 7: 499, 14: 799 } },
  { id: 'both',      icon: '★', prices: { 3: 699, 7: 1299, 14: 1999 } },
]
const DURATIONS = [3, 7, 14]

export default function BoostSheet({ cup, onClose }) {
  const { t, i18n } = useTranslation()
  const [tier, setTier] = useState('top')
  const [duration, setDuration] = useState(3)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  // §356 Abs. 5 BGB: ausdrückliche Zustimmung zur sofortigen Ausführung +
  // Kenntnis vom Erlöschen des Widerrufsrechts. Pflicht vor Zahlung.
  const [instantConsent, setInstantConsent] = useState(false)
  const tierLabel = (id) => t(`sheets.boost.tier.${id}Label`)
  const tierDesc  = (id) => t(`sheets.boost.tier.${id}Desc`)
  const lang = i18n.resolvedLanguage || 'de'

  const def = TIERS.find(t => t.id === tier)
  const amount = def?.prices?.[duration]
  const activeUntil = cup?.promoted_until ? new Date(cup.promoted_until) : null
  const stillActive = isPromoActive(cup)

  async function startCheckout() {
    if (!instantConsent) { setErr(t('sheets.boost.consentRequired')); return }
    setBusy(true); setErr(null)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const jwt = sess?.session?.access_token
      if (!jwt) throw new Error(t('sheets.boost.mustLogin'))
      const res = await fetch(functionUrl('create-boost-checkout'), {
        method: 'POST',
        headers: { ...authFunctionHeaders(jwt), 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournament_id: cup.id, tier, duration_days: duration, instant_execution_consent: true }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.checkout_url) {
        setErr(j.error || 'checkout_failed'); return
      }
      window.location.href = j.checkout_url
    } catch (e) {
      setErr(e.message || 'Fehler')
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/65 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-surface w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-line max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-lineSoft flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-accent">{t('sheets.boost.title')}</p>
            <p className="font-condensed font-bold text-xl text-ink truncate">{cup.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-inkMuted active:scale-90 transition-transform">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {stillActive && (
            <div className="rounded-xl bg-accent/10 border border-accent/30 px-4 py-3 text-xs text-accent">
              {t('sheets.boost.alreadyActive', {
                tier: cup.promo_tier,
                date: activeUntil.toLocaleDateString(lang),
              })}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-inkMuted">{t('sheets.boost.variantLabel')}</p>
            {TIERS.map(tdef => (
              <button key={tdef.id} type="button"
                onClick={() => setTier(tdef.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                  tier === tdef.id
                    ? 'bg-accent/12 border-accent/50'
                    : 'bg-bg border-line hover:border-accent/30'
                }`}>
                <div className="w-9 h-9 rounded-full bg-accent/20 text-accent flex items-center justify-center font-bold">
                  {tdef.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-ink">{tierLabel(tdef.id)}</p>
                  <p className="text-[11px] text-inkMuted">{tierDesc(tdef.id)}</p>
                </div>
                <p className="text-sm font-bold tabular-nums text-ink">
                  {fmtEur(tdef.prices[duration], lang)}
                </p>
              </button>
            ))}
          </div>

          <div>
            <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-inkMuted mb-2">{t('sheets.boost.durationLabel')}</p>
            <div className="grid grid-cols-3 gap-2">
              {DURATIONS.map(d => (
                <button key={d} type="button"
                  onClick={() => setDuration(d)}
                  className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                    duration === d
                      ? 'bg-accent text-brandDark'
                      : 'bg-bg text-inkMuted border border-line'
                  }`}>
                  {t('sheets.boost.daysSuffix', { count: d })}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={instantConsent}
              onChange={(e) => { setInstantConsent(e.target.checked); if (e.target.checked) setErr(null) }}
              className="mt-0.5 w-4 h-4 shrink-0 accent-accent"
            />
            <span className="text-[11px] leading-relaxed text-inkMuted">
              {t('sheets.boost.instantConsent')}
            </span>
          </label>

          {err && <p className="text-xs text-danger">{err}</p>}

          <button
            onClick={startCheckout}
            disabled={busy || !amount || !instantConsent}
            className="w-full py-4 rounded-2xl text-sm font-bold tracking-wide bg-accent text-brandDark active:scale-[0.98] transition-transform disabled:opacity-40"
          >
            {busy
              ? t('sheets.boost.ctaLoading')
              : t('sheets.boost.cta', { price: amount ? fmtEur(amount, lang) : '' })}
          </button>
          <p className="text-[10px] text-inkDim text-center">
            {t('sheets.boost.footer')}
          </p>
        </div>
      </div>
    </div>
  )
}
