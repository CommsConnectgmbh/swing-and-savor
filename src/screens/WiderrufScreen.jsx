import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getAccessToken } from '../lib/session'
import { useAuth } from '../lib/auth'
import { loadWiderrufbareKaeufe } from '../lib/widerruf'
import { functionUrl, authFunctionHeaders } from '../lib/functions'
import { fmtEur } from '../lib/format'
import LoadingSpinner from '../components/LoadingSpinner'

// Online-Widerrufsfunktion gemäß Art. 11a Verbraucherrechte-RL (verpflichtend ab 19.06.2026).
// Flow: widerrufbare Käufe laden → auswählen → "Widerruf bestätigen" → Bestätigungsscreen.
export default function WiderrufScreen() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const lang = i18n.resolvedLanguage || 'de'

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null) // the chosen purchase
  const [fullName, setFullName] = useState(profile?.display_name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [step, setStep] = useState('list') // 'list' | 'confirm' | 'done'
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [result, setResult] = useState(null)

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  useEffect(() => {
    if (user?.email) setEmail((e) => e || user.email)
    if (profile?.display_name) setFullName((n) => n || profile.display_name)
  }, [user?.email, profile?.display_name])

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      const rows = await loadWiderrufbareKaeufe(profile?.id || user?.id)
      if (alive) { setItems(rows); setLoading(false) }
    })()
    return () => { alive = false }
  }, [profile?.id, user?.id])

  function choose(item) {
    setErr(null)
    setSelected(item)
    setStep('confirm')
  }

  async function submit() {
    if (!selected) return
    if (!fullName.trim()) { setErr('missing_full_name'); return }
    if (!emailValid) { setErr('invalid_email'); return }
    setBusy(true); setErr(null)
    try {
      const jwt = await getAccessToken()
      if (!jwt) throw new Error(t('widerruf.mustLogin'))
      const res = await fetch(functionUrl('widerruf'), {
        method: 'POST',
        headers: { ...authFunctionHeaders(jwt), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchase_table: selected.table,
          purchase_id: selected.id,
          full_name: fullName,
          email,
        }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.ok) throw new Error(j.error || `HTTP ${res.status}`)
      setResult(j)
      setStep('done')
    } catch (e) {
      setErr(e.message || 'Fehler')
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-[100dvh] px-4 py-6 max-w-lg mx-auto">
      <button onClick={() => navigate(-1)}
        className="text-sm text-inkMuted hover:text-ink mb-4 flex items-center gap-1">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        {t('common.back', 'Zurück')}
      </button>

      <h1 className="font-condensed font-black text-2xl text-ink">{t('widerruf.title')}</h1>
      <p className="mt-2 text-sm text-inkMuted leading-relaxed">{t('widerruf.intro')}</p>

      {loading ? (
        <div className="flex justify-center py-16"><LoadingSpinner /></div>
      ) : step === 'done' ? (
        <div className="mt-6 rounded-2xl border border-accent/40 bg-accent/8 p-5">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-accent">{t('widerruf.doneTitle')}</p>
          <p className="mt-2 text-sm text-ink leading-relaxed">{t('widerruf.doneBody')}</p>
          {result?.refund_amount_cents > 0 && (
            <p className="mt-2 text-sm text-inkMuted">
              {t('widerruf.refundLine', { amount: fmtEur(result.refund_amount_cents, lang) })}
            </p>
          )}
          <button onClick={() => navigate('/me')}
            className="mt-5 w-full py-3 rounded-xl text-sm font-bold bg-accent text-brandDark active:scale-[0.98] transition-transform">
            {t('widerruf.backToProfile')}
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
          <p className="text-sm text-inkMuted leading-relaxed">{t('widerruf.empty')}</p>
        </div>
      ) : step === 'list' ? (
        <div className="mt-6 space-y-3">
          <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-inkMuted">{t('widerruf.chooseLabel')}</p>
          {items.map((it) => (
            <button key={`${it.table}:${it.id}`} onClick={() => choose(it)}
              className="w-full text-left rounded-xl border border-line bg-surface hover:border-accent/40 p-4 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink truncate">{it.label}</p>
                  <p className="text-[11px] text-inkMuted mt-0.5">
                    {t('widerruf.paidOn', { date: new Date(it.paid_at).toLocaleDateString(lang) })}
                    {' · '}
                    {t('widerruf.daysLeft', { count: it.days_remaining })}
                  </p>
                </div>
                <p className="text-sm font-bold tabular-nums text-ink whitespace-nowrap">{fmtEur(it.amount_eur_cents, lang)}</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-line bg-surface p-4">
            <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-inkMuted mb-2">{t('widerruf.summaryLabel')}</p>
            <Row label={t('widerruf.contract')} value={selected.label} />
            <Row label={t('widerruf.amount')} value={fmtEur(selected.amount_eur_cents, lang)} />
            <Row label={t('widerruf.paidLabel')} value={new Date(selected.paid_at).toLocaleString(lang)} />
          </div>

          <label className="block">
            <span className="text-[11px] font-semibold text-inkMuted">{t('widerruf.nameLabel')}</span>
            <input type="text" value={fullName} maxLength={200}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('widerruf.namePlaceholder')}
              className="mt-1 w-full bg-bg border border-line rounded-xl px-4 py-2.5 text-ink text-sm focus:border-accent/60" />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold text-inkMuted">{t('widerruf.emailLabel')}</span>
            <input type="email" value={email} required
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dein@email.de"
              className="mt-1 w-full bg-bg border border-line rounded-xl px-4 py-2.5 text-ink text-sm focus:border-accent/60" />
            {email.trim() && !emailValid && (
              <span className="mt-1 block text-[11px] text-danger">{t('widerruf.err.invalid_email')}</span>
            )}
          </label>

          <p className="text-xs text-inkMuted leading-relaxed">{t('widerruf.confirmHint')}</p>
          {err && <p className="text-xs text-danger">{t(`widerruf.err.${err}`, t('widerruf.err.generic'))}</p>}

          <div className="flex gap-2">
            <button type="button" onClick={() => { setStep('list'); setSelected(null); setErr(null) }} disabled={busy}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-bg text-inkMuted border border-line active:scale-[0.98] transition-transform disabled:opacity-50">
              {t('common.back', 'Zurück')}
            </button>
            <button type="button" onClick={submit} disabled={busy || !fullName.trim() || !emailValid}
              className="flex-1 py-3 rounded-xl text-sm font-bold bg-danger text-white active:scale-[0.98] transition-transform disabled:opacity-50">
              {busy ? t('widerruf.submitting') : t('widerruf.confirmBtn')}
            </button>
          </div>
        </div>
      )}

      <p className="mt-8 text-[11px] text-inkDim text-center leading-relaxed">
        {t('widerruf.footer')}
      </p>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 py-1.5 border-b border-lineSoft last:border-0">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-inkDim">{label}</span>
      <span className="text-sm text-ink break-words">{value}</span>
    </div>
  )
}
