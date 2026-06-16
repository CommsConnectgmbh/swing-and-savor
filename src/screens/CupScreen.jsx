import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { uploadCupCover, clearCupCover } from '../lib/photo'
import ConfirmDialog from '../components/ConfirmDialog'
import LoadingSpinner from '../components/LoadingSpinner'
import PasswordGate from '../components/PasswordGate'
import ShareSheet from '../components/ShareSheet'
import CupExtrasSheet from '../components/CupExtrasSheet'
import BoostSheet from '../components/BoostSheet'
import JoinRequestsSheet from '../components/JoinRequestsSheet'
import { isUnlocked } from '../lib/tournamentGate'
import { functionUrl, authFunctionHeaders } from '../lib/functions'

const emptyForm = {
  name: '', date: '',
  team_a_name: 'Team A', team_b_name: 'Team B',
  edit_password: '',
  visibility: 'friends',
  location_name: '',
  format: '',
  description: '',
  cover_url: '',
  rules_md: '',
  join_mode: 'invite_only',
  max_participants: '',
  ec_handicap_max: '',
  ec_handicap_min: '',
  ec_age_min: '',
  ec_dress_code: '',
  ec_entry_fee_eur: '',
  ec_payout: '',
}

const FORMAT_OPTIONS = [
  'Match Play', 'Stableford', 'Best Ball', 'Scramble', 'Stroke Play', 'Texas Scramble',
]

function PencilIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
      <path d="M10 11v6M14 11v6M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
    </svg>
  )
}

function LockIcon({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0110 0v4"/>
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
      <polyline points="16 6 12 2 8 6"/>
      <line x1="12" y1="2" x2="12" y2="15"/>
    </svg>
  )
}

export default function CupScreen() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [tournaments, setTournaments] = useState([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState(null)
  const [editId, setEditId] = useState(null)
  const [deleteId, setDeleteId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [showGate, setShowGate] = useState(false)
  const [gateTournament, setGateTournament] = useState(null)
  const [shareCup, setShareCup] = useState(null)
  const [coverBusy, setCoverBusy] = useState(false)
  const [extrasCup, setExtrasCup] = useState(null)
  const [boostCup, setBoostCup] = useState(null)
  const [joinReqCup, setJoinReqCup] = useState(null)
  const [pendingCounts, setPendingCounts] = useState({})
  const pendingRef = useRef(null)
  const coverInputRef = useRef(null)
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => { loadTournaments() }, [])

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setForm(emptyForm); setEditId(null); setMode('create')
      setSearchParams({}, { replace: true })
    }
    if (searchParams.get('upgrade') === 'success') {
      // refresh so the new package_type lands in UI
      loadTournaments()
      const next = new URLSearchParams(searchParams); next.delete('upgrade'); next.delete('cup')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams])

  const [upgrading, setUpgrading] = useState(null)
  // §356 Abs. 5 BGB: Pflicht-Zustimmung zur sofortigen Ausführung vor Premium-Kauf.
  const [premiumConsentCup, setPremiumConsentCup] = useState(null)
  async function upgradeToPremium(cup) {
    if (!user?.id) return
    setPremiumConsentCup(null)
    setUpgrading(cup.id)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const jwt = sess?.session?.access_token
      if (!jwt) throw new Error('no_session')
      const res = await fetch(functionUrl('create-premium-checkout'), {
        method: 'POST',
        headers: { ...authFunctionHeaders(jwt), 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournament_id: cup.id, package_type: 'premium', instant_execution_consent: true }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.checkout_url) {
        console.error('[upgrade] failed', j)
        alert('Upgrade fehlgeschlagen. Bitte später erneut versuchen.')
        return
      }
      window.location.href = j.checkout_url
    } catch (e) {
      console.error('[upgrade] err', e)
    } finally {
      setUpgrading(null)
    }
  }

  async function loadTournaments() {
    const { data } = await supabase.from('tournaments').select('*').order('date', { ascending: false })
    setTournaments(data || [])
    setLoading(false)
    // pending Join-Requests pro Owner-Cup zählen
    if (user?.id) {
      const mine = (data || []).filter(c => c.owner_id === user.id).map(c => c.id)
      if (mine.length) {
        const { data: jr } = await supabase.from('tournament_join_requests')
          .select('tournament_id').in('tournament_id', mine).eq('status', 'pending')
        const counts = {}
        ;(jr || []).forEach(r => { counts[r.tournament_id] = (counts[r.tournament_id] || 0) + 1 })
        setPendingCounts(counts)
      }
    }
  }

  function guarded(t, action) {
    if (isUnlocked(t)) { action() }
    else { setGateTournament(t); pendingRef.current = action; setShowGate(true) }
  }

  function handleGateSuccess() {
    setShowGate(false)
    if (pendingRef.current) { pendingRef.current(); pendingRef.current = null }
  }

  function openCreate() { setForm(emptyForm); setEditId(null); setMode('create') }

  function openEdit(t) {
    guarded(t, () => {
      const ec = t.entry_conditions || {}
      setForm({
        name: t.name, date: t.date,
        team_a_name: t.team_a_name, team_b_name: t.team_b_name,
        // Klartext-Passwort ist serverseitig gekapselt und nie lesbar.
        // Leer lassen = beibehalten; neuer Wert = setzen/ersetzen.
        edit_password: '',
        had_password: !!t.has_edit_password,
        visibility: t.visibility || 'friends',
        location_name: t.location_name || '',
        format: t.format || '',
        description: t.description || '',
        cover_url: t.cover_url || '',
        rules_md: t.rules_md || '',
        join_mode: t.join_mode || 'invite_only',
        max_participants: t.max_participants != null ? String(t.max_participants) : '',
        ec_handicap_max: ec.handicap_max != null ? String(ec.handicap_max) : '',
        ec_handicap_min: ec.handicap_min != null ? String(ec.handicap_min) : '',
        ec_age_min:      ec.age_min      != null ? String(ec.age_min)      : '',
        ec_dress_code:   ec.dress_code || '',
        ec_entry_fee_eur: ec.entry_fee_cents != null ? String((ec.entry_fee_cents/100).toFixed(2)) : '',
        ec_payout:       ec.payout || '',
      })
      setEditId(t.id); setMode('edit')
    })
  }

  function closeForm() { setMode(null); setEditId(null) }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name || !form.date) return
    const entry_conditions = {}
    if (form.ec_handicap_max !== '') entry_conditions.handicap_max = Number(form.ec_handicap_max)
    if (form.ec_handicap_min !== '') entry_conditions.handicap_min = Number(form.ec_handicap_min)
    if (form.ec_age_min      !== '') entry_conditions.age_min      = Number(form.ec_age_min)
    if (form.ec_dress_code.trim())   entry_conditions.dress_code   = form.ec_dress_code.trim()
    if (form.ec_entry_fee_eur !== '') entry_conditions.entry_fee_cents = Math.round(Number(form.ec_entry_fee_eur) * 100)
    if (form.ec_payout.trim())       entry_conditions.payout       = form.ec_payout.trim()

    // Passwort wird NICHT mehr in tournaments geschrieben (Klartext-Leakage).
    // Es lebt in tournament_secrets und wird via security-definer RPC gesetzt.
    const payload = {
      name: form.name, date: form.date,
      team_a_name: form.team_a_name, team_b_name: form.team_b_name,
      visibility: form.visibility,
      location_name: form.location_name.trim() || null,
      format: form.format.trim() || null,
      description: form.description.trim() || null,
      cover_url: form.cover_url.trim() || null,
      rules_md: form.rules_md.trim() || null,
      join_mode: form.join_mode,
      max_participants: form.max_participants ? parseInt(form.max_participants, 10) : null,
      entry_conditions,
    }
    const newPw = form.edit_password.trim()
    if (mode === 'create') {
      if (user) payload.owner_id = user.id
      const { data: inserted } = await supabase.from('tournaments').insert([payload]).select('id').single()
      if (inserted?.id && newPw) {
        await supabase.rpc('set_tournament_password', { t_id: inserted.id, pw: newPw })
      }
    } else {
      await supabase.from('tournaments').update(payload).eq('id', editId)
      // Leeres Feld bei bestehendem Passwort = beibehalten (kein versehentliches Löschen).
      if (newPw) {
        await supabase.rpc('set_tournament_password', { t_id: editId, pw: newPw })
      }
    }
    closeForm(); loadTournaments()
  }

  async function handleDelete() {
    await supabase.from('tournaments').delete().eq('id', deleteId)
    setDeleteId(null); loadTournaments()
  }

  async function handleCoverPick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !editId) return
    setCoverBusy(true)
    try {
      await uploadCupCover(editId, file)
      await loadTournaments()
    } catch (err) {
      console.error('[cover upload]', err)
    } finally {
      setCoverBusy(false)
    }
  }

  async function handleCoverClear() {
    if (!editId) return
    setCoverBusy(true)
    try {
      await clearCupCover(editId)
      await loadTournaments()
    } finally {
      setCoverBusy(false)
    }
  }

  async function toggleStatus(t) {
    guarded(t, async () => {
      const next = t.status === 'active' ? 'finished' : 'active'
      await supabase.from('tournaments').update({ status: next }).eq('id', t.id)
      loadTournaments()
    })
  }

  const inputCls = 'w-full bg-bg border border-line rounded-xl px-4 py-3 text-ink placeholder:text-inkDim text-sm transition-colors focus:border-accent/60'
  const editingCup = editId ? tournaments.find(c => c.id === editId) : null
  const cover = editingCup?.cover_url

  return (
    <div className="max-w-lg mx-auto animate-fade-up">

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-6 pb-5">
        <h1 className="font-condensed text-3xl font-bold tracking-wide text-ink">{t('nav.cups')}</h1>
        <button
          onClick={mode ? closeForm : openCreate}
          className={`px-4 py-2 rounded-lg text-sm font-bold tracking-wide active:scale-[0.97] transition-all ${
            mode
              ? 'bg-surface text-inkMuted border border-line'
              : 'bg-accent text-brandDark'
          }`}
        >
          {mode ? t('common.close') : `+ ${t('cup.newCup')}`}
        </button>
      </div>

      {/* Form */}
      {mode && (
        <form onSubmit={handleSubmit}
          className="mx-4 mb-4 rounded-card p-4 flex flex-col gap-3 bg-surface border border-line animate-fade-up">
          <p className="text-xs font-bold tracking-[0.2em] uppercase text-inkMuted">
            {mode === 'edit' ? 'Turnier bearbeiten' : 'Neues Turnier'}
          </p>
          <input className={inputCls} placeholder="Turnier-Name *"
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <input type="date" className={inputCls}
            value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} required />
          <div className="grid grid-cols-2 gap-3">
            <input className={inputCls} placeholder="Team A"
              value={form.team_a_name} onChange={e => setForm(f => ({ ...f, team_a_name: e.target.value }))} />
            <input className={inputCls} placeholder="Team B"
              value={form.team_b_name} onChange={e => setForm(f => ({ ...f, team_b_name: e.target.value }))} />
          </div>

          {/* Location (free-text course / venue) */}
          <input className={inputCls} placeholder="Location · z.B. Pebble Beach"
            value={form.location_name}
            onChange={e => setForm(f => ({ ...f, location_name: e.target.value }))} />

          {/* Format */}
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-inkMuted pl-1 mb-1.5">Format</p>
            <div className="flex flex-wrap gap-1.5">
              {FORMAT_OPTIONS.map((opt) => (
                <button key={opt} type="button"
                  onClick={() => setForm(f => ({ ...f, format: f.format === opt ? '' : opt }))}
                  className={`px-3 py-1.5 rounded-pill text-[11px] tracking-wide transition-all ${
                    form.format === opt
                      ? 'bg-accent/15 text-accent border border-accent/40'
                      : 'bg-bg text-inkMuted border border-line'
                  }`}>
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <textarea className={inputCls} rows={3}
            placeholder="Beschreibung · was macht dieses Invitational besonders?"
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />

          {/* Cover URL (image URL — quick path; full upload kommt mit F2) */}
          <input className={inputCls}
            placeholder="Cover-Bild URL · https://… (optional)"
            value={form.cover_url}
            onChange={e => setForm(f => ({ ...f, cover_url: e.target.value }))} />
          {form.cover_url && (
            <div className="relative h-40 overflow-hidden rounded-card hairline">
              <img src={form.cover_url} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0"
                   style={{ background: 'linear-gradient(180deg, transparent 40%, rgba(10,10,10,0.85))' }} />
              <p className="absolute bottom-2 left-3 right-3 font-display text-ink text-[18px] leading-tight"
                 style={{ fontWeight: 500 }}>
                {form.name || 'Cover Preview'}
              </p>
            </div>
          )}

          {/* Regeln (Markdown / Freitext) */}
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-inkMuted pl-1 mb-1.5">Regeln & Hinweise</p>
            <textarea className={inputCls} rows={5}
              placeholder={"Format-Details, Tee-Times, Etikette, Mitbringen ...\nBspw.: Texas Scramble, weiße Tees, Start 09:00, Preisgeld 1./2./3.\nBlue-Card Pflicht, Cap empfohlen."}
              value={form.rules_md}
              onChange={e => setForm(f => ({ ...f, rules_md: e.target.value }))} />
          </div>

          {/* Teilnahme-Bedingungen */}
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-inkMuted pl-1 mb-1.5">Teilnahme-Bedingungen</p>
            <div className="grid grid-cols-2 gap-3">
              <input className={inputCls} placeholder="HC max" type="number" step="0.1"
                value={form.ec_handicap_max}
                onChange={e => setForm(f => ({ ...f, ec_handicap_max: e.target.value }))} />
              <input className={inputCls} placeholder="HC min" type="number" step="0.1"
                value={form.ec_handicap_min}
                onChange={e => setForm(f => ({ ...f, ec_handicap_min: e.target.value }))} />
              <input className={inputCls} placeholder="Alter ab" type="number"
                value={form.ec_age_min}
                onChange={e => setForm(f => ({ ...f, ec_age_min: e.target.value }))} />
              <input className={inputCls} placeholder="Startgeld €" type="number" step="0.01"
                value={form.ec_entry_fee_eur}
                onChange={e => setForm(f => ({ ...f, ec_entry_fee_eur: e.target.value }))} />
              <input className={inputCls} placeholder="Dresscode" type="text"
                value={form.ec_dress_code}
                onChange={e => setForm(f => ({ ...f, ec_dress_code: e.target.value }))} />
              <input className={inputCls} placeholder="Preise / Payout" type="text"
                value={form.ec_payout}
                onChange={e => setForm(f => ({ ...f, ec_payout: e.target.value }))} />
            </div>
          </div>

          {/* Join-Modus */}
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-inkMuted pl-1 mb-1.5">Beitritt</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['invite_only', 'Nur Einladung', 'Code/Liste'],
                ['request',     'Auf Anfrage',   'Du genehmigst'],
                ['open',        'Offen',         'Jeder kann rein'],
              ].map(([val, label, hint]) => (
                <button key={val} type="button"
                  onClick={() => setForm(f => ({ ...f, join_mode: val }))}
                  className={`flex flex-col items-center gap-0.5 py-2.5 rounded-xl active:scale-[0.97] transition-all ${
                    form.join_mode === val
                      ? 'bg-accent/15 text-accent border border-accent/40'
                      : 'bg-bg text-inkMuted border border-line'
                  }`}>
                  <span className="text-xs font-bold">{label}</span>
                  <span className="text-[9px] tracking-wide opacity-75">{hint}</span>
                </button>
              ))}
            </div>
            <input className={`${inputCls} mt-2`} placeholder="Max. Teilnehmer (optional)"
              type="number" min="2"
              value={form.max_participants}
              onChange={e => setForm(f => ({ ...f, max_participants: e.target.value }))} />
          </div>

          {/* Visibility */}
          <div>
            <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-inkMuted pl-1 mb-1.5">Sichtbarkeit</p>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['public',  'Öffentlich', 'Alle sehen es'],
                ['friends', 'Freunde',    'Nur Freunde'],
                ['private', 'Privat',     'Nur eingeladen'],
              ].map(([val, label, hint]) => (
                <button key={val} type="button"
                  onClick={() => setForm(f => ({ ...f, visibility: val }))}
                  className={`flex flex-col items-center gap-0.5 py-2.5 rounded-xl active:scale-[0.97] transition-all ${
                    form.visibility === val
                      ? 'bg-accent/15 text-accent border border-accent/40'
                      : 'bg-bg text-inkMuted border border-line'
                  }`}>
                  <span className="text-xs font-bold">{label}</span>
                  <span className="text-[9px] tracking-wide opacity-75">{hint}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Cover-Foto (nur im Edit-Modus — Turnier muss eine ID haben) */}
          {mode === 'create' && (
            <p className="text-[10px] pl-1 text-inkDim">
              Cover-Bild kannst du nach dem Anlegen über „Bearbeiten" hochladen.
            </p>
          )}
          {mode === 'edit' && (
            <div>
              <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-inkMuted pl-1 mb-1.5">Cover-Bild</p>
              {cover ? (
                <div className="relative rounded-xl overflow-hidden border border-line" style={{ aspectRatio: '16/9' }}>
                  <img src={cover} alt="" className="w-full h-full object-cover" />
                  <div className="absolute inset-x-0 bottom-0 flex gap-2 p-2 bg-gradient-to-t from-black/70 to-transparent">
                    <button type="button" disabled={coverBusy}
                      onClick={() => coverInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide bg-bg/80 text-ink border border-line active:scale-95 transition-transform disabled:opacity-50">
                      Ersetzen
                    </button>
                    <button type="button" disabled={coverBusy}
                      onClick={handleCoverClear}
                      className="ml-auto px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide bg-bg/80 text-danger border border-line active:scale-95 transition-transform disabled:opacity-50">
                      Entfernen
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" disabled={coverBusy}
                  onClick={() => coverInputRef.current?.click()}
                  className="w-full py-6 rounded-xl border border-dashed border-line text-inkMuted text-xs font-semibold tracking-wide active:scale-[0.99] transition-transform hover:text-accent hover:border-accent/40 disabled:opacity-50">
                  {coverBusy ? 'Lade hoch …' : '+ Cover-Bild hochladen'}
                </button>
              )}
              <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverPick} />
            </div>
          )}

          {/* Legacy password (optional) */}
          <div>
            <input
              type="password"
              className={inputCls}
              placeholder={form.had_password ? 'Passwort gesetzt — leer lassen zum Beibehalten' : 'Schreibschutz-Passwort (optional)'}
              value={form.edit_password}
              onChange={e => setForm(f => ({ ...f, edit_password: e.target.value }))}
              autoComplete="off"
            />
            <p className="text-[10px] mt-1.5 pl-1 text-inkDim">
              Zusatz-Schutz für Edits — Login regelt schon, wer es sieht.
            </p>
          </div>
          <button type="submit"
            className="py-3 rounded-xl text-sm font-bold tracking-wide bg-accent text-brandDark active:scale-[0.98] transition-transform">
            {mode === 'edit' ? 'Speichern' : 'Turnier anlegen'}
          </button>
        </form>
      )}

      {/* List */}
      {loading ? <LoadingSpinner /> : (
        <div className="border-t border-lineSoft">
          {tournaments.map((cup, idx) => (
            <div key={cup.id}
              className="flex items-center gap-3 px-4 py-4 border-b border-lineSoft"
              style={{ animationDelay: `${idx * 30}ms` }}>
              {/* Cover oder Status-Dot */}
              {cup.cover_url ? (
                <img src={cup.cover_url} alt="" loading="lazy"
                  className="w-11 h-11 rounded-lg object-cover flex-shrink-0 border border-line" />
              ) : (
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                  cup.status === 'active' ? 'bg-accent shadow-glow' : 'bg-line'
                }`} />
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm leading-tight text-ink flex items-center gap-1.5">
                  {cup.name}
                  {cup.has_edit_password && <span className="text-lock"><LockIcon /></span>}
                </p>
                <p className="text-xs mt-0.5 text-inkMuted flex items-center gap-1.5 flex-wrap">
                  <span>{new Date(cup.date + 'T12:00:00').toLocaleDateString()}</span>
                  <span className="text-inkDim">·</span>
                  <span className="text-teamA">{cup.team_a_name}</span>
                  <span className="text-inkDim">vs</span>
                  <span className="text-teamB">{cup.team_b_name}</span>
                  {cup.visibility && cup.invite_code && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation();
                        navigator.clipboard?.writeText(cup.invite_code) }}
                      className="text-[10px] font-bold tracking-[0.15em] uppercase text-inkDim hover:text-accent transition-colors tabular-nums"
                      title={t('common.copy')}>
                      #{cup.invite_code}
                    </button>
                  )}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                {cup.owner_id === user?.id && (
                  <button
                    onClick={() => setBoostCup(cup)}
                    className={`text-[10px] font-bold tracking-[0.12em] uppercase px-2.5 py-1 rounded-md active:scale-95 transition-transform border ${
                      cup.promoted_until && new Date(cup.promoted_until) > new Date()
                        ? 'bg-accent text-brandDark border-accent'
                        : 'bg-surface text-inkMuted border-line hover:text-accent hover:border-accent/40'
                    }`}
                    title="Nach oben schieben / Highlight"
                  >
                    {cup.promoted_until && new Date(cup.promoted_until) > new Date() ? 'Boost ●' : 'Boost'}
                  </button>
                )}
                {cup.owner_id === user?.id && pendingCounts[cup.id] > 0 && (
                  <button
                    onClick={() => setJoinReqCup(cup)}
                    className="text-[10px] font-bold tracking-[0.12em] uppercase px-2.5 py-1 rounded-md bg-warn/15 text-warn border border-warn/40 active:scale-95 transition-transform"
                    title="Beitritts-Anfragen prüfen"
                  >
                    {pendingCounts[cup.id]} Anfragen
                  </button>
                )}
                {cup.owner_id === user?.id && (cup.package_type || 'free') === 'free' && (
                  <button
                    onClick={() => setPremiumConsentCup(cup)}
                    disabled={upgrading === cup.id}
                    className="text-[10px] font-bold tracking-[0.12em] uppercase px-2.5 py-1 rounded-md active:scale-95 transition-transform bg-accent text-bg hover:bg-accentDeep disabled:opacity-50"
                    title="Auf Premium upgraden"
                  >
                    {upgrading === cup.id ? '…' : 'Premium · 49 €'}
                  </button>
                )}
                {(cup.package_type && cup.package_type !== 'free') && (
                  <span className="text-[10px] font-bold tracking-[0.16em] uppercase px-2.5 py-1 rounded-md bg-accent/10 text-accent border border-accent/30">
                    {cup.package_type === 'premium' ? 'Premium' : cup.package_type === 'club' ? 'Club' : 'League'}
                  </span>
                )}
                <button
                  onClick={() => navigate(`/teams?tid=${cup.id}`)}
                  className="text-[10px] font-bold tracking-[0.12em] uppercase px-2.5 py-1 rounded-md active:scale-95 transition-transform bg-surface text-inkMuted border border-line hover:text-accent hover:border-accent/40"
                  title="Spieler & Teams"
                >
                  Teams
                </button>
                <button
                  onClick={() => toggleStatus(cup)}
                  className={`text-[10px] font-bold tracking-[0.12em] uppercase px-2.5 py-1 rounded-md active:scale-95 transition-transform ${
                    cup.status === 'active'
                      ? 'bg-accent/12 text-accent border border-accent/30'
                      : 'bg-surface text-inkMuted border border-line'
                  }`}
                >
                  {cup.status === 'active' ? t('matches.live') : t('matches.finished')}
                </button>
                {cup.invite_code && (
                  <button onClick={() => setShareCup(cup)}
                    className="p-2 rounded-lg active:scale-90 transition-transform text-inkMuted hover:text-ink"
                    title={t('common.share')}>
                    <ShareIcon />
                  </button>
                )}
                {cup.owner_id === user?.id && (
                  <button onClick={() => setExtrasCup(cup)}
                    className="p-2 rounded-lg active:scale-90 transition-transform text-inkMuted hover:text-accent"
                    title="Cover · Awards · Sponsor">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
                    </svg>
                  </button>
                )}
                <button onClick={() => openEdit(cup)}
                  className="p-2 rounded-lg active:scale-90 transition-transform text-inkMuted hover:text-ink">
                  <PencilIcon />
                </button>
                <button onClick={() => guarded(cup, () => setDeleteId(cup.id))}
                  className="p-2 rounded-lg active:scale-90 transition-transform text-inkMuted hover:text-danger">
                  <TrashIcon />
                </button>
              </div>
            </div>
          ))}

          {tournaments.length === 0 && !mode && (
            <div className="text-center py-16 px-6">
              <p className="text-sm text-inkMuted">{t('cup.empty')}</p>
            </div>
          )}
        </div>
      )}

      {deleteId && (
        <ConfirmDialog
          message="Turnier löschen? Alle Matches und Ergebnisse gehen verloren."
          confirmText="Löschen"
          onConfirm={handleDelete}
          onCancel={() => setDeleteId(null)}
        />
      )}

      {showGate && gateTournament && (
        <PasswordGate
          tournamentId={gateTournament.id}
          onSuccess={handleGateSuccess}
          onCancel={() => { setShowGate(false); pendingRef.current = null }}
        />
      )}

      {shareCup && (
        <ShareSheet
          open={!!shareCup}
          onClose={() => setShareCup(null)}
          url={`https://swingandsavor.at/i/${shareCup.invite_code}`}
          text={t('share.cupShareText', { cup: shareCup.name, url: `https://swingandsavor.at/i/${shareCup.invite_code}` })}
          title={t('cup.shareInvite')}
        />
      )}

      {extrasCup && (
        <CupExtrasSheet
          cup={extrasCup}
          onClose={() => setExtrasCup(null)}
          onChanged={loadTournaments}
        />
      )}

      {boostCup && (
        <BoostSheet
          cup={boostCup}
          onClose={() => setBoostCup(null)}
        />
      )}

      {joinReqCup && (
        <JoinRequestsSheet
          cup={joinReqCup}
          onClose={() => setJoinReqCup(null)}
          onChanged={loadTournaments}
        />
      )}

      {premiumConsentCup && (
        <PremiumConsentModal
          cup={premiumConsentCup}
          onCancel={() => setPremiumConsentCup(null)}
          onConfirm={() => upgradeToPremium(premiumConsentCup)}
        />
      )}
    </div>
  )
}

// §356 Abs. 5 BGB: ausdrückliche Zustimmung zur sofortigen Ausführung +
// Kenntnis vom Erlöschen des Widerrufsrechts. Pflicht-Checkbox vor dem Premium-Kauf.
function PremiumConsentModal({ cup, onCancel, onConfirm }) {
  const { t } = useTranslation()
  const [checked, setChecked] = useState(false)
  return (
    <div className="fixed inset-0 z-50 bg-black/65 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}>
      <div className="bg-surface w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-line p-6 space-y-4">
        <div>
          <p className="text-[10px] font-bold tracking-[0.22em] uppercase text-accent">{t('sheets.premium.title', 'Premium')}</p>
          <p className="font-condensed font-bold text-xl text-ink mt-1">{cup.name}</p>
        </div>
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 w-4 h-4 shrink-0 accent-accent" />
          <span className="text-[11px] leading-relaxed text-inkMuted">{t('sheets.boost.instantConsent')}</span>
        </label>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel}
            className="flex-1 py-3 rounded-xl text-sm font-bold bg-bg text-inkMuted border border-line active:scale-[0.98] transition-transform">
            {t('common.cancel', 'Abbrechen')}
          </button>
          <button type="button" onClick={onConfirm} disabled={!checked}
            className="flex-1 py-3 rounded-xl text-sm font-bold bg-accent text-brandDark active:scale-[0.98] transition-transform disabled:opacity-40">
            {t('sheets.premium.cta', 'Premium · 49 €')}
          </button>
        </div>
      </div>
    </div>
  )
}
