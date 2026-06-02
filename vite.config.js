import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { compression } from 'vite-plugin-compression2'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import crypto from 'node:crypto'

const require = createRequire(import.meta.url)

const loadPwaPlugin = () => {
  try {
    return require('vite-plugin-pwa').VitePWA
  } catch {
    return null
  }
}

const VitePWA = loadPwaPlugin()

const reactPath = fileURLToPath(new URL('./node_modules/react/index.js', import.meta.url))
const reactJsxRuntimePath = fileURLToPath(
  new URL('./node_modules/react/jsx-runtime.js', import.meta.url)
)
const reactJsxDevRuntimePath = fileURLToPath(
  new URL('./node_modules/react/jsx-dev-runtime.js', import.meta.url)
)
const reactDomPath = fileURLToPath(new URL('./node_modules/react-dom/index.js', import.meta.url))
const reactDomClientPath = fileURLToPath(
  new URL('./node_modules/react-dom/client.js', import.meta.url)
)

const cspNoncePlugin = () => {
  let isProduction = false
  return {
    name: 'csp-nonce',
    configResolved(config) {
      isProduction = config.command === 'build'
    },
    transformIndexHtml(html) {
      if (!isProduction) {
        return html
      }

      const nonce = crypto.randomBytes(16).toString('base64')

      let modifiedHtml = html.replace(/<script/g, `<script nonce="${nonce}"`)

      modifiedHtml = modifiedHtml.replace(/'unsafe-inline'\s+'unsafe-eval'/g, `'nonce-${nonce}'`)

      return modifiedHtml
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    cspNoncePlugin(),
    VitePWA &&
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: [
          'pwa-icon.svg',
          'pwa-icon-192.png',
          'pwa-icon-512.png',
          'maskable-icon-512.png',
        ],
        manifest: {
          name: 'Yukti Smart Payroll',
          short_name: 'YuktiPayroll',
          description: 'Yukti Smart Payroll Management System',
          theme_color: '#0f172a',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: '/pwa-icon-192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/pwa-icon-512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: '/maskable-icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        workbox: {
          cleanupOutdatedCaches: true,
          navigateFallback: '/index.html',
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          importScripts: ['/sw-push.js'],
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'payroll-pages',
                networkTimeoutSeconds: 3,
                expiration: {
                  maxEntries: 24,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
              },
            },
            {
              urlPattern: ({ request }) =>
                ['script', 'style', 'worker'].includes(request.destination),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'payroll-static-assets-v2',
                networkTimeoutSeconds: 5,
                expiration: {
                  maxEntries: 80,
                  maxAgeSeconds: 60 * 60 * 24,
                },
              },
            },
            {
              urlPattern: ({ request }) => request.destination === 'image',
              handler: 'CacheFirst',
              options: {
                cacheName: 'payroll-images',
                expiration: {
                  maxEntries: 80,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
            {
              urlPattern: ({ url }) => url.hostname.endsWith('.supabase.co'),
              handler: 'NetworkFirst',
              options: {
                cacheName: 'payroll-supabase-runtime',
                networkTimeoutSeconds: 8,
                expiration: {
                  maxEntries: 80,
                  maxAgeSeconds: 60 * 10,
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: false,
        },
      }),
    compression({
      algorithms: ['gzip', 'brotliCompress'],
      exclude: /\.(gz|br)$/i,
    }),
  ].filter(Boolean),
  resolve: {
    alias: [
      { find: /^react$/, replacement: reactPath },
      { find: /^react\/jsx-runtime$/, replacement: reactJsxRuntimePath },
      { find: /^react\/jsx-dev-runtime$/, replacement: reactJsxDevRuntimePath },
      { find: /^react-dom$/, replacement: reactDomPath },
      { find: /^react-dom\/client$/, replacement: reactDomClientPath },
    ],
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    force: true,
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-ui': ['lucide-react'],
          'vendor-pdf': ['jspdf', 'html2canvas'],
          'vendor-charts': ['recharts'],
          'vendor-date': ['date-fns'],
        },
      },
    },
    chunkSizeWarningLimit: 1700,
  },
})
