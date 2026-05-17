/* Swing & Savor — Web Push Service Worker
 * Empfängt Push-Events vom Backend (Supabase Edge Function via VAPID),
 * zeigt eine Notification mit Deep-Link in die App.
 */
self.addEventListener('push', (event) => {
  let payload = {}
  try { payload = event.data?.json() || {} } catch { payload = { title: 'Swing & Savor', body: event.data?.text() } }
  const title = payload.title || 'Swing & Savor'
  const options = {
    body:  payload.body  || '',
    icon:  payload.icon  || '/icons/icon-192.png',
    badge: payload.badge || '/icons/badge-72.png',
    data:  { url: payload.url || '/' },
    tag:   payload.tag || undefined,
    renotify: !!payload.tag,
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      for (const c of clients) {
        if ('focus' in c) { c.navigate(url); return c.focus() }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
