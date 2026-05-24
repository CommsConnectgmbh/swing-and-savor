import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export default function JoinTournamentSheet({ tournament, onClose, onJoined }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [accepted, setAccepted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [profile, setProfile] = useState(null)
  const [name, setName] = useState('')
  const [hcp, setHcp]  = useState('')
  const [msg, setMsg]  = useState('')

  useEffect(() => {
    if (!user?.id) return
    supabase.from('profiles').select('display_name, handle, hcp').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        setProfile(data || null)
        if (data?.display_name) setName(data.display_name)
        if (data?.hcp != null)   setHcp(String(data.hcp))
      })
  }, [user?.id])

  const cond = tournament?.entry_conditions || {}
  const isOpen    = tournament?.join_mode === 'open'
  const isRequest = tournament?.join_mode === 'request'
  const hcpMax = cond.handicap_max
  const hcpMin = cond.handicap_min
  const fee    = cond.entry_fee_cents

  const hcpNum = hcp === '' ? null : Number(hcp)
  const hcpOK  = hcpNum == null
                 || ((hcpMax == null || hcpNum <= hcpMax) && (hcpMin == null || hcpNum >= hcpMin))

  async function handleSubmit() {
    if (!user) { setErr(t('sheets.join.errLogin')); return }
    if (!accepted) { setErr(t('sheets.join.errAccept')); return }
    if (!hcpOK)    { setErr(t('sheets.join.errHcp', { min: hcpMin ?? 0, max: hcpMax ?? '∞' })); return }
    if (!name.trim()) { setErr(t('sheets.join.errName')); return }
    setBusy(true); setErr(null)
    try {
      if (isOpen) {
        const { error } = await supabase.rpc('join_open_tournament', {
          t_id: tournament.id, accepted: true,
        })
        if (error) throw error
      } else {
        const { error } = await supabase.from('tournament_join_requests').upsert({
          tournament_id: tournament.id,
          profile_id: user.id,
          display_name: name.trim(),
          handicap: hcpNum,
          message: msg.trim() || null,
          rules_accepted_at: new Date().toISOString(),
          status: 'pending',
        }, { onConflict: 'tournament_id,profile_id' })
        if (error) throw error
      }
      onJoined?.()
    } catch (e) {
      setErr(e?.message || t('sheets.join.errFail'))
    } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/65 flex items-end sm:items-center justify-center"
      onClick={onClose}>
      <div className="bg-surface w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-line max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-surface/95 backdrop-blur px-5 py-4 border-b border-lineSoft flex items-center justify-between z-10">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-inkMuted">{t('sheets.join.title')}</p>
            <p className="font-condensed font-bold text-xl text-ink truncate">{tournament?.name}</p>
          </div>
          <button onClick={onClose} className="p-2 text-inkMuted active:scale-90 transition-transform">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="px-5 py-5 space-y-5">
          {/* Conditions Strip */}
          <div className="grid grid-cols-2 gap-2">
            {hcpMax != null && <Pill label={t('sheets.join.pillHcMax')} value={hcpMax} />}
            {hcpMin != null && <Pill label={t('sheets.join.pillHcMin')} value={hcpMin} />}
            {cond.age_min      && <Pill label={t('sheets.join.pillAge')} value={cond.age_min} />}
            {cond.dress_code   && <Pill label={t('sheets.join.pillDress')} value={cond.dress_code} />}
            {fee != null       && <Pill label={t('sheets.join.pillFee')} value={`${(fee/100).toFixed(2)} €`} />}
            {cond.payout       && <Pill label={t('sheets.join.pillPayout')} value={cond.payout} />}
          </div>

          {/* Rules */}
          {tournament?.rules_md && (
            <div>
              <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-inkMuted mb-2">{t('sheets.join.rulesHeading')}</p>
              <div className="rounded-xl bg-bg border border-line px-4 py-3 text-sm text-ink whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
                {tournament.rules_md}
              </div>
            </div>
          )}

          {!user && (
            <p className="text-sm text-danger">{t('sheets.join.mustLogin')}</p>
          )}

          {user && (
            <>
              <div className="space-y-3">
                <Input label={t('sheets.join.displayName')} value={name} onChange={setName} placeholder={t('sheets.join.displayNamePh')} />
                <Input label={t('sheets.join.handicap')} value={hcp} onChange={setHcp} placeholder={t('sheets.join.handicapPh')} type="number" />
                {isRequest && (
                  <Input label={t('sheets.join.message')} value={msg} onChange={setMsg}
                    placeholder={t('sheets.join.messagePh')} textarea />
                )}
              </div>

              <label className="flex items-start gap-3 px-4 py-3 rounded-xl bg-bg border border-line cursor-pointer">
                <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}
                  className="mt-0.5 w-5 h-5 accent-accent flex-shrink-0" />
                <span className="text-xs text-ink leading-relaxed">
                  {t('sheets.join.acceptRules')}
                </span>
              </label>

              {err && <p className="text-xs text-danger">{err}</p>}

              <button
                onClick={handleSubmit}
                disabled={busy || !accepted || !user}
                className="w-full py-3 rounded-xl text-sm font-bold tracking-wide bg-accent text-brandDark active:scale-[0.98] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? '…' : isOpen ? t('sheets.join.ctaOpen') : t('sheets.join.ctaRequest')}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function Pill({ label, value }) {
  return (
    <div className="px-3 py-2 rounded-lg bg-bg border border-line">
      <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-inkMuted">{label}</p>
      <p className="text-sm font-bold text-ink mt-0.5 truncate">{value}</p>
    </div>
  )
}

function Input({ label, value, onChange, placeholder, type='text', textarea=false }) {
  const cls = 'w-full bg-bg border border-line rounded-xl px-4 py-3 text-ink placeholder:text-inkDim text-sm focus:border-accent/60'
  return (
    <div>
      <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-inkMuted pl-1 mb-1.5">{label}</p>
      {textarea
        ? <textarea className={cls} rows={3} placeholder={placeholder}
            value={value} onChange={e => onChange(e.target.value)} />
        : <input className={cls} placeholder={placeholder} type={type}
            value={value} onChange={e => onChange(e.target.value)} />}
    </div>
  )
}
