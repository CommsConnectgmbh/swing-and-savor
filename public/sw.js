// Killswitch service worker — unregisters itself and clears all caches.
// Browsers that still have an old SW from a previous build will fetch this on
// their next /sw.js check and self-clean.
self.addEventListener('install', (e) => { self.skipWaiting() })
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.map(n => caches.delete(n)))
    await self.registration.unregister()
    const clients = await self.clients.matchAll({ type: 'window' })
    for (const c of clients) c.navigate(c.url)
  })())
})
