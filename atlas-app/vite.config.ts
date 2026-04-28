import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    // ─── Dev Proxy — routes /api/* to your backend to avoid CORS issues ───
    proxy: {
      '/api': {
        target: 'http://localhost:8000',   // ← change to your backend URL
        changeOrigin: true,
        secure: false,
        // Uncomment the line below if your backend does NOT have an /api prefix:
        // rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
