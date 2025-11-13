import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

// https://vite.dev/config/
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
  build: {
    rollupOptions: {
      treeshake: {
        moduleSideEffects: false,
      },
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react/jsx-runtime'],
          'router-vendor': ['@tanstack/react-router'],
          'validation-vendor': ['zod'],
        },
      },
    },
  },
  plugins: [
    tanstackRouter({
      target: 'react',
      autoCodeSplitting: true,
    }),
    react({
      babel: {
        plugins: [['babel-plugin-react-compiler']],
      },
    }),
    visualizer(),
    tsconfigPaths(),
  ],
})
