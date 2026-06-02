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
