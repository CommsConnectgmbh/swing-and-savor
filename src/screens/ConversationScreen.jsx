import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import LoadingSpinner from '../components/LoadingSpinner'

export default function ConversationScreen() {
  const { conversationId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [conv, setConv]       = useState(null)
  const [other, setOther]     = useState(null)
  const [messages, setMessages] = useState([])
  const [body, setBody]       = useState('')
  const [sending, setSending] = useState(false)
  const channelRef = useRef(null)
  const bottomRef = useRef(null)

  useEffect(() => {
    if (!user?.id || !conversationId) return
    load()
    subscribe()
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, conversationId])

  useEffect(() => {
    // nach Render unten anker
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  async function load() {
    setLoading(true)
    const { data: c } = await supabase.from('conversations')
      .select('id,user_a,user_b').eq('id', conversationId).maybeSingle()
    if (!c) { setLoading(false); return }
    setConv(c)
    const otherId = c.user_a === user.id ? c.user_b : c.user_a
    const { data: p } = await supabase.from('profiles')
      .select('id,handle,display_name,avatar_url').eq('id', otherId).maybeSingle()
    setOther(p)

    const { data: msgs } = await supabase.from('messages')
      .select('id,sender_id,body,created_at,read_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(200)
    setMessages(msgs || [])
    setLoading(false)

    // Empfangene ungelesene Messages als read markieren
    await supabase.from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .neq('sender_id', user.id)
      .is('read_at', null)
  }

  function subscribe() {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    const ch = supabase.channel(`conv-${conversationId}`)
      .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
          (payload) => {
            const newMsg = payload.new
            setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
            if (newMsg.sender_id !== user.id) {
              supabase.from('messages').update({ read_at: new Date().toISOString() }).eq('id', newMsg.id)
            }
          })
      .subscribe()
    channelRef.current = ch
  }

  async function send(e) {
    e?.preventDefault?.()
    const text = body.trim()
    if (!text || sending) return
    setSending(true)
    const { data } = await supabase.from('messages').insert({
      conversation_id: conversationId, sender_id: user.id, body: text,
    }).select('id,sender_id,body,created_at,read_at').single()
    if (data) setMessages(prev => prev.some(m => m.id === data.id) ? prev : [...prev, data])
    setBody('')
    setSending(false)
  }

  if (loading) return <LoadingSpinner />
  if (!conv) return (
    <div className="p-6 text-center text-inkMuted text-sm">
      Konversation nicht gefunden.
      <div className="mt-3"><button onClick={() => navigate('/messages')} className="text-accent text-xs font-bold">← Zurück</button></div>
    </div>
  )

  return (
    <div className="max-w-lg mx-auto flex flex-col" style={{ minHeight: 'calc(100vh - 4rem)' }}>

      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-center gap-3 border-b border-lineSoft">
        <button onClick={() => navigate('/messages')}
          className="p-1 -ml-1 flex-shrink-0 text-inkMuted active:scale-90 transition-transform">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        {other?.avatar_url
          ? <img src={other.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
          : <div className="w-9 h-9 rounded-full bg-accent/15 border border-accent/40 flex items-center justify-center">
              <span className="font-condensed font-black text-sm text-accent">
                {(other?.display_name || other?.handle || '?')[0]?.toUpperCase()}
              </span>
            </div>
        }
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-ink truncate">{other?.display_name}</p>
          <p className="text-[11px] text-inkDim truncate">@{other?.handle}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-1.5 pb-32">
        {messages.length === 0 && (
          <div className="text-center py-10 text-xs text-inkDim">Sag „Servus" zu @{other?.handle}.</div>
        )}
        {messages.map(m => {
          const mine = m.sender_id === user.id
          return (
            <div key={m.id} className={`max-w-[78%] px-3 py-2 rounded-2xl ${
              mine
                ? 'self-end bg-accent text-brandDark rounded-br-md'
                : 'self-start bg-surface border border-line text-ink rounded-bl-md'
            }`}>
              <p className="text-sm leading-snug whitespace-pre-wrap break-words">{m.body}</p>
              <p className={`text-[9px] mt-0.5 tabular-nums ${mine ? 'text-brandDark/60 text-right' : 'text-inkDim'}`}>
                {new Date(m.created_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={send}
        className="fixed inset-x-0 max-w-lg mx-auto bg-surface/96 backdrop-blur-md border-t border-line p-2 flex gap-2"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 0px)' }}>
        <input type="text" value={body} maxLength={2000}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Nachricht…"
          className="flex-1 bg-bg border border-line rounded-full px-4 py-2.5 text-sm text-ink focus:border-accent/60" />
        <button type="submit" disabled={sending || !body.trim()}
          className="px-4 py-2.5 rounded-full text-sm font-bold tracking-wide bg-accent text-brandDark active:scale-95 transition-transform disabled:opacity-40">
          Senden
        </button>
      </form>
    </div>
  )
}
