import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { subscribeToTables } from '../lib/realtime'
import { useAuth } from '../lib/auth'
import { calcMatchStanding, calcStablefordTotals } from '../lib/scoring'
import { fetchSocialCounts, fetchMyReactions } from '../lib/social'
import { fetchProfileMap, indexById } from '../lib/profiles'
import { renderMatchShareCard, shareOrDownload } from '../lib/shareCard'
import { formatCupDate } from '../lib/format'
import { useTranslation } from 'react-i18next'
import { useProAccess } from '../lib/proAccess'
import { probeLaunchMonitor } from '../lib/launchMonitor'
import SocialBar from '../components/SocialBar'
import LoadingSpinner from '../components/LoadingSpinner'
import { debounce } from '../lib/debounce'
import { fileExt } from '../lib/format'
import { uploadToBucket } from '../lib/uploads'

const TEAM_A = '#9BB5C9'
const TEAM_B = '#D9A38E'
const LIVE   = '#D9C9A8'

// Deterministische Akzent-Farbe pro Cup, gedeckt-elegant statt bunt.
const CUP_HUES = ['#D9C9A8', '#5C9A6E', '#9BB5C9', '#A8956A', '#7B9E89', '#C8A5BE', '#E5B86A', '#B58A6A']
function cupColor(id) {
  if (!id) return CUP_HUES[0]
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return CUP_HUES[h % CUP_HUES.length]
}

const FILTERS = [
  { key: 'all',     label: 'Alle'     },
  { key: 'friends', label: 'Freunde'  },
  { key: 'mine',    label: 'Eigene'   },
]

export default function HomeScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const isPro = useProAccess()
  const [loading, setLoading] = useState(true)
  const [matches, setMatches] = useState([])
  const [casualRounds, setCasualRounds] = useState([])
  const [holesByMatch, setHolesByMatch] = useState({})
  const [filter, setFilter] = useState('all')
  const [friendOwnerIds, setFriendOwnerIds] = useState(new Set())
  const [social, setSocial] = useState({})    // matchId → {likes, comments}
  const [myLikes, setMyLikes] = useState(new Set())
  const [sponsorByCup, setSponsorByCup] = useState({}) // cupId → { name, logo_url, website_url }
  const [coverOverrides, setCoverOverrides] = useState({}) // cupId → fresh cover_url (optimistic)
  // Launch Monitor läuft nur in der iOS-App auf LiDAR-Geräten (iPhone 12 Pro+).
  // Auf Web/Android/älteren iPhones die PRO-Promo-Karte gar nicht zeigen, sonst
  // führt sie in eine Sackgasse. Nutzt dieselbe Capability-Probe wie RangeScreen.
  const [rangeCapable, setRangeCapable] = useState(false)
  const channelRef = useRef(null)
  const loadRef = useRef(() => {})
  const refreshSocialRef = useRef(() => {})
  // Stabile, debouncte Realtime-Handler: ein Event-Schwall ⇒ ein Reload.
  const debouncedLoad = useRef(debounce(() => loadRef.current(), 400)).current
  const debouncedSocial = useRef(debounce(() => refreshSocialRef.current(), 400)).current

  useEffect(() => {
    load()
    subscribe()
    return () => {
      channelRef.current?.()
      debouncedLoad.cancel()
      debouncedSocial.cancel()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => {
    let alive = true
    probeLaunchMonitor().then(p => { if (alive) setRangeCapable(!!p?.supported) })
    return () => { alive = false }
  }, [])

  async function load() {
    setLoading(true)

    // Freunde-IDs (für Filter "Freunde")
    if (user?.id) {
      const { data: fs } = await supabase
        .from('friendships').select('user_a,user_b,status')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .eq('status', 'accepted')
      const ids = new Set()
      for (const f of (fs || [])) ids.add(f.user_a === user.id ? f.user_b : f.user_a)
      setFriendOwnerIds(ids)
    }

    // Casual-Runden (RLS: own + public + friends + player)
    const { data: cRounds } = await supabase
      .from('casual_rounds')
      .select('id, name, course_name, hole_pars, status, visibility, owner_id, created_at, finished_at')
      .order('created_at', { ascending: false })
      .limit(8)
    const cRoundIds = (cRounds || []).map(r => r.id)
    let cPlayersByRound = {}
    let cScoreCountByRound = {}
    if (cRoundIds.length > 0) {
      const [{ data: cps }, { data: css }] = await Promise.all([
        supabase.from('casual_round_players').select('round_id, idx, display_name, profile_id').in('round_id', cRoundIds).order('idx'),
        supabase.from('casual_scores').select('round_id').in('round_id', cRoundIds),
      ])
      for (const p of (cps || [])) {
        if (!cPlayersByRound[p.round_id]) cPlayersByRound[p.round_id] = []
        cPlayersByRound[p.round_id].push(p)
      }
      for (const s of (css || [])) {
        cScoreCountByRound[s.round_id] = (cScoreCountByRound[s.round_id] || 0) + 1
      }
    }
    setCasualRounds((cRounds || []).map(r => ({
      ...r,
      _players: cPlayersByRound[r.id] || [],
      _scoreCount: cScoreCountByRound[r.id] || 0,
    })))

    // Matches (RLS sorgt für Sichtbarkeit — public + friends + own)
    const { data: mList } = await supabase
      .from('matches')
      .select(`
        id, type, status, winner, created_at, photo_url, visibility,
        team_a_player_ids, team_b_player_ids,
        team_a_player1_id, team_a_player2_id, team_b_player1_id, team_b_player2_id,
        team_a_factor, team_b_factor,
        tournament:tournament_id (
          id, name, date, owner_id, visibility, team_a_name, team_b_name, cover_url, invite_code
        ),
        course:course_id (name, city)
      `)
      .in('status', ['active', 'finished'])
      .order('created_at', { ascending: false })
      .limit(60)

    const list = mList || []

    // Player-Namen sammeln (Tournament-Scoped Players, kein Profile-Join nötig)
    const allPlayerIds = new Set()
    for (const m of list) {
      ;(m.team_a_player_ids || []).forEach(id => id && allPlayerIds.add(id))
      ;(m.team_b_player_ids || []).forEach(id => id && allPlayerIds.add(id))
      if (m.team_a_player1_id) allPlayerIds.add(m.team_a_player1_id)
      if (m.team_a_player2_id) allPlayerIds.add(m.team_a_player2_id)
      if (m.team_b_player1_id) allPlayerIds.add(m.team_b_player1_id)
      if (m.team_b_player2_id) allPlayerIds.add(m.team_b_player2_id)
    }
    let nameById = {}
    if (allPlayerIds.size > 0) {
      const { data: pls } = await supabase
        .from('players').select('id,name,handicap').in('id', [...allPlayerIds])
      nameById = indexById(pls)
    }

    // Owner-Handles für „von @owner"
    const ownerById = await fetchProfileMap(
      list.map(m => m.tournament?.owner_id),
      'id,handle,display_name,avatar_url',
    )

    const enriched = list.map(m => {
      const aIds = m.team_a_player_ids?.length ? m.team_a_player_ids
                  : [m.team_a_player1_id, m.team_a_player2_id].filter(Boolean)
      const bIds = m.team_b_player_ids?.length ? m.team_b_player_ids
                  : [m.team_b_player1_id, m.team_b_player2_id].filter(Boolean)
      return {
        ...m,
        _namesA: aIds.map(id => nameById[id]?.name).filter(Boolean),
        _namesB: bIds.map(id => nameById[id]?.name).filter(Boolean),
        _owner:  ownerById[m.tournament?.owner_id] || null,
      }
    })

    // Hole-Results für aktive Matches
    const activeIds = enriched.filter(m => m.status === 'active').map(m => m.id)
    if (activeIds.length > 0) {
      const { data: hrs } = await supabase
        .from('hole_results').select('match_id,winner').in('match_id', activeIds)
      const byMatch = {}
      for (const h of (hrs || [])) {
        if (!byMatch[h.match_id]) byMatch[h.match_id] = []
        byMatch[h.match_id].push(h)
      }
      setHolesByMatch(byMatch)
    } else {
      setHolesByMatch({})
    }

    setMatches(enriched)

    // Sponsor-Placements pro Cup batch laden (nur aktive "powered_by")
    const cupIds = [...new Set(enriched.map(m => m.tournament?.id).filter(Boolean))]
    if (cupIds.length > 0) {
      const { data: sps } = await supabase.from('sponsor_placements')
        .select('tournament_id, sponsor:sponsor_id(name, logo_url, website_url)')
        .in('tournament_id', cupIds)
        .eq('status', 'active')
        .eq('placement_type', 'powered_by')
      const map = {}
      for (const sp of (sps || [])) {
        if (sp.sponsor && !map[sp.tournament_id]) map[sp.tournament_id] = sp.sponsor
      }
      setSponsorByCup(map)
    } else {
      setSponsorByCup({})
    }

    // Social-Counts batch laden
    const matchIds = enriched.map(m => m.id)
    const [counts, mine] = await Promise.all([
      fetchSocialCounts(matchIds),
      user?.id ? fetchMyReactions(matchIds, user.id) : Promise.resolve(new Set()),
    ])
    setSocial(counts)
    setMyLikes(mine)

    setLoading(false)
  }

  async function uploadCupCover(cupId, file) {
    try {
      const ext = fileExt(file)
      const path = `${cupId}/cover-${Date.now()}.${ext}`
      const coverUrl = await uploadToBucket('cup-covers', path, file, { upsert: false, cacheControl: '3600', contentType: file.type })
      await supabase.from('tournaments').update({ cover_url: coverUrl }).eq('id', cupId)
      setCoverOverrides(o => ({ ...o, [cupId]: coverUrl }))
    } catch (err) {
      console.error('[cup-cover-upload]', err)
      alert('Cover-Upload fehlgeschlagen.')
    }
  }

  async function handleCupShare(tournament) {
    if (!tournament?.invite_code) {
      alert('Dieser Cup hat noch keinen Invite-Code.')
      return
    }
    const url  = `https://swingandsavor.at/i/${tournament.invite_code}`
    const text = `${tournament.name} — schau live mit auf Swing & Savor`
    try {
      if (navigator.share) {
        await navigator.share({ title: tournament.name, text, url })
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        alert('Link kopiert: ' + url)
      }
    } catch (err) {
      if (err?.name !== 'AbortError') console.error('[cup-share]', err)
    }
  }

  function subscribe() {
    channelRef.current?.()
    // Globaler Feed (alle RLS-sichtbaren Matches) lässt sich nicht auf einen
    // festen id-Filter eingrenzen — daher Debounce, damit ein Tastatur-Schwall
    // irgendeines Users nicht pro Tastenanschlag einen Voll-Reload auslöst.
    channelRef.current = subscribeToTables('home-feed', [
      { table: 'matches', handler: debouncedLoad },
      { table: 'hole_results', handler: debouncedLoad },
      { table: 'casual_rounds', handler: debouncedLoad },
      { table: 'casual_scores', handler: debouncedLoad },
      { table: 'match_reactions', handler: debouncedSocial },
      { table: 'match_comments', handler: debouncedSocial },
    ])
  }

  async function refreshSocial() {
    const ids = matches.map(m => m.id)
    if (ids.length === 0) return
    const counts = await fetchSocialCounts(ids)
    setSocial(counts)
  }
  loadRef.current = load
  refreshSocialRef.current = refreshSocial

  async function handleShare(m) {
    try {
      const { blob } = await renderMatchShareCard({
        type: m.type === 'singles' ? 'Singles' : m.type === 'doubles' ? 'Doubles' : `Flight ${m._namesA.length}v${m._namesB.length}`,
        namesA: m._namesA, namesB: m._namesB,
        teamANameLabel: m.tournament?.team_a_name, teamBNameLabel: m.tournament?.team_b_name,
        scoreLine: scoreLineFor(m),
        statusLabel: m.status === 'active' ? 'Live' : m.status === 'finished' ? 'Beendet' : 'Offen',
        courseName: m.course?.name, cupName: m.tournament?.name,
        ownerHandle: m._owner?.handle,
      })
      await shareOrDownload({
        blob, filename: `swingandsavor-${m.id.slice(0, 8)}.png`,
        title: 'Swing & Savor', text: 'Schau das Match!',
        url: `https://app.swingandsavor.at/matches/${m.id}`,
      })
    } catch (e) { console.error('[share]', e) }
  }

  function scoreLineFor(m) {
    if (m.status === 'finished') {
      if (m.winner === 'A') return m.tournament?.team_a_name || 'TEAM A'
      if (m.winner === 'B') return m.tournament?.team_b_name || 'TEAM B'
      return 'A/S'
    }
    return '—'
  }

  if (loading) return <LoadingSpinner />

  const filtered = matches.filter(m => {
    if (filter === 'mine')    return m.tournament?.owner_id === user?.id
    if (filter === 'friends') return friendOwnerIds.has(m.tournament?.owner_id)
    return true
  })

  const friendsLive = matches.filter(m => m.status === 'active' && friendOwnerIds.has(m.tournament?.owner_id)).length

  // Matches nach Turnier gruppieren, damit Cup-Header nicht 1× pro Karte wiederholt wird
  const groups = []
  const groupIdx = new Map()
  for (const m of filtered) {
    const tid = m.tournament?.id || `_orphan_${m.id}`
    let g = groupIdx.get(tid)
    if (!g) {
      g = { tid, tournament: m.tournament, matches: [] }
      groupIdx.set(tid, g)
      groups.push(g)
    }
    g.matches.push(m)
  }

  return (
    <div className="max-w-lg mx-auto animate-fade-up">

      {/* Filter pills — editorial hairline */}
      <div className="px-5 pt-6 pb-4 flex gap-2 items-center">
        {FILTERS.map(f => (
          <button key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-[10px] tracking-[0.24em] uppercase transition-all ${
              filter === f.key
                ? 'bg-accent text-bg'
                : 'hairline text-inkMuted'
            }`}>
            {f.label}
            {f.key === 'friends' && friendsLive > 0 && (
              <span className={`ml-1.5 tabular-nums ${filter === f.key ? 'text-bg/70' : 'text-accent'}`}>{friendsLive}</span>
            )}
          </button>
        ))}
        <button onClick={() => navigate('/tour')}
          className="ml-auto px-3 py-1.5 text-[10px] tracking-[0.24em] uppercase hairline text-inkMuted active:scale-95 transition-transform hover:text-accent">
          Tour
        </button>
      </div>

      <div className="hairline-b" />

      {rangeCapable && <RangePromoCard isPro={isPro} onOpen={() => navigate('/range')} />}

      {casualRounds.length > 0 && (
        <CasualSection
          rounds={casualRounds.filter(r => {
            if (filter === 'mine')    return r.owner_id === user?.id
            if (filter === 'friends') return friendOwnerIds.has(r.owner_id) || r.owner_id === user?.id
            return true
          })}
          userId={user?.id}
          onOpen={(r) => navigate(`/casual/${r.id}`)}
        />
      )}

      {/* Feed: pro Turnier eine collapsible Section */}
      <div className="flex flex-col px-3 pt-2">
        {groups.map((g, gi) => (
          <CupGroup key={g.tid} tournament={g.tournament}
            matches={g.matches}
            holesByMatch={holesByMatch}
            social={social}
            myLikes={myLikes}
            isFirst={gi === 0}
            isOwner={!!g.tournament?.owner_id && g.tournament.owner_id === user?.id}
            sponsor={sponsorByCup[g.tournament?.id]}
            coverOverride={coverOverrides[g.tournament?.id]}
            onCoverFile={(file) => uploadCupCover(g.tournament.id, file)}
            onCupShare={() => handleCupShare(g.tournament)}
            onOpen={(m) => navigate(`/matches/${m.id}`)}
            onCommentClick={(m) => navigate(`/matches/${m.id}#comments`)}
            onShareClick={(m) => handleShare(m)} />
        ))}

        {filtered.length === 0 && (
          <div className="rounded-card bg-surface border border-line">
            <EmptyState
              filter={filter}
              onCta={() => navigate(filter === 'mine' ? '/cup?new=1' : '/discover')}
            />
          </div>
        )}
      </div>

      <div className="h-32" />
    </div>
  )
}

// Entry point for the Pro AR Launch Monitor (/range). Only rendered when the
// device can actually run the monitor (iOS app on a LiDAR iPhone — see the
// probeLaunchMonitor gate in HomeScreen). Web/Android/older iPhones never see it,
// so the card never leads into the RangeScreen dead-end. Discovery + upsell for
// entitled-vs-not is still handled by RangeScreen's paywall step.
function RangePromoCard({ isPro, onOpen }) {
  const { t } = useTranslation()
  return (
    <div className="px-3 pt-3">
      <button type="button" onClick={onOpen}
        className="w-full rounded-card bg-surface border border-line px-4 py-3.5 flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
        aria-label={t('range.cardOpenAria', 'Launch Monitor öffnen')}>
        {/* Target / launch-monitor icon tile */}
        <span className="flex-shrink-0 w-11 h-11 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(217,201,168,0.14)' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D9C9A8" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4.5" />
            <circle cx="12" cy="12" r="1" fill="#D9C9A8" stroke="none" />
          </svg>
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-ink leading-tight"
              style={{ fontSize: 'clamp(16px, 4.2vw, 19px)', letterSpacing: '-0.01em', fontWeight: 500 }}>
              {t('range.cardTitle', 'Launch Monitor')}
            </h2>
            <span className="text-[9px] tracking-[0.18em] font-bold rounded px-1.5 py-0.5"
              style={{ background: 'rgba(217,201,168,0.18)', color: '#D9C9A8' }}>{t('range.proBadge', 'PRO')}</span>
          </div>
          <p className="text-[11px] text-inkMuted mt-0.5 truncate">
            {isPro
              ? t('range.cardSubPro', 'AR-Launch-Monitor öffnen — Carry, Ballspeed & Spin.')
              : t('range.cardSub', 'AR-Launch-Monitor — Carry, Ballspeed, Spin & Green Reader.')}
          </p>
        </div>
        <span aria-hidden className="flex-shrink-0 text-inkDim">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </span>
      </button>
    </div>
  )
}

function CasualSection({ rounds, userId, onOpen }) {
  if (!rounds || rounds.length === 0) return null
  const top = rounds.slice(0, 5)
  return (
    <div className="px-3 pt-3">
      <div className="px-2 pb-2 flex items-baseline justify-between">
        <p className="text-[10px] font-bold tracking-[0.28em] uppercase text-inkMuted">Casual</p>
        <p className="text-[10px] tracking-[0.2em] uppercase text-inkDim">{rounds.length}</p>
      </div>
      <div className="rounded-card bg-surface border border-line overflow-hidden">
        {top.map((r, i) => {
          const live = r.status === 'active'
          const playersLabel = (r._players || []).map(p => p.display_name).filter(Boolean).join(' vs ')
          const totalHoles = (r._players?.length || 1) * 18
          const progress = totalHoles > 0 ? Math.min(100, Math.round(((r._scoreCount || 0) / totalHoles) * 100)) : 0
          const dateStr = new Date(r.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
          return (
            <button key={r.id} onClick={() => onOpen(r)}
              className={`w-full px-3 py-3 flex items-center gap-3 active:bg-bg/40 transition-colors text-left ${i > 0 ? 'border-t border-lineSoft' : ''}`}>
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${live ? 'bg-accent animate-pulse' : 'bg-line'}`} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-ink truncate">
                  {playersLabel || r.name || r.course_name || 'Casual Runde'}
                </p>
                <p className="text-[11px] text-inkMuted truncate">
                  {dateStr}
                  {r.course_name && ` · ${r.course_name}`}
                  {' · '}{live ? `${progress}%` : 'beendet'}
                </p>
              </div>
              <span className="text-inkDim text-xs">›</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CupGroup({ tournament, matches, holesByMatch, social, myLikes, isFirst, isOwner, sponsor, coverOverride, onCoverFile, onCupShare, onOpen, onCommentClick, onShareClick }) {
  const cupName  = tournament?.name || 'Lose Matches'
  const cupDate  = formatCupDate(tournament?.date, { day: '2-digit', month: 'short' })
  const cupAccent = cupColor(tournament?.id)
  const cover    = coverOverride || tournament?.cover_url
  const matchCount = matches.length
  const cupLive  = matches.filter(m => m.status === 'active').length
  const shareable = !!tournament?.invite_code

  // Turniere immer zu — User klickt drauf, um aufzuklappen.
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef(null)

  async function handleCoverPick(e) {
    const file = e.target.files?.[0]
    if (!file || !onCoverFile) return
    setUploading(true)
    try { await onCoverFile(file) } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  function pickCover(e) {
    e.stopPropagation()
    if (!isOwner) return
    fileRef.current?.click()
  }

  return (
    <section className="border-b border-lineSoft last:border-b-0">
      <div className="w-full flex items-center gap-3 px-1 py-4">

        {/* Cover-Tile — klickbar für Owner */}
        <div className="relative flex-shrink-0">
          {cover ? (
            <button type="button" onClick={pickCover}
              disabled={!isOwner || uploading}
              className={`block ${isOwner ? 'active:scale-95 transition-transform' : 'cursor-default'}`}
              aria-label={isOwner ? 'Cover ändern' : undefined}>
              <img src={cover} alt="" loading="lazy"
                className="w-11 h-11 rounded-lg object-cover border border-line" />
            </button>
          ) : (
            <button type="button" onClick={pickCover}
              disabled={!isOwner || uploading}
              className={`w-11 h-11 rounded-lg flex items-center justify-center font-display text-lg text-bg ${isOwner ? 'active:scale-95 transition-transform' : ''}`}
              style={{ background: cupAccent, opacity: 0.9 }}
              aria-label={isOwner ? 'Cover hochladen' : undefined}>
              {uploading
                ? <span className="text-bg text-xs">…</span>
                : cupName.charAt(0).toUpperCase()}
            </button>
          )}
          {isOwner && cover && !uploading && (
            <span aria-hidden
              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-bg border border-line flex items-center justify-center text-inkMuted">
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4z"/>
              </svg>
            </span>
          )}
          {isOwner && (
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={handleCoverPick} />
          )}
        </div>

        {/* Name + Meta — klickbar zum Auf-/Zuklappen */}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex-1 min-w-0 text-left active:opacity-80 transition-opacity"
          aria-expanded={open}>
          <h2 className="font-display text-ink leading-tight truncate"
            style={{ fontSize: 'clamp(17px, 4.4vw, 21px)', letterSpacing: '-0.01em', fontWeight: 500 }}>
            {cupName}
          </h2>
          <p className="text-[10px] tracking-[0.22em] uppercase mt-0.5 text-inkDim">
            {cupDate && <span style={{ color: cupAccent }}>{cupDate}</span>}
            {cupDate && ' · '}
            <span>{matchCount} {matchCount === 1 ? 'Match' : 'Matches'}</span>
            {cupLive > 0 && (
              <>
                {' · '}
                <span className="text-accent inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                  {cupLive} live
                </span>
              </>
            )}
          </p>
        </button>

        {/* Cup-Share — der virale Hebel */}
        {shareable && (
          <button type="button" onClick={onCupShare}
            className="flex-shrink-0 p-2 -mr-1 text-inkMuted hover:text-accent active:scale-90 transition-all"
            aria-label="Cup teilen">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
          </button>
        )}

        {/* Chevron */}
        <button type="button" onClick={() => setOpen(o => !o)}
          aria-label={open ? 'Zuklappen' : 'Aufklappen'}
          className="flex-shrink-0 p-1 text-inkMuted transition-transform duration-200"
          style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>

      {open && (
        <div className="flex flex-col gap-2 pb-4">
          {/* Powered-by Sponsor — nur wenn vorhanden, dezent */}
          {sponsor && (
            <a href={sponsor.website_url || '#'}
              target={sponsor.website_url ? '_blank' : undefined}
              rel="noopener noreferrer"
              onClick={(e) => { if (!sponsor.website_url) e.preventDefault() }}
              className="flex items-center gap-2 px-2 py-1 -mt-1 mb-1 text-inkDim hover:text-ink transition-colors">
              <span className="text-[9px] tracking-[0.32em] uppercase">Powered by</span>
              {sponsor.logo_url
                ? <img src={sponsor.logo_url} alt={sponsor.name} className="h-4 max-w-[120px] object-contain opacity-80" />
                : <span className="text-[10px] tracking-wider">{sponsor.name}</span>}
            </a>
          )}

          {matches.map(m => (
            <div key={m.id} className="rounded-card overflow-hidden bg-surface border border-line">
              <FeedCard match={m} holes={holesByMatch[m.id] || []}
                social={social[m.id] || { likes: 0, comments: 0 }}
                liked={myLikes.has(m.id)}
                cupAccent={cupAccent}
                onOpen={() => onOpen(m)}
                onCommentClick={() => onCommentClick(m)}
                onShareClick={() => onShareClick(m)} />
            </div>
          ))}

          {/* Owner-Hint wenn noch kein Cover gesetzt */}
          {isOwner && !cover && (
            <button type="button" onClick={pickCover}
              className="mt-1 mx-1 py-2 hairline text-inkMuted text-[10px] tracking-[0.24em] uppercase active:scale-[0.99] transition-transform">
              + Cover-Bild hochladen
            </button>
          )}
        </div>
      )}
    </section>
  )
}

function FeedCard({ match: m, holes, social, liked, cupAccent, onOpen, onCommentClick, onShareClick }) {
  const isActive     = m.status === 'active'
  const isFinished   = m.status === 'finished'
  const isStableford = m.format === 'stableford'

  const baseTypeLbl = m.type === 'singles' ? 'Singles'
                     : m.type === 'doubles' ? 'Doubles'
                     : `Flight ${m._namesA.length}v${m._namesB.length}`
  const typeLbl = isStableford ? `${baseTypeLbl} · Stableford` : baseTypeLbl

  const namesA = m._namesA.join(' · ') || '—'
  const namesB = m._namesB.join(' · ') || '—'

  let scoreLabel = '—'
  let scoreColor = '#9C968C'
  let scoreBg = 'transparent'

  if (isFinished) {
    if (m.winner === 'A')      { scoreLabel = m.tournament?.team_a_name ? `${m.tournament.team_a_name}` : 'A'; scoreColor = TEAM_A; scoreBg = 'rgba(155,181,201,0.12)' }
    else if (m.winner === 'B') { scoreLabel = m.tournament?.team_b_name ? `${m.tournament.team_b_name}` : 'B'; scoreColor = TEAM_B; scoreBg = 'rgba(217,163,142,0.12)' }
    else                       { scoreLabel = 'A/S'; scoreColor = '#9C968C'; scoreBg = 'rgba(168,181,173,0.08)' }
  } else if (isActive) {
    if (isStableford) {
      const t = calcStablefordTotals(holes)
      const leader = t.a > t.b ? 'A' : t.b > t.a ? 'B' : 'none'
      scoreLabel = `${t.a}:${t.b}`
      scoreColor = leader === 'A' ? TEAM_A : leader === 'B' ? TEAM_B : LIVE
      scoreBg    = leader === 'A' ? 'rgba(155,181,201,0.10)'
                  : leader === 'B' ? 'rgba(217,163,142,0.10)'
                                   : 'rgba(217,201,168,0.10)'
    } else {
      const standing = calcMatchStanding(holes)
      if (standing.leader === 'A')      { scoreLabel = standing.label; scoreColor = TEAM_A; scoreBg = 'rgba(155,181,201,0.10)' }
      else if (standing.leader === 'B') { scoreLabel = standing.label; scoreColor = TEAM_B; scoreBg = 'rgba(217,163,142,0.10)' }
      else                              { scoreLabel = 'A/S'; scoreColor = LIVE; scoreBg = 'rgba(217,201,168,0.10)' }
    }
  }

  // Subline: Course nur wenn er sich vom Turniernamen unterscheidet (sonst doppelt).
  const courseLine = m.course?.name && m.course.name !== m.tournament?.name ? m.course.name : ''
  const subline = isActive
    ? `Loch ${holes.length}${courseLine ? ' · ' + courseLine : ''}`
    : isFinished
      ? `Beendet${courseLine ? ' · ' + courseLine : ''}`
      : courseLine

  return (
    <div className="w-full relative">
      {/* Cup-Akzent links — gedeckter Streifen pro Cup-ID */}
      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: cupAccent, opacity: 0.85 }} />
      <button onClick={onOpen}
        className="w-full text-left active:scale-[0.99] transition-transform block">

      {m.photo_url && (
        <div className="relative w-full bg-bg overflow-hidden" style={{ aspectRatio: '16/9' }}>
          <img src={m.photo_url} alt="" loading="lazy" className="w-full h-full object-cover" />
          {isActive && (
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-accent text-brandDark text-[10px] font-bold tracking-wider uppercase">
              ● Live
            </span>
          )}
        </div>
      )}

      {/* Type meta */}
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <span className="text-[10px] font-bold tracking-[0.18em] uppercase text-inkMuted flex items-center gap-1.5">
          {typeLbl}
          {m._owner && (
            <span className="text-inkDim normal-case font-normal tracking-normal">
              · @{m._owner.handle}
            </span>
          )}
        </span>
        <div className="flex items-center gap-1.5">
          {isActive && <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-accent" />}
          <span className={`text-[10px] font-bold tracking-wider uppercase tabular-nums ${
            isActive ? 'text-accent' : 'text-inkMuted'
          }`}>
            {isActive ? 'Live' : isFinished ? 'Beendet' : 'Offen'}
          </span>
        </div>
      </div>

      {/* Players row */}
      <div className="flex items-center gap-3 px-4 pb-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate" style={{ color: TEAM_A }}>{namesA}</p>
          <p className="text-[10px] font-semibold tracking-wider uppercase mt-0.5 truncate" style={{ color: 'rgba(155,181,201,0.55)' }}>
            {m.tournament?.team_a_name || 'Team A'}
          </p>
        </div>
        <div className="flex-shrink-0 px-3 py-1.5 rounded-xl tabular-nums"
          style={{ background: scoreBg, minWidth: 64, textAlign: 'center' }}>
          <p className="font-condensed font-black text-base leading-none truncate max-w-[120px]" style={{ color: scoreColor }}>
            {scoreLabel}
          </p>
        </div>
        <div className="flex-1 min-w-0 text-right">
          <p className="font-semibold text-sm truncate" style={{ color: TEAM_B }}>{namesB}</p>
          <p className="text-[10px] font-semibold tracking-wider uppercase mt-0.5 truncate" style={{ color: 'rgba(217,163,142,0.55)' }}>
            {m.tournament?.team_b_name || 'Team B'}
          </p>
        </div>
      </div>

      {/* Sub */}
      {subline && (
        <p className="px-4 pb-2 text-[11px] text-inkDim truncate">{subline}</p>
      )}
      </button>

      {/* Social-Bar */}
      <div className="border-t border-lineSoft">
        <SocialBar matchId={m.id}
          likes={social.likes} comments={social.comments} liked={liked}
          onCommentClick={onCommentClick} onShareClick={onShareClick} />
      </div>
    </div>
  )
}

function EmptyState({ filter, onCta }) {
  const copy = filter === 'mine'
    ? { title: 'Du hast noch keine Matches', sub: 'Leg dein erstes Turnier an, dann geht es los.', cta: '+ Turnier anlegen' }
    : filter === 'friends'
      ? { title: 'Keine Freunde aktiv', sub: 'Sobald ein Freund ein Match startet, taucht es hier auf.', cta: 'Freunde finden' }
      : { title: 'Noch ruhig im Feed', sub: 'Sei der Erste — leg ein Match oder Turnier an.', cta: 'Entdecken' }
  return (
    <div className="text-center py-14 px-6">
      <p className="font-bold text-sm text-ink">{copy.title}</p>
      <p className="text-xs mt-1 text-inkMuted">{copy.sub}</p>
      <button onClick={onCta}
        className="mt-4 px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide bg-accent text-brandDark active:scale-[0.97] transition-transform">
        {copy.cta}
      </button>
    </div>
  )
}
