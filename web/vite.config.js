import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Tribulator',
        short_name: 'Tribulator',
        description: 'Search, filter, save and AI-summarise anaesthesia & critical care literature.',
        theme_color: '#0b2238',
        background_color: '#0b2238',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell only. PubMed/Claude/Apps Script calls are all
        // cross-origin and intentionally never cached — clinical search results
        // and AI summaries must always come from the network, never go stale.
        globPatterns: ['**/*.{js,css,html,png,svg}'],
      },
    }),
  ],
})
