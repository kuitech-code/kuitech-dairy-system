import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: 'https://github.com/kuitech-code/kuitech-dairy-system.git',
  server: {
    watch: {
      usePolling: true, // 🚀 Forces Windows to check for file edits automatically
    },
  },
})
