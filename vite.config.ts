import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      injectRegister: false,
      manifest: false,
      registerType: 'prompt',
      workbox: {
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,json}', '*.png'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/__\//],
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/assets/audio/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'monster-mania-audio',
              cacheableResponse: { statuses: [0, 200] },
              rangeRequests: true,
              expiration: {
                maxEntries: 24,
                maxAgeSeconds: 60 * 60 * 24 * 90,
                purgeOnQuotaError: true,
              },
            },
          },
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin
              && url.pathname.startsWith('/assets/')
              && !url.pathname.startsWith('/assets/audio/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'monster-mania-game-assets',
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 64,
                maxAgeSeconds: 60 * 60 * 24 * 365,
                purgeOnQuotaError: true,
              },
            },
          },
          {
            urlPattern: /^https:\/\/(?:[^/]+\.)?(?:googleapis\.com|cloudfunctions\.net|firebaseio\.com)\//,
            handler: 'NetworkOnly',
          },
          {
            urlPattern: /^https:\/\/(?:[^/]+\.)?(?:googleapis\.com|cloudfunctions\.net|firebaseio\.com)\//,
            handler: 'NetworkOnly',
            method: 'POST',
          },
          {
            urlPattern: /\/__\/firebase\//,
            handler: 'NetworkOnly',
          },
        ],
        skipWaiting: false,
      },
    }),
  ],
})
