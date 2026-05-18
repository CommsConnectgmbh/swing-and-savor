import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

function MessageIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
    </svg>
  )
}

function LeaderboardIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 21h8M12 17v4M5 4h14v6a7 7 0 01-14 0V4zM3 4h2v3a3 3 0 01-3 3M21 4h-2v3a3 3 0 003 3"/>
    </svg>
  )
}

// Logo + editorial hairline wordmark
function Wordmark() {
  return (
    <Link to="/home" aria-label="Swing & Savor" className="flex items-center gap-2.5 select-none">
      <img
        src="/logo.png"
        alt=""
        aria-hidden="true"
        width="32"
        height="32"
        className="rounded-lg flex-shrink-0"
        style={{ boxShadow: 'inset 0 0 0 1px rgba(217,201,168,0.18)' }}
      />
      <span className="hidden sm:flex flex-col leading-none">
        <span className="font-display text-ink text-[15px] tracking-tight" style={{ fontWeight: 600 }}>
          Swing<span style={{ color: '#D9C9A8' }}> &amp; </span>Savor
        </span>
        <span className="text-[8px] text-inkMuted uppercase tracking-[0.36em] mt-0.5">
          The Clubhouse
        </span>
      </span>
    </Link>
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
      className="sticky top-0 z-40 flex items-center gap-3 px-4 py-3 hairline-b"
      style={{
        backgroundColor: '#0A1A12',
        paddingTop: 'calc(env(safe-area-inset-top) + 0.5rem)',
      }}
    >
      <Wordmark />
      {title ? (
        <>
          <span className="h-3 w-px bg-[rgba(244,241,234,0.18)]" aria-hidden="true" />
          <span className="font-sans font-medium text-[12px] text-inkMuted tracking-[0.22em] uppercase">
            {title}
          </span>
        </>
      ) : null}
      <div className="ml-auto flex items-center gap-1">
        <Link to="/leaderboard" aria-label="Leaderboard"
          className="p-2 rounded-xl text-inkMuted hover:text-accent active:scale-95 transition">
          <LeaderboardIcon />
        </Link>
        <Link to="/messages" aria-label="Nachrichten"
          className="relative p-2 rounded-xl text-inkMuted hover:text-accent active:scale-95 transition">
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
