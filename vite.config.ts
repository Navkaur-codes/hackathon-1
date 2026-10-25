import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // pre-bundle zustand with React at dev start; discovering it later made the dev server load two React copies
  optimizeDeps: { include: ['zustand', 'zustand/vanilla', 'zustand/middleware'] },
})
