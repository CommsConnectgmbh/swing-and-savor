import { supabase } from './supabase'

/**
 * Subscribe to one or more Postgres-change streams on a single Realtime channel.
 *
 * Replaces the copy-pasted
 *   `supabase.channel(name).on('postgres_changes', {...}, fn)....subscribe()`
 * idiom (plus its matching `supabase.removeChannel(...)` teardown) that was
 * scattered across screens and components. Centralising it removes a class of
 * subscription-leak bugs: the only correct way to tear a channel down is to
 * call the function this returns.
 *
 * @param {string} channelName            Unique channel name (e.g. `match-${id}`).
 * @param {Array<{
 *   table: string,
 *   handler: (payload: any) => void,
 *   event?: '*'|'INSERT'|'UPDATE'|'DELETE',
 *   filter?: string,
 *   schema?: string,
 * }>} subscriptions                       One entry per `postgres_changes` listener.
 * @returns {() => void} Idempotent teardown that removes the channel.
 */
export function subscribeToTables(channelName, subscriptions = []) {
  const channel = supabase.channel(channelName)

  for (const sub of subscriptions) {
    if (!sub || !sub.table || typeof sub.handler !== 'function') continue
    const { table, handler, event = '*', filter, schema = 'public' } = sub
    // Preserve the exact option shape the call sites used: only include
    // `filter` when one is supplied (an explicit `filter: undefined` changes
    // how postgres-changes matches in supabase-js).
    const opts = filter ? { event, schema, table, filter } : { event, schema, table }
    channel.on('postgres_changes', opts, handler)
  }

  channel.subscribe()

  let removed = false
  return () => {
    if (removed) return
    removed = true
    supabase.removeChannel(channel)
  }
}
