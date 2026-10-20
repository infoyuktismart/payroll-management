const CACHE_NAME = 'payroll-erp-v3'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-icon.svg',
  '/pwa-icon-192.png',
  '/pwa-icon-512.png',
  '/maskable-icon-512.png',
]

const isLocalDevHost = ['localhost', '127.0.0.1', '[::1]'].includes(self.location.hostname)

const clearAllCaches = () =>
  caches.keys().then((cacheNames) => Promise.all(cacheNames.map((name) => caches.delete(name))))

self.addEventListener('install', (event) => {
  if (isLocalDevHost) {
    event.waitUntil(self.skipWaiting())
    return
  }

  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS)
      })
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  if (isLocalDevHost) {
    event.waitUntil(clearAllCaches().then(() => self.registration.unregister()))
    return
  }

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
        )
      })
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  if (isLocalDevHost) {
    return
  }

  // Skip cross-origin requests, like those for Supabase API
  if (!event.request.url.startsWith(self.location.origin)) {
    return
  }

  // Network-first for navigation requests so new app builds/chunks are picked up immediately
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone()
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache)
            })
          }
          return networkResponse
        })
        .catch(async () => {
          const cached = (await caches.match('/index.html')) || (await caches.match('/'))
          return cached || new Response('', { status: 503, statusText: 'Offline' })
        })
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse
      }

      return fetch(event.request)
        .then((networkResponse) => {
          // Don't cache non-successful responses or non-basic types
          if (
            !networkResponse ||
            networkResponse.status !== 200 ||
            networkResponse.type !== 'basic'
          ) {
            return networkResponse
          }

          // Prevent poisoning cache: never cache an HTML response for script or asset chunks
          const contentType = networkResponse.headers.get('content-type') || ''
          const url = event.request.url.toLowerCase()
          const isScript =
            url.endsWith('.js') ||
            url.includes('/assets/') ||
            event.request.destination === 'script'
          if (isScript && contentType.includes('text/html')) {
            return networkResponse
          }

          // Cache the new resource for future use
          const responseToCache = networkResponse.clone()
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache)
          })

          return networkResponse
        })
        .catch(() => {
          return new Response('', { status: 503, statusText: 'Offline' })
        })
    })
  )
})

self.addEventListener('push', (event) => {
  const fallback = {
    title: 'Payroll Management',
    body: 'You have a new payroll notification.',
    url: '/',
    icon: '/pwa-icon-192.png',
    badge: '/pwa-icon-192.png',
  }

  const payload = event.data ? event.data.json() : fallback
  const options = {
    body: payload.body || fallback.body,
    icon: payload.icon || fallback.icon,
    badge: payload.badge || fallback.badge,
    data: {
      url: payload.url || fallback.url,
    },
    tag: payload.tag || 'payroll-notification',
    renotify: Boolean(payload.renotify),
    requireInteraction: Boolean(payload.requireInteraction),
  }

  event.waitUntil(self.registration.showNotification(payload.title || fallback.title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || '/'
  const normalizedUrl = new URL(targetUrl, self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const matchingClient = clients.find((client) => client.url === normalizedUrl)
      if (matchingClient) return matchingClient.focus()
      return self.clients.openWindow(normalizedUrl)
    })
  )
})
