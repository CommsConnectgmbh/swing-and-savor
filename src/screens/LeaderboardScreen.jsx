import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import LoadingSpinner from '../components/LoadingSpinner'

const FILTERS = [
  { key: 'world',   label: 'Welt'    },
  { key: 'friends', label: 'Freunde' },
]

export default function LeaderboardScreen() {
  const { user } = useAuth()
  const [filter, setFilter]   = useState('world')
  const [loading, setLoading] = useState(true)
  const [rows, setRows]       = useState([])
  const [me, setMe]           = useState(null)

  useEffect(() => { load() /* eslint-disable-next-line */ }, [filter, user?.id])

  async function load() {
    setLoading(true)
    let q = supabase.from('leaderboard_global')
      .select('id,handle,display_name,avatar_url,elo_rating,games_played,wins,country_code')

    if (filter === 'friends' && user?.id) {
      const { data: fs } = await supabase.from('friendships')
        .select('user_a,user_b').eq('status', 'accepted')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      const friendIds = new Set()
      for (const f of (fs || [])) friendIds.add(f.user_a === user.id ? f.user_b : f.user_a)
      friendIds.add(user.id)
      if (friendIds.size === 0) { setRows([]); setLoading(false); return }
      q = q.in('id', [...friendIds])
    }

    const { data } = await q.limit(200)
    setRows(data || [])

    if (user?.id) {
      const { data: myProf } = await supabase.from('profiles')
        .select('id,handle,display_name,avatar_url,elo_rating,games_played,wins')
        .eq('id', user.id).maybeSingle()
      setMe(myProf || null)
    }
    setLoading(false)
  }

  const myRank = me ? rows.findIndex(r => r.id === me.id) + 1 : 0

  return (
    <div className="max-w-lg mx-auto animate-fade-up">
      {/* Editorial Header */}
      <div className="px-5 pt-8 pb-5">
        <p className="text-[10px] tracking-[0.42em] uppercase text-accent mb-3">The Order</p>
        <h1 className="font-display text-ink leading-none"
            style={{ fontSize: 'clamp(36px, 8vw, 52px)', fontWeight: 500, letterSpacing: '-0.02em' }}>
          Leaderboard
        </h1>
        <p className="text-[12px] text-inkMuted mt-3 tracking-[0.16em] uppercase">
          ELO · Match Play · Higher = better
        </p>
      </div>

      <div className="hairline-b" />

      {/* Filter */}
      <div className="px-5 py-4 flex gap-2">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 text-[10px] tracking-[0.24em] uppercase transition-all ${
              filter === f.key
                ? 'bg-accent text-bg'
                : 'hairline text-inkMuted'
            }`}>{f.label}</button>
        ))}
      </div>

      {/* My standing — editorial hairline */}
      {me && (
        <div className="mx-5 mb-5 hairline p-4 bg-surface/40 flex items-center gap-3">
          <div className="text-center min-w-[44px]">
            <p className="text-[9px] tracking-[0.32em] uppercase text-inkDim">Rank</p>
            <p className="font-display text-accent tabular-nums leading-none mt-1"
               style={{ fontSize: 28, fontWeight: 500 }}>
              {myRank > 0 ? myRank : '—'}
            </p>
          </div>
          <RankAvatar profile={me} />
          <div className="flex-1 min-w-0">
            <p className="text-ink text-[15px] truncate">{me.display_name}</p>
            <p className="text-[11px] text-inkDim truncate tracking-wide">
              {me.games_played} · {me.wins} wins
            </p>
          </div>
          <p className="font-display text-ink tabular-nums" style={{ fontSize: 26, fontWeight: 500 }}>{me.elo_rating}</p>
        </div>
      )}

      {/* Liste */}
      {loading ? <LoadingSpinner /> : rows.length === 0 ? (
        <div className="mx-5 hairline bg-surface/40 text-center py-14 px-6">
          <p className="font-display text-ink text-[22px]" style={{ fontWeight: 500, letterSpacing: '-0.01em' }}>
            No order yet.
          </p>
          <p className="text-[12px] text-inkMuted mt-2 tracking-wide">
            Spiele ein Match — sobald es beendet ist, kommen ELO-Punkte rein.
          </p>
        </div>
      ) : (
        <div className="mx-5 hairline bg-surface/40 overflow-hidden">
          {rows.map((r, idx) => {
            const rank = idx + 1
            const isMe = r.id === user?.id
            const rankColor = rank === 1 ? '#D9C9A8' : rank === 2 ? '#C7C0B5' : rank === 3 ? '#A8956A' : '#5C5851'
            return (
              <Link key={r.id} to={`/u/${r.handle}`}
                className="flex items-center gap-3 px-4 py-3.5 active:bg-bg/40 transition-colors"
                style={{ borderBottom: idx < rows.length - 1 ? '1px solid rgba(244,241,234,0.06)' : 'none',
                         background: isMe ? 'rgba(217,201,168,0.06)' : 'transparent' }}>
                <span className="font-display tabular-nums leading-none min-w-[28px] text-center"
                  style={{ color: rankColor, fontSize: 20, fontWeight: 500 }}>{rank}</span>
                <RankAvatar profile={r} />
                <div className="flex-1 min-w-0">
                  <p className="text-ink text-[14px] truncate">{r.display_name}</p>
                  <p className="text-[11px] text-inkDim truncate tracking-wide">@{r.handle} · {r.games_played} · {r.wins} wins</p>
                </div>
                <p className="font-display text-ink tabular-nums" style={{ fontSize: 20, fontWeight: 500 }}>{r.elo_rating}</p>
              </Link>
            )
          })}
        </div>
      )}
      <div className="h-24" />
    </div>
  )
}

function RankAvatar({ profile }) {
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover bg-bg flex-shrink-0"
                style={{ border: '1px solid rgba(244,241,234,0.12)' }} />
  }
  const letter = (profile?.display_name || profile?.handle || '?')[0]?.toUpperCase() || '?'
  return (
    <div className="w-9 h-9 rounded-full flex items-center justify-center bg-surface flex-shrink-0"
         style={{ border: '1px solid rgba(217,201,168,0.32)' }}>
      <span className="font-display text-accent" style={{ fontSize: 13, fontWeight: 500 }}>{letter}</span>
    </div>
  )
}
