import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/',
  plugins: [react()],
  build: {
    target: 'es2020',
    sourcemap: false,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('/@supabase/')) return 'supabase'
          if (id.includes('/react-router')) return 'router'
          // Keep React core + every runtime dep together — splitting scheduler
          // or use-sync-external-store off into `vendor` creates a vendor→react
          // circular chunk and breaks createContext at boot.
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|use-sync-external-store|@babel[\\/]runtime|object-assign|prop-types)[\\/]/.test(id)) {
            return 'react'
          }
          return 'vendor'
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.js',
  },
})
