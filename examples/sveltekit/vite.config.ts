import { sveltekit } from '@sveltejs/kit/vite'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        ws: true, // Enable WebSocket proxying
      },
    },
  },
  plugins: [sveltekit(), visualizer()],
})
