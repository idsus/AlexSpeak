/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
// @ts-expect-error — local JS dev plugin (server-side Kokoro TTS endpoint)
import { ttsServerPlugin } from './tools/ttsServerPlugin.mjs'

export default defineConfig({
  plugins: [
    ttsServerPlugin(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Everything the app needs is precached so it works fully offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,mp3,wav,woff2}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
      },
      manifest: {
        name: 'AlexSpeak',
        short_name: 'AlexSpeak',
        description:
          'A gentle, offline practice companion that rewards any communicative effort.',
        start_url: '/',
        display: 'standalone',
        background_color: '#FFFDF7',
        theme_color: '#FFFDF7',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
