/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Model files (ONNX, MediaPipe .task, ORT wasm) and audio clips must be
        // precached for the app to work fully offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,mp3,wav,onnx,task,wasm,mjs}'],
        maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
      },
      manifest: {
        name: 'AlexSpeak — Speech Encouragement',
        short_name: 'AlexSpeak',
        description:
          'A gentle, offline practice companion that rewards any communicative effort.',
        start_url: '/',
        display: 'standalone',
        background_color: '#fdf6ec',
        theme_color: '#fdf6ec',
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
