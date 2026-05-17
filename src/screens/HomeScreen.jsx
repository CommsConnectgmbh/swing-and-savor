import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { calcMatchStanding, calcStablefordTotals } from '../lib/scoring'
import { fetchSocialCounts, fetchMyReactions } from '../lib/social'
import { renderMatchShareCard, shareOrDownload } from '../lib/shareCard'
import SocialBar from '../components/SocialBar'
import LoadingSpinner from '../components/LoadingSpinner'

const TEAM_A = '#60a5fa'
const TEAM_B = '#fb7185'
const LIVE   = '#98cd02'

// Deterministische Akzent-Farbe pro Turnier, damit Cups visuell unterscheidbar bleiben.
const CUP_HUES = ['#98cd02', '#f5b94a', '#a78bfa', '#34d399', '#f472b6', '#22d3ee', '#fb923c', '#e879f9']
function cupColor(id) {
  if (!id) return CUP_HUES[0]
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return CUP_HUES[h % CUP_HUES.length]
}
function fmtCupDate(d) {
  if (!d) return ''
  try { return new Date(d + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'short' }) } catch { return '' }
}

const FILTERS = [
  { key: 'all',     label: 'Alle'     },
  { key: 'friends', label: 'Freunde'  },
  { key: 'mine',    label: 'Eigene'   },
]

export default function HomeScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [matches, setMatches] = useState([])
  const [holesByMatch, setHolesByMatch] = useState({})
  const [filter, setFilter] = useState('all')
  const [friendOwnerIds, setFriendOwnerIds] = useState(new Set())
  const [social, setSocial] = useState({})    // matchId → {likes, comments}
  const [myLikes, setMyLikes] = useState(new Set())
  const channelRef = useRef(null)

  useEffect(() => {
    load()
    subscribe()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

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

    // Matches (RLS sorgt für Sichtbarkeit — public + friends + own)
    const { data: mList } = await supabase
      .from('matches')
      .select(`
        id, type, status, winner, created_at, photo_url, visibility,
        team_a_player_ids, team_b_player_ids,
        team_a_player1_id, team_a_player2_id, team_b_player1_id, team_b_player2_id,
        team_a_factor, team_b_factor,
        tournament:tournament_id (
          id, name, date, owner_id, visibility, team_a_name, team_b_name
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
      nameById = Object.fromEntries((pls || []).map(p => [p.id, p]))
    }

    // Owner-Handles für „von @owner"
    const ownerIds = [...new Set(list.map(m => m.tournament?.owner_id).filter(Boolean))]
    let ownerById = {}
    if (ownerIds.length > 0) {
      const { data: ow } = await supabase
        .from('profiles').select('id,handle,display_name,avatar_url').in('id', ownerIds)
      ownerById = Object.fromEntries((ow || []).map(p => [p.id, p]))
    }

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

  function subscribe() {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    const ch = supabase.channel('home-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hole_results' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_reactions' }, () => refreshSocial())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_comments' }, () => refreshSocial())
      .subscribe()
    channelRef.current = ch
  }

  async function refreshSocial() {
    const ids = matches.map(m => m.id)
    if (ids.length === 0) return
    const counts = await fetchSocialCounts(ids)
    setSocial(counts)
  }

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

  const liveCount   = matches.filter(m => m.status === 'active').length
  const friendsLive = matches.filter(m => m.status === 'active' && friendOwnerIds.has(m.tournament?.owner_id)).length

  return (
    <div className="max-w-lg mx-auto animate-fade-up">

      {/* Header */}
      <div className="px-4 pt-6 pb-3">
        <h1 className="font-condensed text-3xl font-bold tracking-wide text-ink">Home</h1>
        <p className="text-xs text-inkMuted mt-0.5">
          {liveCount > 0
            ? <><span className="text-accent font-bold">{liveCount} Match{liveCount === 1 ? '' : 'es'}</span> gerade live{friendsLive > 0 && <> · {friendsLive} bei Freunden</>}</>
            : 'Was deine Freunde gerade spielen.'}
        </p>
      </div>

      {/* Filter-Chips + Tour-Pill */}
      <div className="px-3 mb-3 flex gap-1.5 items-center">
        {FILTERS.map(f => (
          <button key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-wide active:scale-95 transition-all ${
              filter === f.key
                ? 'bg-accent text-brandDark'
                : 'bg-surface text-inkMuted border border-line'
            }`}>
            {f.label}
            {f.key === 'friends' && friendsLive > 0 && (
              <span className={`ml-1.5 tabular-nums ${filter === f.key ? 'text-brandDark/70' : 'text-accent'}`}>{friendsLive}</span>
            )}
          </button>
        ))}
        <button onClick={() => navigate('/tour')}
          className="ml-auto px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wide bg-surface text-inkMuted border border-line active:scale-95 transition-transform hover:text-accent">
          Tour ⛳
        </button>
      </div>

      {/* Feed */}
      <div className="mx-3 rounded-card overflow-hidden bg-surface border border-line">
        {filtered.map((m, idx) => (
          <FeedCard key={m.id} match={m} holes={holesByMatch[m.id] || []}
            social={social[m.id] || { likes: 0, comments: 0 }}
            liked={myLikes.has(m.id)}
            onOpen={() => navigate(`/matches/${m.id}`)}
            onCommentClick={() => navigate(`/matches/${m.id}#comments`)}
            onShareClick={() => handleShare(m)}
            divider={idx < filtered.length - 1} />
        ))}

        {filtered.length === 0 && (
          <EmptyState
            filter={filter}
            onCta={() => navigate(filter === 'mine' ? '/cup?new=1' : '/discover')}
          />
        )}
      </div>

      <div className="h-32" />
    </div>
  )
}

function FeedCard({ match: m, holes, social, liked, onOpen, onCommentClick, onShareClick, divider }) {
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
  let scoreColor = '#a8b5ad'
  let scoreBg = 'transparent'

  if (isFinished) {
    if (m.winner === 'A')      { scoreLabel = m.tournament?.team_a_name ? `${m.tournament.team_a_name}` : 'A'; scoreColor = TEAM_A; scoreBg = 'rgba(96,165,250,0.12)' }
    else if (m.winner === 'B') { scoreLabel = m.tournament?.team_b_name ? `${m.tournament.team_b_name}` : 'B'; scoreColor = TEAM_B; scoreBg = 'rgba(251,113,133,0.12)' }
    else                       { scoreLabel = 'A/S'; scoreColor = '#a8b5ad'; scoreBg = 'rgba(168,181,173,0.08)' }
  } else if (isActive) {
    if (isStableford) {
      const t = calcStablefordTotals(holes)
      const leader = t.a > t.b ? 'A' : t.b > t.a ? 'B' : 'none'
      scoreLabel = `${t.a}:${t.b}`
      scoreColor = leader === 'A' ? TEAM_A : leader === 'B' ? TEAM_B : LIVE
      scoreBg    = leader === 'A' ? 'rgba(96,165,250,0.10)'
                  : leader === 'B' ? 'rgba(251,113,133,0.10)'
                                   : 'rgba(152,205,2,0.10)'
    } else {
      const standing = calcMatchStanding(holes)
      if (standing.leader === 'A')      { scoreLabel = standing.label; scoreColor = TEAM_A; scoreBg = 'rgba(96,165,250,0.10)' }
      else if (standing.leader === 'B') { scoreLabel = standing.label; scoreColor = TEAM_B; scoreBg = 'rgba(251,113,133,0.10)' }
      else                              { scoreLabel = 'A/S'; scoreColor = LIVE; scoreBg = 'rgba(152,205,2,0.10)' }
    }
  }

  // Subline: Course nur wenn er sich vom Turniernamen unterscheidet (sonst doppelt).
  const courseLine = m.course?.name && m.course.name !== m.tournament?.name ? m.course.name : ''
  const subline = isActive
    ? `Loch ${holes.length}${courseLine ? ' · ' + courseLine : ''}`
    : isFinished
      ? `Beendet${courseLine ? ' · ' + courseLine : ''}`
      : courseLine

  const cupName  = m.tournament?.name || ''
  const cupDate  = fmtCupDate(m.tournament?.date)
  const cupAccent = cupColor(m.tournament?.id)

  return (
    <div className="w-full relative" style={{ borderBottom: divider ? '1px solid #19362a' : 'none' }}>
      {/* Turnier-Farbstreifen links, damit Karten verschiedener Cups visuell distinct sind */}
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

      {/* Turnier-Zeile: Name + Datum prominent, damit Cups klar identifizierbar */}
      {cupName && (
        <div className="flex items-center justify-between px-4 pt-3 pb-1.5 gap-2">
          <span className="flex items-center gap-2 min-w-0 flex-1">
            <span aria-hidden className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cupAccent }} />
            <span className="font-bold text-[13px] truncate text-ink">{cupName}</span>
          </span>
          {cupDate && (
            <span className="text-[10px] font-semibold tracking-wider uppercase text-inkDim tabular-nums flex-shrink-0">
              {cupDate}
            </span>
          )}
        </div>
      )}

      {/* Type meta */}
      <div className="flex items-center justify-between px-4 pb-1">
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
          <p className="text-[10px] font-semibold tracking-wider uppercase mt-0.5 truncate" style={{ color: 'rgba(96,165,250,0.55)' }}>
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
          <p className="text-[10px] font-semibold tracking-wider uppercase mt-0.5 truncate" style={{ color: 'rgba(251,113,133,0.55)' }}>
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
