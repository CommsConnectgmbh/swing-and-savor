import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

function MessageIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
    </svg>
  )
}

function LeaderboardIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8M12 17v4M5 4h14v6a7 7 0 01-14 0V4zM3 4h2v3a3 3 0 01-3 3M21 4h-2v3a3 3 0 003 3"/>
    </svg>
  )
}

export default function BrandHeader({ title }) {
  const { user } = useAuth()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    let ch = null

    async function loadUnread() {
      // Conversations für den User holen, dann ungelesene fremde Messages zählen
      const { data: convs } = await supabase.from('conversations')
        .select('id').or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
      const ids = (convs || []).map(c => c.id)
      if (ids.length === 0) { if (!cancelled) setUnread(0); return }
      const { count } = await supabase.from('messages')
        .select('id', { count: 'exact', head: true })
        .in('conversation_id', ids)
        .neq('sender_id', user.id)
        .is('read_at', null)
      if (!cancelled) setUnread(count || 0)
    }

    loadUnread()
    ch = supabase.channel(`unread-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, loadUnread)
      .subscribe()

    return () => {
      cancelled = true
      if (ch) supabase.removeChannel(ch)
    }
  }, [user?.id])

  return (
    <header
      className="sticky top-0 z-40 flex items-center gap-3 px-4 py-3 bg-bg/95 backdrop-blur-md"
      style={{
        borderBottom: '1px solid rgba(152,205,2,0.14)',
        paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)',
      }}
    >
      <img
        src="/logo.png"
        alt="Swing & Savor"
        width="40"
        height="40"
        className="rounded-xl flex-shrink-0"
      />
      {title ? (
        <span className="font-condensed font-bold text-lg text-ink tracking-[0.16em] uppercase">
          {title}
        </span>
      ) : null}
      <div className="ml-auto flex items-center gap-1">
        <Link to="/leaderboard" aria-label="Rangliste"
          className="p-2 rounded-xl text-inkMuted hover:text-ink active:scale-95 transition-transform">
          <LeaderboardIcon />
        </Link>
        <Link to="/messages" aria-label="Nachrichten"
          className="relative p-2 rounded-xl text-inkMuted hover:text-ink active:scale-95 transition-transform">
          <MessageIcon />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-brandDark text-[10px] font-black tabular-nums flex items-center justify-center">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Link>
      </div>
    </header>
  )
}
