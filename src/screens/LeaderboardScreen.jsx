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
      <div className="px-4 pt-6 pb-3">
        <h1 className="font-condensed text-3xl font-bold tracking-wide text-ink">Rangliste</h1>
        <p className="text-xs text-inkMuted mt-0.5">
          ELO nach Match Play Duellen — höher = besser.
        </p>
      </div>

      {/* Filter */}
      <div className="px-3 mb-3 flex gap-1.5">
        {FILTERS.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-wide active:scale-95 transition-all ${
              filter === f.key
                ? 'bg-accent text-brandDark'
                : 'bg-surface text-inkMuted border border-line'
            }`}>{f.label}</button>
        ))}
      </div>

      {/* Mein Stand */}
      {me && (
        <div className="mx-3 mb-3 rounded-card p-3 bg-surface border border-line flex items-center gap-3">
          <div className="text-center min-w-[44px]">
            <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-inkDim">Rang</p>
            <p className="font-condensed font-black text-2xl text-accent tabular-nums leading-none">
              {myRank > 0 ? myRank : '—'}
            </p>
          </div>
          <RankAvatar profile={me} />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-ink truncate">{me.display_name}</p>
            <p className="text-[11px] text-inkMuted truncate">
              {me.games_played} {me.games_played === 1 ? 'Match' : 'Matches'} · {me.wins} Siege
            </p>
          </div>
          <p className="font-condensed font-black text-2xl text-ink tabular-nums">{me.elo_rating}</p>
        </div>
      )}

      {/* Liste */}
      {loading ? <LoadingSpinner /> : rows.length === 0 ? (
        <div className="mx-3 rounded-card bg-surface border border-line text-center py-14 px-6">
          <p className="font-bold text-sm text-ink">Noch keine Rangliste</p>
          <p className="text-xs text-inkMuted mt-1">
            Spiele ein Duell mit Freunden — sobald es beendet ist, kommen ELO-Punkte rein.
          </p>
        </div>
      ) : (
        <div className="mx-3 rounded-card overflow-hidden bg-surface border border-line">
          {rows.map((r, idx) => {
            const rank = idx + 1
            const isMe = r.id === user?.id
            const rankColor = rank === 1 ? '#FFD24D' : rank === 2 ? '#C7CDD3' : rank === 3 ? '#CD7F32' : '#a8b5ad'
            return (
              <Link key={r.id} to={`/u/${r.handle}`}
                className="flex items-center gap-3 px-4 py-3 active:bg-bg/40 transition-colors"
                style={{ borderBottom: idx < rows.length - 1 ? '1px solid #19362a' : 'none',
                         background: isMe ? 'rgba(152,205,2,0.06)' : 'transparent' }}>
                <span className="font-condensed font-black text-lg tabular-nums leading-none min-w-[26px] text-center"
                  style={{ color: rankColor }}>{rank}</span>
                <RankAvatar profile={r} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-ink truncate">{r.display_name}</p>
                  <p className="text-[11px] text-inkDim truncate">@{r.handle} · {r.games_played} M · {r.wins} S</p>
                </div>
                <p className="font-condensed font-black text-xl text-ink tabular-nums">{r.elo_rating}</p>
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
    return <img src={profile.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover bg-bg flex-shrink-0" />
  }
  const letter = (profile?.display_name || profile?.handle || '?')[0]?.toUpperCase() || '?'
  return (
    <div className="w-9 h-9 rounded-full flex items-center justify-center bg-accent/15 border border-accent/40 flex-shrink-0">
      <span className="font-condensed font-black text-sm text-accent">{letter}</span>
    </div>
  )
}
