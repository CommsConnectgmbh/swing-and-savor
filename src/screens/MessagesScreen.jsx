import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { subscribeToTables } from '../lib/realtime'
import { useAuth } from '../lib/auth'
import { relTime } from '../lib/format'
import { indexById, fetchProfileList } from '../lib/profiles'
import { profileInitial } from '../lib/names'
import LoadingSpinner from '../components/LoadingSpinner'

export default function MessagesScreen() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading]   = useState(true)
  const [items, setItems]       = useState([])
  const channelRef = useRef(null)

  useEffect(() => {
    if (!user?.id) return
    load()
    subscribe()
    return () => { channelRef.current?.() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function load() {
    setLoading(true)
    const { data: convs } = await supabase.from('conversations')
      .select('id,user_a,user_b,last_message_at')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      .order('last_message_at', { ascending: false })
      .limit(60)

    const list = convs || []
    if (list.length === 0) { setItems([]); setLoading(false); return }

    // Andere User + letzte Message + Unread-Count je Conversation
    const otherIds = list.map(c => c.user_a === user.id ? c.user_b : c.user_a)
    const ids = list.map(c => c.id)

    const [profs, { data: lastMsgs }, { data: unreadRows }] = await Promise.all([
      fetchProfileList(otherIds, 'id,handle,display_name,avatar_url'),
      supabase.from('messages').select('conversation_id,body,sender_id,created_at,read_at')
        .in('conversation_id', ids).order('created_at', { ascending: false }),
      supabase.from('messages').select('conversation_id')
        .in('conversation_id', ids).neq('sender_id', user.id).is('read_at', null),
    ])

    const profById = indexById(profs)
    const lastByConv = {}
    for (const m of (lastMsgs || [])) {
      if (!lastByConv[m.conversation_id]) lastByConv[m.conversation_id] = m
    }
    const unreadByConv = {}
    for (const r of (unreadRows || [])) {
      unreadByConv[r.conversation_id] = (unreadByConv[r.conversation_id] || 0) + 1
    }

    setItems(list.map(c => {
      const otherId = c.user_a === user.id ? c.user_b : c.user_a
      return {
        id: c.id,
        other: profById[otherId] || { id: otherId, display_name: '—', handle: '' },
        lastMsg: lastByConv[c.id] || null,
        unread: unreadByConv[c.id] || 0,
        last_message_at: c.last_message_at,
      }
    }))
    setLoading(false)
  }

  function subscribe() {
    channelRef.current?.()
    channelRef.current = subscribeToTables('messages-list', [
      { table: 'messages', handler: () => load() },
      { table: 'conversations', handler: () => load() },
    ])
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="max-w-lg mx-auto animate-fade-up">
      <div className="px-4 pt-6 pb-3">
        <h1 className="font-condensed text-3xl font-bold tracking-wide text-ink">Nachrichten</h1>
        <p className="text-xs text-inkMuted mt-0.5">Direkt mit Freunden chatten.</p>
      </div>

      {items.length === 0 ? (
        <div className="mx-3 rounded-card bg-surface border border-line text-center py-14 px-6">
          <p className="font-bold text-sm text-ink">Noch keine Nachrichten</p>
          <p className="text-xs text-inkMuted mt-1">
            Öffne ein Freundprofil und tippe „Nachricht" zum Starten.
          </p>
          <button onClick={() => navigate('/friends')}
            className="mt-4 px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide bg-accent text-brandDark active:scale-[0.97] transition-transform">
            Freunde
          </button>
        </div>
      ) : (
        <div className="mx-3 rounded-card overflow-hidden bg-surface border border-line">
          {items.map((it, idx) => (
            <button key={it.id}
              onClick={() => navigate(`/messages/${it.id}`)}
              className="w-full text-left px-4 py-3.5 flex items-center gap-3 active:bg-bg/40 transition-colors"
              style={{ borderBottom: idx < items.length - 1 ? '1px solid #15302A' : 'none' }}>
              <Avatar profile={it.other} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-sm text-ink truncate">{it.other.display_name || it.other.handle}</p>
                  <span className="text-[10px] text-inkDim tabular-nums">{relTime(it.last_message_at)}</span>
                </div>
                <p className="text-xs text-inkMuted truncate mt-0.5">
                  {it.lastMsg
                    ? (it.lastMsg.sender_id === user.id ? 'Du: ' : '') + it.lastMsg.body
                    : 'Konversation gestartet'}
                </p>
              </div>
              {it.unread > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-accent text-brandDark text-[10px] font-black tabular-nums flex items-center justify-center">
                  {it.unread}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      <div className="h-24" />
    </div>
  )
}

function Avatar({ profile }) {
  if (profile?.avatar_url) {
    return <img src={profile.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover bg-bg flex-shrink-0" />
  }
  const letter = profileInitial(profile)
  return (
    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-accent/15 border border-accent/40 flex-shrink-0">
      <span className="font-condensed font-black text-base text-accent">{letter}</span>
    </div>
  )
}

