import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In production (GitHub Pages) the app lives at /Study-Portal/.
// In development it lives at /, so localhost:5173/ works normally.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? '/Study-Portal/' : '/',
}))
