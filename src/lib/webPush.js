import { supabase } from './supabase'

/**
 * Web-Push-Subscription. Funktioniert auf modernen Browsern + iOS PWA (16.4+).
 *
 * VAPID-Key kommt aus `VITE_VAPID_PUBLIC_KEY` (.env). Wenn nicht gesetzt,
 * bleibt Web-Push inaktiv (kein Crash, nur kein Subscribe-Versuch).
 *
 * Service Worker `/sw-push.js` muss im public/ liegen und für `push`-Events
 * eine Notification anzeigen — Setup siehe REPORT_NOTIFICATIONS.md.
 */

export function webPushAvailable() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && !!import.meta.env.VITE_VAPID_PUBLIC_KEY
}

export async function ensureWebPush(user) {
  if (!user?.id) return { ok: false, reason: 'not_authed' }
  if (!webPushAvailable()) return { ok: false, reason: 'unavailable' }
  if (Notification.permission === 'denied') return { ok: false, reason: 'denied' }
  if (Notification.permission === 'default') {
    const p = await Notification.requestPermission()
    if (p !== 'granted') return { ok: false, reason: 'denied' }
  }
  const reg = await navigator.serviceWorker.register('/sw-push.js')
  const existing = await reg.pushManager.getSubscription()
  const sub = existing || await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
  })
  const obj = sub.toJSON()
  await supabase.from('push_subscriptions').upsert({
    user_id: user.id, platform: 'web',
    endpoint: obj.endpoint,
    keys: obj.keys,
    device_label: navigator.userAgent.slice(0, 80),
    last_seen_at: new Date().toISOString(),
  }, { onConflict: 'user_id,endpoint' })
  return { ok: true }
}

export async function disableWebPush(user) {
  if (!user?.id) return
  const reg = await navigator.serviceWorker.getRegistration('/sw-push.js').catch(() => null)
  const sub = await reg?.pushManager?.getSubscription()
  if (sub) {
    await supabase.from('push_subscriptions')
      .delete().eq('user_id', user.id).eq('endpoint', sub.endpoint)
    await sub.unsubscribe()
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i)
  return out
}
