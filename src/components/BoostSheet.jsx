import { useState } from 'react'
import { supabase } from '../lib/supabase'

const TIERS = [
  { id: 'top',       label: 'Nach oben schieben', desc: 'Ganz oben in Entdecken', icon: '↑',
    prices: { 3: 499, 7: 999, 14: 1499 } },
  { id: 'highlight', label: 'Highlight',          desc: 'Farbiger Rahmen im Feed', icon: '✦',
    prices: { 3: 299, 7: 499, 14: 799 } },
  { id: 'both',      label: 'Top + Highlight',    desc: 'Beides — maximale Sichtbarkeit', icon: '★',
    prices: { 3: 699, 7: 1299, 14: 1999 } },
]
const DURATIONS = [3, 7, 14]

export default function BoostSheet({ cup, onClose }) {
  const [tier, setTier] = useState('top')
  const [duration, setDuration] = useState(3)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)

  const def = TIERS.find(t => t.id === tier)
  const amount = def?.prices?.[duration]
  const activeUntil = cup?.promoted_until ? new Date(cup.promoted_until) : null
  const stillActive = activeUntil && activeUntil > new Date()

  async function startCheckout() {
    setBusy(true); setErr(null)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const jwt = sess?.session?.access_token
      if (!jwt) throw new Error('Bitte anmelden')
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-boost-checkout`, {
        method: 'POST',
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${jwt}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tournament_id: cup.id, tier, duration_days: duration }),
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
            <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-accent">Boost</p>
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
              Bereits aktiv ({cup.promo_tier}) bis {activeUntil.toLocaleDateString('de-DE')} —
              ein weiterer Kauf verlängert oder upgradet.
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-inkMuted">Variante</p>
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
                  <p className="text-sm font-bold text-ink">{tdef.label}</p>
                  <p className="text-[11px] text-inkMuted">{tdef.desc}</p>
                </div>
                <p className="text-sm font-bold tabular-nums text-ink">
                  {(tdef.prices[duration] / 100).toFixed(2).replace('.', ',')} €
                </p>
              </button>
            ))}
          </div>

          <div>
            <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-inkMuted mb-2">Dauer</p>
            <div className="grid grid-cols-3 gap-2">
              {DURATIONS.map(d => (
                <button key={d} type="button"
                  onClick={() => setDuration(d)}
                  className={`py-2.5 rounded-xl text-sm font-bold transition-all ${
                    duration === d
                      ? 'bg-accent text-brandDark'
                      : 'bg-bg text-inkMuted border border-line'
                  }`}>
                  {d} Tage
                </button>
              ))}
            </div>
          </div>

          {err && <p className="text-xs text-danger">{err}</p>}

          <button
            onClick={startCheckout}
            disabled={busy || !amount}
            className="w-full py-4 rounded-2xl text-sm font-bold tracking-wide bg-accent text-brandDark active:scale-[0.98] transition-transform disabled:opacity-40"
          >
            {busy
              ? '…'
              : `Jetzt boosten · ${(amount / 100).toFixed(2).replace('.', ',')} €`}
          </button>
          <p className="text-[10px] text-inkDim text-center">
            Stripe-Checkout · einmalige Zahlung · Comms Connect GmbH
          </p>
        </div>
      </div>
    </div>
  )
}
