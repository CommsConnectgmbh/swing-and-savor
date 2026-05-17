import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { toggleLike } from '../lib/social'

function HeartIcon({ filled }) {
  return filled ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" strokeWidth="1.5">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
    </svg>
  )
}

function ChatIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/>
    </svg>
  )
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
      <polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
    </svg>
  )
}

/**
 * Inline-Reihe Like / Comment / Share unter jeder Feed-Card / im MatchDetail.
 * Optimistisches Update für Like — DB-Fehler werden lokal rückgängig gemacht.
 */
export default function SocialBar({
  matchId, likes = 0, comments = 0, liked = false,
  onCommentClick, onShareClick, onChange,
}) {
  const { user } = useAuth()
  const [busy, setBusy]   = useState(false)
  const [optimistic, setOptimistic] = useState({ liked, count: likes })

  async function handleLike(e) {
    e.stopPropagation()
    if (!user) return
    if (busy) return
    setBusy(true)
    const nextLiked = !optimistic.liked
    const nextCount = Math.max(0, optimistic.count + (nextLiked ? 1 : -1))
    setOptimistic({ liked: nextLiked, count: nextCount })
    try {
      const result = await toggleLike(matchId, user.id, optimistic.liked)
      onChange?.({ liked: result, likes: nextCount })
    } catch {
      // Revert
      setOptimistic({ liked: optimistic.liked, count: optimistic.count })
    } finally {
      setBusy(false)
    }
  }

  // Sync wenn Parent neue Werte schickt (z.B. Realtime)
  if (likes !== optimistic.count && !busy && liked === optimistic.liked) {
    setOptimistic({ liked, count: likes })
  }

  return (
    <div className="flex items-center gap-1 px-2 py-2">
      <button onClick={handleLike}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg active:scale-95 transition-transform ${
          optimistic.liked ? 'text-danger' : 'text-inkMuted hover:text-ink'
        }`}>
        <HeartIcon filled={optimistic.liked} />
        <span className="text-xs font-bold tabular-nums">{optimistic.count}</span>
      </button>

      <button onClick={(e) => { e.stopPropagation(); onCommentClick?.() }}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg active:scale-95 transition-transform text-inkMuted hover:text-ink">
        <ChatIcon />
        <span className="text-xs font-bold tabular-nums">{comments}</span>
      </button>

      <button onClick={(e) => { e.stopPropagation(); onShareClick?.() }}
        className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg active:scale-95 transition-transform text-inkMuted hover:text-accent">
        <ShareIcon />
        <span className="text-xs font-bold tracking-wide">Teilen</span>
      </button>
    </div>
  )
}
