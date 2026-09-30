import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { openDealBuddyChallenge, challengeFriendOnDealBuddy } from '../lib/dealbuddy'
import { matchDeepLink } from '../lib/links'
import { fetchProfileMap, searchProfiles, PROFILE_CARD_COLUMNS } from '../lib/profiles'
import LoadingSpinner from '../components/LoadingSpinner'

export default function ChallengesScreen() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const presetOpponentId = searchParams.get('opponent')
  const wantsNew = searchParams.get('new') === '1'
  const { user, profile } = useAuth()
  const [tab, setTab]       = useState('incoming') // incoming | active | sent | finished
  const [creating, setCreating] = useState(false)
  const [presetOpponent, setPresetOpponent] = useState(null)
  const [loading, setLoading]   = useState(true)
  const [items, setItems]       = useState([])
  const [profilesById, setProfilesById] = useState({})

  useEffect(() => { if (user) load() }, [user, tab])

  // If we were sent here from a friend row with ?opponent=<uid>, open the
  // create form pre-filled with that friend.  Or just ?new=1 → open empty form.
  useEffect(() => {
    if (wantsNew && !presetOpponentId) {
      setCreating(true)
      setSearchParams({}, { replace: true })
      return
    }
    if (!presetOpponentId) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase.from('profiles')
        .select(PROFILE_CARD_COLUMNS)
        .eq('id', presetOpponentId).maybeSingle()
      if (!cancelled && data) {
        setPresetOpponent(data)
        setCreating(true)
      }
    })()
    return () => { cancelled = true }
  }, [presetOpponentId, wantsNew])

  async function load() {
    setLoading(true)
    let q = supabase.from('challenges').select('*').order('created_at', { ascending: false }).limit(50)

    if (tab === 'incoming') {
      q = q.eq('opponent_id', user.id).eq('status', 'pending')
    } else if (tab === 'active') {
      q = q.in('status', ['accepted','active'])
        .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
    } else if (tab === 'sent') {
      q = q.eq('challenger_id', user.id).in('status', ['pending','declined'])
    } else if (tab === 'finished') {
      q = q.in('status', ['finished','cancelled'])
        .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
    }

    const { data } = await q
    const rows = data ?? []
    setItems(rows)

    const ids = new Set()
    rows.forEach(c => {
      ids.add(c.challenger_id)
      if (c.opponent_id) ids.add(c.opponent_id)
      ;(c.challenger_team || []).forEach(i => ids.add(i))
      ;(c.opponent_team   || []).forEach(i => ids.add(i))
    })
    if (ids.size) {
      setProfilesById(await fetchProfileMap(ids))
    }
    setLoading(false)
  }

  async function accept(c) {
    // Accept: create a tournament + match scaffold linked to the challenge,
    // then mark accepted. Live tracking is just /matches/:id.
    const challengerName = profilesById[c.challenger_id]?.display_name || 'Challenger'
    const opponentName   = c.opponent_id
      ? (profilesById[c.opponent_id]?.display_name || 'Opponent')
      : 'Opponent'

    const { data: t, error: e1 } = await supabase.from('tournaments').insert({
      name: c.title,
      date: new Date().toISOString().slice(0,10),
      team_a_name: challengerName,
      team_b_name: opponentName,
      visibility: c.visibility,
      owner_id: c.challenger_id,
      description: c.description,
    }).select('id').single()
    if (e1 || !t) { alert('Konnte Turnier nicht anlegen: ' + (e1?.message || '')); return }

    // For singles/doubles types we create players + a match. For team type we leave it open.
    let matchId = null
    if (c.type === 'singles') {
      const { data: pa } = await supabase.from('players').insert({
        tournament_id: t.id, name: challengerName, team: 'A',
        handicap: profilesById[c.challenger_id]?.hcp ?? 0,
      }).select('id').single()
      const { data: pb } = await supabase.from('players').insert({
        tournament_id: t.id, name: opponentName, team: 'B',
        handicap: profilesById[c.opponent_id]?.hcp ?? 0,
      }).select('id').single()
      const { data: m } = await supabase.from('matches').insert({
        tournament_id: t.id, type: 'singles',
        team_a_player1_id: pa?.id, team_b_player1_id: pb?.id,
      }).select('id').single()
      matchId = m?.id
    }

    await supabase.from('challenges').update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      tournament_id: t.id,
      match_id: matchId,
    }).eq('id', c.id)

    if (matchId) navigate(`/matches/${matchId}`)
    else navigate('/board')
  }

  async function decline(c) {
    await supabase.from('challenges').update({ status: 'declined' }).eq('id', c.id)
    load()
  }

  async function cancel(c) {
    await supabase.from('challenges').update({ status: 'cancelled' }).eq('id', c.id)
    load()
  }

  function postOnDealBuddy(c) {
    const opponent = c.opponent_id ? profilesById[c.opponent_id]?.display_name : ''
    const matchUrl = c.match_id ? matchDeepLink(c.match_id) : null
    openDealBuddyChallenge({
      title: c.title, opponent, stake: c.stake, challengeId: c.id, matchUrl,
    })
  }

  if (!profile) return null

  return (
    <div className="max-w-lg mx-auto animate-fade-up">
      <div className="flex items-center justify-between px-4 pt-6 pb-4">
        <h1 className="font-condensed text-3xl font-bold tracking-wide text-ink">Duelle</h1>
        <button
          onClick={() => setCreating(v => !v)}
          className={`px-4 py-2 rounded-lg text-sm font-bold tracking-wide active:scale-[0.97] transition-all ${
            creating ? 'bg-surface text-inkMuted border border-line' : 'bg-accent text-brandDark'
          }`}>
          {creating ? 'Schließen' : '+ Challenge'}
        </button>
      </div>

      {creating && (
        <CreateForm
          presetOpponent={presetOpponent}
          onCreated={() => {
            setCreating(false); setPresetOpponent(null)
            setSearchParams({}, { replace: true })
            setTab('sent'); load()
          }}
          onClose={() => {
            setCreating(false); setPresetOpponent(null)
            setSearchParams({}, { replace: true })
          }}
        />
      )}

      {/* Tabs */}
      <div className="px-3 mb-3 flex gap-2 overflow-x-auto">
        {[
          ['incoming', 'Eingehend'],
          ['active',   'Aktiv'],
          ['sent',     'Gesendet'],
          ['finished', 'Erledigt'],
        ].map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`px-3 py-2 rounded-lg text-xs font-bold tracking-wide active:scale-[0.96] transition-all flex-shrink-0 ${
              tab === k ? 'bg-accent text-brandDark' : 'bg-surface text-inkMuted border border-line'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="border-t border-lineSoft">
          {items.map((c, idx) => (
            <ChallengeRow key={c.id} c={c} idx={idx}
              me={user.id}
              profiles={profilesById}
              onAccept={() => accept(c)}
              onDecline={() => decline(c)}
              onCancel={() => cancel(c)}
              onOpenMatch={() => c.match_id && navigate(`/matches/${c.match_id}`)}
              onDealBuddy={() => postOnDealBuddy(c)}
            />
          ))}
          {items.length === 0 && (
            <div className="text-center py-16 px-6">
              <p className="text-sm text-inkMuted">
                {tab === 'incoming' && 'Keine offenen Herausforderungen'}
                {tab === 'active'   && 'Keine laufenden Duelle'}
                {tab === 'sent'     && 'Du hast keine ausstehenden Challenges'}
                {tab === 'finished' && 'Noch nichts beendet'}
              </p>
              {tab === 'sent' && (
                <p className="text-xs mt-1 text-inkDim">
                  Tippe <span className="text-accent font-semibold">+ Challenge</span>, um jemanden herauszufordern
                </p>
              )}
            </div>
          )}
        </div>
      )}
      <div className="h-6" />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function CreateForm({ onCreated, onClose, presetOpponent }) {
  const { user } = useAuth()
  const [type, setType] = useState('singles')
  const [opponentQuery, setOpponentQuery] = useState(presetOpponent?.display_name || '')
  const [opponents, setOpponents] = useState(presetOpponent ? [presetOpponent] : [])
  const [opponentId, setOpponentId] = useState(presetOpponent?.id || null)
  const [title, setTitle] = useState('')
  const [stake, setStake] = useState('')
  const [visibility, setVisibility] = useState('friends')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { searchOpponents() }, [opponentQuery])

  const selectedOpponent = opponentId
    ? (opponents.find(o => o.id === opponentId) || presetOpponent)
    : null

  function sendToDealBuddy() {
    if (!selectedOpponent) { setError('Gegner wählen'); return }
    challengeFriendOnDealBuddy(selectedOpponent, {
      title: title.trim() || undefined,
      stake: stake.trim() || undefined,
    })
  }

  async function searchOpponents() {
    if (opponentQuery.length < 2) { setOpponents([]); return }
    const data = await searchProfiles(opponentQuery, { excludeId: user.id, limit: 8 })
    setOpponents(data)
  }

  async function submit(e) {
    e.preventDefault()
    if (!title.trim()) { setError('Titel ist Pflicht'); return }
    if (!opponentId)    { setError('Gegner wählen'); return }
    setBusy(true); setError(null)
    const { error: err } = await supabase.from('challenges').insert({
      challenger_id: user.id,
      opponent_id: opponentId,
      type,
      title: title.trim(),
      stake: stake.trim() || null,
      visibility,
    })
    setBusy(false)
    if (err) { setError(err.message); return }
    onCreated()
  }

  return (
    <form onSubmit={submit}
      className="mx-4 mb-4 rounded-card p-4 flex flex-col gap-3 bg-surface border border-line animate-fade-up">
      <p className="text-xs font-bold tracking-[0.2em] uppercase text-inkMuted">Neue Challenge</p>

      <div className="flex gap-2">
        {[['singles','Singles'],['doubles','Doubles'],['team','Team']].map(([val, lbl]) => (
          <button key={val} type="button"
            onClick={() => setType(val)}
            className={`flex-1 py-2.5 rounded-xl font-bold text-sm active:scale-[0.97] transition-all ${
              type === val ? 'bg-accent text-brandDark' : 'bg-bg text-inkMuted border border-line'
            }`}>
            {lbl}
          </button>
        ))}
      </div>

      <input
        type="text" placeholder="Worum geht's? z.B. 18 Loch Sonntag"
        className="w-full bg-bg border border-line rounded-xl px-4 py-3 text-ink placeholder:text-inkDim text-sm focus:border-accent/60"
        value={title} onChange={e => setTitle(e.target.value)} required
      />

      {/* Opponent search */}
      <div>
        <input
          type="text" placeholder="Gegner: @handle oder Name"
          autoCapitalize="none" autoCorrect="off"
          className="w-full bg-bg border border-line rounded-xl px-4 py-3 text-ink placeholder:text-inkDim text-sm focus:border-accent/60"
          value={opponentQuery} onChange={e => { setOpponentQuery(e.target.value); setOpponentId(null) }}
        />
        {opponentId && (
          <div className="mt-2 text-xs text-accent flex items-center gap-2">
            <span>✓ Gewählt:</span>
            <span className="font-semibold">{opponents.find(o => o.id === opponentId)?.display_name}</span>
          </div>
        )}
        {!opponentId && opponents.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {opponents.map(o => (
              <button key={o.id} type="button"
                onClick={() => { setOpponentId(o.id); setOpponentQuery(o.display_name) }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg border border-line text-left active:bg-surface2 transition-colors">
                <div className="w-7 h-7 rounded-full bg-accent/15 border border-accent/30 overflow-hidden flex items-center justify-center flex-shrink-0">
                  {o.avatar_url
                    ? <img src={o.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <span className="font-condensed font-black text-xs text-accent">{o.display_name?.[0]?.toUpperCase()}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-ink truncate">{o.display_name}</p>
                  <p className="text-xs text-inkMuted truncate">@{o.handle}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <input
        type="text" placeholder="Einsatz (optional) — z.B. „Verlierer zahlt das Bier"
        className="w-full bg-bg border border-line rounded-xl px-4 py-3 text-ink placeholder:text-inkDim text-sm focus:border-accent/60"
        value={stake} onChange={e => setStake(e.target.value)}
      />

      <div>
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-inkMuted pl-1 mb-1.5">Wer darf's sehen</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            ['public',  'Öffentlich'],
            ['friends', 'Freunde'],
            ['private', 'Privat'],
          ].map(([val, label]) => (
            <button key={val} type="button"
              onClick={() => setVisibility(val)}
              className={`py-2 rounded-xl text-xs font-bold active:scale-[0.97] transition-all ${
                visibility === val ? 'bg-accent/15 text-accent border border-accent/40' : 'bg-bg text-inkMuted border border-line'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-danger text-xs pl-1">{error}</p>}

      <div className="flex flex-col gap-2">
        <button type="submit" disabled={busy}
          className="py-3 rounded-xl text-sm font-bold tracking-wide bg-accent text-brandDark active:scale-[0.98] transition-transform disabled:opacity-50">
          {busy ? 'Sende…' : 'Challenge senden'}
        </button>
        <button type="button" onClick={sendToDealBuddy} disabled={busy}
          className="py-2.5 rounded-xl text-xs font-bold tracking-wide bg-bg text-inkMuted border border-line hover:border-accent/40 active:scale-[0.98] transition-all">
          💰 Direkt auf DealBuddy herausfordern →
        </button>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function ChallengeRow({ c, idx, me, profiles, onAccept, onDecline, onCancel, onOpenMatch, onDealBuddy }) {
  const challenger = profiles[c.challenger_id]
  const opponent   = c.opponent_id ? profiles[c.opponent_id] : null
  const youAreChallenger = c.challenger_id === me
  const youAreOpponent   = c.opponent_id   === me

  let chip = null
  if (c.status === 'pending')   chip = <Chip color="warn">Offen</Chip>
  if (c.status === 'accepted')  chip = <Chip color="accent">Angenommen</Chip>
  if (c.status === 'active')    chip = <Chip color="accent" pulse>Live</Chip>
  if (c.status === 'finished')  chip = <Chip color="muted">Beendet</Chip>
  if (c.status === 'declined')  chip = <Chip color="muted">Abgelehnt</Chip>
  if (c.status === 'cancelled') chip = <Chip color="muted">Storniert</Chip>

  return (
    <div className="px-4 py-3.5 border-b border-lineSoft" style={{ animationDelay: `${idx * 25}ms` }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-semibold text-sm text-ink truncate">{c.title}</p>
          <VisibilityBadge v={c.visibility} />
        </div>
        {chip}
      </div>

      <div className="flex items-center gap-2 mb-1.5">
        <Avatar p={challenger} />
        <span className="text-xs text-inkMuted truncate flex-1">{challenger?.display_name || '…'}</span>
        <span className="text-[10px] font-bold tracking-widest text-line">VS</span>
        <span className="text-xs text-inkMuted truncate flex-1 text-right">{opponent?.display_name || '…'}</span>
        <Avatar p={opponent} />
      </div>

      {c.stake && (
        <p className="text-xs text-inkDim mt-2 italic">„{c.stake}"</p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mt-3">
        {c.status === 'pending' && youAreOpponent && (
          <>
            <button onClick={onAccept}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide bg-accent text-brandDark active:scale-95 transition-transform">
              Annehmen
            </button>
            <button onClick={onDecline}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide bg-surface text-inkMuted border border-line active:scale-95 transition-transform">
              Ablehnen
            </button>
          </>
        )}
        {c.status === 'pending' && youAreChallenger && (
          <button onClick={onCancel}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide bg-surface text-inkMuted border border-line active:scale-95 transition-transform">
            Stornieren
          </button>
        )}
        {(c.status === 'accepted' || c.status === 'active') && c.match_id && (
          <button onClick={onOpenMatch}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide bg-accent text-brandDark active:scale-95 transition-transform">
            Live tracken →
          </button>
        )}
        {(c.status === 'accepted' || c.status === 'active') && (youAreChallenger || youAreOpponent) && (
          <button onClick={onDealBuddy}
            className="px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-wide bg-bg text-inkMuted border border-line hover:border-accent/40 active:scale-95 transition-all">
            Als Deal auf DealBuddy →
          </button>
        )}
      </div>
    </div>
  )
}

function Avatar({ p }) {
  return (
    <div className="w-7 h-7 rounded-full bg-accent/15 border border-accent/30 overflow-hidden flex items-center justify-center flex-shrink-0">
      {p?.avatar_url
        ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
        : <span className="font-condensed font-black text-xs text-accent">{p?.display_name?.[0]?.toUpperCase() || '?'}</span>}
    </div>
  )
}

function Chip({ color = 'muted', pulse, children }) {
  const cls = {
    accent: 'text-accent bg-accent/12 border border-accent/30',
    warn:   'text-warn bg-warn/12 border border-warn/30',
    muted:  'text-inkMuted bg-surface border border-line',
  }[color]
  return (
    <span className={`text-[9px] font-bold tracking-wider uppercase px-2 py-0.5 rounded inline-flex items-center gap-1 ${cls}`}>
      {pulse && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
      {children}
    </span>
  )
}

function VisibilityBadge({ v }) {
  if (v === 'public')  return <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded text-accent bg-accent/12 border border-accent/30">Public</span>
  if (v === 'friends') return <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded text-teamA bg-teamA/12 border border-teamA/30">Friends</span>
  if (v === 'private') return <span className="text-[9px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded text-lock bg-lock/12 border border-lock/30">Privat</span>
  return null
}
