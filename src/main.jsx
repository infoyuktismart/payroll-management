import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import * as Sentry from '@sentry/react'
import AppCrashFallback from './components/AppCrashFallback.jsx'
import './index.css'
import App from './App.jsx'
import { registerServiceWorker } from './swRegister.js'

const isProd = import.meta.env.PROD

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_APP_VERSION,
  tracesSampleRate: isProd ? 0.2 : 1.0,
  enabled: isProd,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
  ],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

const showBootstrapError = (error) => {
  const root = document.getElementById('root')
  const message = error instanceof Error ? error.message : String(error || 'Unknown startup error')
  const stack = error instanceof Error ? error.stack : ''

  console.error('[Bootstrap Error]', error)

  if (!root) return

  root.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#f8fafc;padding:24px;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="max-width:720px;width:100%;background:white;border:1px solid #fecaca;border-radius:20px;box-shadow:0 20px 50px rgba(15,23,42,.10);padding:28px;">
        <p style="margin:0 0 8px;color:#e11d48;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;">Application failed to start</p>
        <h1 style="margin:0 0 12px;color:#0f172a;font-size:24px;font-weight:900;">Startup error detected</h1>
        <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.5;">The app crashed before React could render the normal error screen. Check this message and the browser console.</p>
        <pre style="white-space:pre-wrap;overflow:auto;max-height:280px;background:#fff1f2;border:1px solid #ffe4e6;border-radius:12px;padding:14px;color:#9f1239;font-size:12px;">${message}\n\n${stack || ''}</pre>
        <button onclick="window.location.reload()" style="margin-top:18px;border:0;border-radius:12px;background:#0f172a;color:white;font-weight:800;padding:10px 16px;cursor:pointer;">Reload app</button>
      </div>
    </div>
  `
}

const isChunkLoadError = (error) => {
  const message = error instanceof Error ? `${error.name} ${error.message}` : String(error || '')
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(message)
}

const recoverFromStaleBuild = async (error) => {
  if (!isChunkLoadError(error)) return false
  if (sessionStorage.getItem('payroll_stale_build_recovered') === 'true') return false

  sessionStorage.setItem('payroll_stale_build_recovered', 'true')
  console.warn('[Bootstrap Recovery] Clearing cached app shell after stale chunk error.', error)

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations()
      await Promise.all(registrations.map((registration) => registration.unregister()))
    }
    if (window.caches?.keys) {
      const cacheNames = await window.caches.keys()
      await Promise.all(cacheNames.map((name) => window.caches.delete(name)))
    }
  } catch (cacheError) {
    console.warn('[Bootstrap Recovery] Cache cleanup failed:', cacheError)
  }

  window.location.reload()
  return true
}

window.addEventListener('error', (event) => {
  const error = event.error || event.message
  recoverFromStaleBuild(error).then((reloading) => {
    if (!reloading) showBootstrapError(error)
  })
})

window.addEventListener('unhandledrejection', (event) => {
  recoverFromStaleBuild(event.reason).then((reloading) => {
    if (!reloading) showBootstrapError(event.reason)
  })
})

try {
  const root = document.getElementById('root')
  if (!root) throw new Error('Root element #root was not found.')

  createRoot(root).render(
    <StrictMode>
      <Sentry.ErrorBoundary fallback={({ error }) => <AppCrashFallback error={error} />} showDialog>
        <QueryClientProvider client={queryClient}>
          <App />
          {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
        </QueryClientProvider>
      </Sentry.ErrorBoundary>
    </StrictMode>,
  )
} catch (error) {
  showBootstrapError(error)
}

registerServiceWorker()
