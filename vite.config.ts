import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'PokéLab — Deck Builder Pokémon TCG',
        short_name: 'PokéLab',
        description:
          'Constructeur de decks Pokémon TCG premium : catalogue, recherche par effet, stats et collection. Local-first.',
        lang: 'fr',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#07090f',
        theme_color: '#07090f',
        categories: ['games', 'utilities', 'productivity'],
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Images des cartes (TCGdex, pokemontcg, scrydex) : immuables → cache long.
            urlPattern: ({ url }) =>
              /(assets\.tcgdex\.net|images\.pokemontcg\.io|images\.scrydex\.com)/.test(url.href),
            handler: 'CacheFirst',
            options: {
              cacheName: 'card-images',
              expiration: { maxEntries: 1200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Données de cartes / recherche (APIs + index Supabase) : frais d'abord.
            urlPattern: ({ url }) =>
              /(api\.tcgdex\.net|api\.pokemontcg\.io|supabase\.co)/.test(url.href),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'card-data',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
})
