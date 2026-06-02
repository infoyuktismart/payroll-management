export function registerServiceWorker() {
    if (typeof window === 'undefined') return

    const isLocalDevHost = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);

    if ('serviceWorker' in navigator && isLocalDevHost) {
        window.addEventListener('load', () => {
            const wasControlled = Boolean(navigator.serviceWorker.controller)
            navigator.serviceWorker.getRegistrations()
                .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
                .then(() => window.caches?.keys?.())
                .then((cacheNames) => Promise.all((cacheNames || []).map((name) => window.caches.delete(name))))
                .then(() => {
                    if (wasControlled && window.sessionStorage.getItem('payroll_sw_cleanup_reloaded') !== 'true') {
                        window.sessionStorage.setItem('payroll_sw_cleanup_reloaded', 'true')
                        window.location.reload()
                    }
                })
                .catch((error) => console.log('Local service worker cleanup failed: ', error));
        });
    } else if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').then((registration) => {
                console.log('SW registered: ', registration);
            }).catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
        });
    }
}
