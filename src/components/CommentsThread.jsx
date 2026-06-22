import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { subscribeToTables } from '../lib/realtime'
import { useAuth } from '../lib/auth'
import { listComments, postComment, deleteComment, reportComment } from '../lib/social'
import { relTime } from '../lib/format'
import { fetchProfileMap } from '../lib/profiles'
import { profileInitial } from '../lib/names'

export default function CommentsThread({ matchId }) {
  const { user } = useAuth()
  const [comments, setComments] = useState([])
  const [profiles, setProfiles] = useState({})
  const [body, setBody]         = useState('')
  const [posting, setPosting]   = useState(false)
  const [reporting, setReporting] = useState(null)
  const channelRef = useRef(null)

  useEffect(() => {
    if (!matchId) return
    load()
    subscribe()
    return () => { channelRef.current?.() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId])

  async function load() {
    const list = await listComments(matchId)
    setComments(list)
    const ids = list.map(c => c.user_id)
    if (ids.length) {
      setProfiles(await fetchProfileMap(ids, 'id,handle,display_name,avatar_url'))
    }
  }

  function subscribe() {
    channelRef.current?.()
    channelRef.current = subscribeToTables(`comments-${matchId}`, [
      { table: 'match_comments', event: 'INSERT', filter: `match_id=eq.${matchId}`, handler: () => load() },
      { table: 'match_comments', event: 'DELETE', filter: `match_id=eq.${matchId}`, handler: () => load() },
    ])
  }

  async function handlePost(e) {
    e?.preventDefault?.()
    if (!user) return
    const text = body.trim()
    if (!text || posting) return
    setPosting(true)
    const c = await postComment(matchId, user.id, text)
    if (c) setComments(prev => [...prev, c])
    setBody('')
    setPosting(false)
  }

  async function handleDelete(id) {
    await deleteComment(id)
    setComments(prev => prev.filter(c => c.id !== id))
  }

  async function handleReport(id) {
    setReporting(id)
    await reportComment(id)
    setReporting(null)
  }

  return (
    <div className="mx-3 mt-4 rounded-card bg-surface border border-line overflow-hidden">
      <div className="px-4 py-2.5 text-[10px] font-bold tracking-[0.25em] uppercase text-inkMuted border-b border-lineSoft flex items-center justify-between">
        <span>Kommentare <span className="opacity-50 tabular-nums">{comments.length}</span></span>
      </div>

      {comments.length === 0 && (
        <p className="px-4 py-6 text-xs text-inkDim text-center">Noch keine Kommentare. Sei der Erste.</p>
      )}

      <div className="divide-y divide-lineSoft">
        {comments.map(c => {
          const p = profiles[c.user_id]
          const mine = c.user_id === user?.id
          return (
            <div key={c.id} className="px-4 py-3 flex gap-3">
              <Link to={p?.handle ? `/u/${p.handle}` : '#'}
                className="w-8 h-8 rounded-full flex-shrink-0 overflow-hidden bg-accent/15 border border-accent/30 flex items-center justify-center">
                {p?.avatar_url
                  ? <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <span className="font-condensed font-black text-sm text-accent">
                      {profileInitial(p)}
                    </span>}
              </Link>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Link to={p?.handle ? `/u/${p.handle}` : '#'}
                    className="font-bold text-xs text-ink truncate">{p?.display_name || p?.handle || '—'}</Link>
                  <span className="text-[10px] text-inkDim">@{p?.handle}</span>
                  <span className="text-[10px] text-inkDim ml-auto tabular-nums">{relTime(c.created_at)}</span>
                </div>
                <p className="text-sm text-ink mt-0.5 leading-snug whitespace-pre-wrap break-words">{c.body}</p>
                <div className="flex gap-3 mt-1.5">
                  {mine ? (
                    <button onClick={() => handleDelete(c.id)}
                      className="text-[10px] text-inkDim hover:text-danger">Löschen</button>
                  ) : (
                    <button onClick={() => handleReport(c.id)} disabled={reporting === c.id}
                      className="text-[10px] text-inkDim hover:text-danger">
                      {reporting === c.id ? 'Melde…' : 'Melden'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {user && (
        <form onSubmit={handlePost} className="px-3 py-3 border-t border-lineSoft flex gap-2">
          <input type="text" value={body} maxLength={800}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Kommentar schreiben…"
            className="flex-1 bg-bg border border-line rounded-full px-4 py-2 text-sm text-ink focus:border-accent/60" />
          <button type="submit" disabled={posting || !body.trim()}
            className="px-3.5 py-2 rounded-full text-xs font-bold bg-accent text-brandDark active:scale-95 transition-transform disabled:opacity-40">
            Senden
          </button>
        </form>
      )}
    </div>
  )
}

