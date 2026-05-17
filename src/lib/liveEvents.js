import { supabase } from './supabase'
import { pushToast } from './toast'

/**
 * Globale Realtime-Subscriptions, die App-weit Toasts und Push-Trigger feuern.
 * Wird einmal pro Session vom App-Root gestartet (LiveEventsBridge).
 *
 * Welche Events ploppen als Toast hoch?
 *  - Neue DM in einem Chat, an dem ich beteiligt bin (und nicht von mir)
 *  - Neuer Comment auf einem Match, das ich erstellt habe oder spiele
 *  - Neue Reaction auf so einem Match
 *  - Status-Wechsel eines Matches in einem meiner Cups auf 'active'
 *
 * Daten-Filter passieren clientseitig, RLS sorgt für Sicht-Sichtbarkeit.
 */
export function startLiveEvents(user) {
  if (!user?.id) return () => {}

  let myConvIds = new Set()
  let myMatchIds = new Set()
  let myProfilesById = {} // sender_id → handle/name
  let chMsgs = null, chRest = null, chMatches = null

  async function refreshMine() {
    const [{ data: convs }, { data: cups }] = await Promise.all([
      supabase.from('conversations').select('id')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`),
      supabase.from('tournaments').select('id').eq('owner_id', user.id),
    ])
    myConvIds = new Set((convs || []).map(c => c.id))
    if (cups?.length) {
      const { data: matches } = await supabase.from('matches')
        .select('id').in('tournament_id', cups.map(c => c.id))
      myMatchIds = new Set((matches || []).map(m => m.id))
    } else {
      myMatchIds = new Set()
    }
  }

  async function profileFor(id) {
    if (myProfilesById[id]) return myProfilesById[id]
    const { data } = await supabase.from('profiles')
      .select('id,handle,display_name').eq('id', id).maybeSingle()
    if (data) myProfilesById[id] = data
    return data
  }

  refreshMine().then(() => {
    chMsgs = supabase.channel('live-msgs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        async ({ new: msg }) => {
          if (msg.sender_id === user.id) return
          if (!myConvIds.has(msg.conversation_id)) return
          const p = await profileFor(msg.sender_id)
          pushToast({
            icon: '💬',
            title: p ? `${p.display_name}` : 'Neue Nachricht',
            body: msg.body.length > 90 ? msg.body.slice(0, 87) + '…' : msg.body,
            action: `/messages/${msg.conversation_id}`,
          })
        })
      .subscribe()

    chRest = supabase.channel('live-social')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_reactions' },
        async ({ new: r }) => {
          if (r.user_id === user.id) return
          if (!myMatchIds.has(r.match_id)) return
          const p = await profileFor(r.user_id)
          pushToast({
            icon: '❤️',
            title: p ? `${p.display_name} hat geliked` : 'Like erhalten',
            body: 'Tap um zum Match',
            action: `/matches/${r.match_id}`,
          })
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'match_comments' },
        async ({ new: c }) => {
          if (c.user_id === user.id) return
          if (!myMatchIds.has(c.match_id)) return
          const p = await profileFor(c.user_id)
          pushToast({
            icon: '💬',
            title: p ? `${p.display_name} kommentiert` : 'Neuer Kommentar',
            body: c.body.length > 90 ? c.body.slice(0, 87) + '…' : c.body,
            action: `/matches/${c.match_id}`,
          })
        })
      .subscribe()

    chMatches = supabase.channel('live-matches')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' },
        async ({ new: m, old: o }) => {
          if (!myMatchIds.has(m.id)) {
            // Cup könnte neu sein — refresh
            await refreshMine()
            if (!myMatchIds.has(m.id)) return
          }
          if (o.status !== 'active' && m.status === 'active') {
            pushToast({ icon: '⛳', title: 'Match ist live',
              body: 'Das Live-Tracking läuft.', action: `/matches/${m.id}` })
          } else if (o.status !== 'finished' && m.status === 'finished') {
            pushToast({ icon: '🏁', title: 'Match beendet',
              body: 'Ergebnis ist final.', action: `/matches/${m.id}` })
          }
        })
      .subscribe()
  })

  return () => {
    if (chMsgs)    supabase.removeChannel(chMsgs)
    if (chRest)    supabase.removeChannel(chRest)
    if (chMatches) supabase.removeChannel(chMatches)
  }
}
