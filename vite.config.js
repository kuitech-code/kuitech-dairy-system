import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/kuitech-dairy-system/',
  server: {
    watch: {
      usePolling: true, // 🚀 Forces Windows to check for file edits automatically
    },
  },
})
