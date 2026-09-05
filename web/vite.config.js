import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // Substituted at build time. These are read from the shell rather than a
  // .env file (the deploy workflow sets them), and defining them explicitly is
  // what makes that work — Vite does not surface shell variables through
  // import.meta.env on its own.
  define: {
    // Lets Settings show which build is running: the difference between "the
    // fix isn't working" and "you're on a stale cache".
    'import.meta.env.VITE_BUILD_ID': JSON.stringify((process.env.GITHUB_SHA || 'dev').slice(0, 7)),
    'import.meta.env.VITE_BUILD_TIME': JSON.stringify(new Date().toISOString()),
    // A Google client ID is public by design, so it ships in the bundle and
    // saves pasting it onto every device. Empty is fine: Settings then asks.
    'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(process.env.VITE_GOOGLE_CLIENT_ID || ''),
  },
  plugins: [
    react(),
    VitePWA({
      // 'prompt' rather than 'autoUpdate': an update that installs silently
      // still needs a second reload before the new assets are served, which
      // leaves the user looking at old code with no way to tell. Asking is
      // both faster and honest about what is happening.
      registerType: 'prompt',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      manifest: {
        name: 'Tribulator',
        short_name: 'Tribulator',
        description: 'Search, filter, save and AI-summarise anaesthesia & critical care literature.',
        theme_color: '#0f3557',
        background_color: '#f4f7fa',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
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
