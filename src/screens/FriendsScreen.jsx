import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { subscribeToTables } from '../lib/realtime'
import { useAuth } from '../lib/auth'
import { challengeFriendOnDealBuddy } from '../lib/dealbuddy'
import { pushToast } from '../lib/toast'
import LoadingSpinner from '../components/LoadingSpinner'

export default function FriendsScreen() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('friends') // friends | incoming | search
  const [friends, setFriends] = useState([])
  const [incoming, setIncoming] = useState([])
  const [outgoing, setOutgoing] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const channelRef = useRef(null)

  useEffect(() => {
    if (!user) return
    load()
    // Live aktualisieren, wenn die Gegenseite annimmt/anfragt/entfreundet.
    channelRef.current?.()
    channelRef.current = subscribeToTables(`friendships-${user.id}`, [
      { table: 'friendships', handler: (payload) => {
        const row = payload.new ?? payload.old
        if (row && (row.user_a === user.id || row.user_b === user.id)) load()
      } },
    ])
    return () => { channelRef.current?.() }
  }, [user])

  async function load() {
    setLoading(true)
    const { data: rows } = await supabase.from('friendships').select('*')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)

    const accepted = rows?.filter(r => r.status === 'accepted') ?? []
    const pending  = rows?.filter(r => r.status === 'pending')  ?? []

    const friendIds  = accepted.map(r => r.user_a === user.id ? r.user_b : r.user_a)
    const incomingPending = pending.filter(r => r.requested_by !== user.id)
    const outgoingPending = pending.filter(r => r.requested_by === user.id)
    const incIds = incomingPending.map(r => r.user_a === user.id ? r.user_b : r.user_a)
    const outIds = outgoingPending.map(r => r.user_a === user.id ? r.user_b : r.user_a)

    const allIds = [...friendIds, ...incIds, ...outIds]
    const { data: profs } = allIds.length
      ? await supabase.from('profiles').select('id, handle, display_name, hcp, home_club, avatar_url').in('id', allIds)
      : { data: [] }
    const byId = Object.fromEntries((profs ?? []).map(p => [p.id, p]))

    setFriends(friendIds.map(id => byId[id]).filter(Boolean))
    setIncoming(incIds.map(id => byId[id]).filter(Boolean))
    setOutgoing(outIds.map(id => byId[id]).filter(Boolean))
    setLoading(false)
  }

  async function search(q) {
    setQuery(q)
    if (q.length < 2) { setSearchResults([]); return }
    setSearching(true)
    const term = q.toLowerCase().replace(/^@/, '')
    const { data } = await supabase.from('profiles')
      .select('id, handle, display_name, hcp, home_club, avatar_url')
      .or(`handle.ilike.${term}%,display_name.ilike.%${term}%`)
      .neq('id', user.id)
      .limit(20)
    setSearchResults(data ?? [])
    setSearching(false)
  }

  async function accept(other) {
    const a = user.id < other.id ? user.id : other.id
    const b = user.id < other.id ? other.id : user.id
    await supabase.from('friendships')
      .update({ status: 'accepted', responded_at: new Date().toISOString() })
      .eq('user_a', a).eq('user_b', b)
    await load()
  }

  async function decline(other) {
    const a = user.id < other.id ? user.id : other.id
    const b = user.id < other.id ? other.id : user.id
    await supabase.from('friendships').delete().eq('user_a', a).eq('user_b', b)
    await load()
  }

  async function sendRequest(other) {
    const a = user.id < other.id ? user.id : other.id
    const b = user.id < other.id ? other.id : user.id
    const { error } = await supabase.from('friendships').insert({
      user_a: a, user_b: b, requested_by: user.id, status: 'pending',
    })
    if (error) {
      // 23505 = die Gegenseite hat dich bereits angefragt → direkt annehmen.
      if (error.code === '23505') { await accept(other); setTab('friends') }
      else pushToast({ icon: '⚠️', title: 'Anfrage fehlgeschlagen', body: 'Bitte später erneut versuchen.' })
      return
    }
    await load()
  }

  if (!profile) return null
  if (loading) return <LoadingSpinner />

  const incomingCount = incoming.length

  return (
    <div className="max-w-lg mx-auto animate-fade-up">
      <div className="px-4 pt-6 pb-4">
        <h1 className="font-condensed text-3xl font-bold tracking-wide text-ink">Freunde</h1>
      </div>

      {/* Tabs */}
      <div className="px-3 mb-3 flex gap-2">
        <TabBtn label="Freunde" count={friends.length} active={tab === 'friends'} onClick={() => setTab('friends')} />
        <TabBtn label="Anfragen" count={incomingCount} active={tab === 'incoming'} onClick={() => setTab('incoming')} highlight={incomingCount > 0} />
        <TabBtn label="Suchen" active={tab === 'search'} onClick={() => setTab('search')} />
      </div>

      {tab === 'search' && (
        <div className="px-3 mb-3">
          <input
            type="text" autoCapitalize="none" autoCorrect="off" autoFocus
            placeholder="Name oder @handle"
            className="w-full bg-surface border border-line rounded-xl px-4 py-3 text-ink placeholder:text-inkDim text-sm focus:border-accent/60"
            value={query} onChange={e => search(e.target.value)}
          />
          {searching && <p className="text-xs text-inkDim text-center mt-3">Suche…</p>}
          {!searching && query.length >= 2 && searchResults.length === 0 && (
            <p className="text-xs text-inkDim text-center mt-6">Niemanden gefunden</p>
          )}
        </div>
      )}

      {/* List */}
      <div className="border-t border-lineSoft">
        {tab === 'friends' && friends.map((p, idx) => (
          <FriendRow key={p.id} profile={p} idx={idx}
            rightSlot={
              <>
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); navigate(`/challenges?opponent=${p.id}`) }}
                  title="In-App Duell starten"
                  className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md bg-accent text-brandDark active:scale-95 transition-transform">
                  Duell
                </button>
                <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); challengeFriendOnDealBuddy(p) }}
                  title="Auf DealBuddy herausfordern"
                  className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md bg-surface text-inkMuted border border-line active:scale-95 transition-transform">
                  💰
                </button>
              </>
            } />
        ))}
        {tab === 'friends' && friends.length === 0 && (
          <EmptyState
            title="Noch keine Freunde"
            hint={<>Such über <button onClick={() => setTab('search')} className="text-accent font-semibold">Suchen</button> jemanden und schick eine Anfrage.</>}
          />
        )}

        {tab === 'incoming' && incoming.map((p, idx) => (
          <FriendRow key={p.id} profile={p} idx={idx}
            rightSlot={
              <>
                <button onClick={() => accept(p)}
                  className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md bg-accent text-brandDark active:scale-95 transition-transform">
                  Annehmen
                </button>
                <button onClick={() => decline(p)}
                  className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md bg-surface text-inkMuted border border-line active:scale-95 transition-transform">
                  Ablehnen
                </button>
              </>
            } />
        ))}
        {tab === 'incoming' && incoming.length === 0 && (
          <EmptyState title="Keine offenen Anfragen" hint="Wenn dich jemand befreundet, siehst du es hier." />
        )}

        {tab === 'search' && searchResults.map((p, idx) => {
          const alreadyFriend  = friends.some(f => f.id === p.id)
          const alreadyPending = outgoing.some(o => o.id === p.id) || incoming.some(i => i.id === p.id)
          return (
            <FriendRow key={p.id} profile={p} idx={idx}
              rightSlot={
                alreadyFriend ? (
                  <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md text-accent bg-accent/12 border border-accent/30">
                    ✓ Freund
                  </span>
                ) : alreadyPending ? (
                  <span className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md text-inkMuted bg-surface border border-line">
                    Wartet
                  </span>
                ) : (
                  <button onClick={() => sendRequest(p)}
                    className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-md bg-accent text-brandDark active:scale-95 transition-transform">
                    + Anfragen
                  </button>
                )
              } />
          )
        })}
      </div>

      <div className="h-6" />
    </div>
  )
}

function TabBtn({ label, count, active, highlight, onClick }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-2 rounded-lg text-xs font-bold tracking-wide active:scale-[0.96] transition-all flex items-center gap-1.5 ${
        active
          ? 'bg-accent text-brandDark'
          : 'bg-surface text-inkMuted border border-line'
      }`}>
      {label}
      {count !== undefined && count > 0 && (
        <span className={`text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-full ${
          active ? 'bg-brandDark/20 text-brandDark' : highlight ? 'bg-accent/30 text-accent' : 'bg-line text-inkMuted'
        }`}>
          {count}
        </span>
      )}
    </button>
  )
}

function FriendRow({ profile, idx, rightSlot }) {
  return (
    <Link to={`/u/${profile.handle}`}
      className="flex items-center gap-3 px-4 py-3.5 border-b border-lineSoft active:bg-surface/40 transition-colors"
      style={{ animationDelay: `${idx * 25}ms` }}>
      <div className="w-10 h-10 rounded-full bg-accent/15 border border-accent/30 overflow-hidden flex items-center justify-center flex-shrink-0">
        {profile.avatar_url ? (
          <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="font-condensed font-black text-base text-accent">
            {profile.display_name?.[0]?.toUpperCase() ?? '?'}
          </span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-ink truncate">{profile.display_name}</p>
        <p className="text-xs text-inkMuted truncate">
          @{profile.handle}
          {profile.hcp !== null && profile.hcp !== undefined && <span className="tabular-nums"> · HC {Number(profile.hcp).toFixed(1)}</span>}
        </p>
      </div>
      {rightSlot && <div className="flex items-center gap-2 flex-shrink-0">{rightSlot}</div>}
    </Link>
  )
}

function EmptyState({ title, hint }) {
  return (
    <div className="text-center py-16 px-6">
      <p className="text-sm text-inkMuted">{title}</p>
      <p className="text-xs mt-1 text-inkDim">{hint}</p>
    </div>
  )
}
