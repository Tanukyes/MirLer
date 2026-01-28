import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // GitHub Pages для Project Pages отдаёт сайт по /<repo>/
  // https://tanukyes.github.io/MirLer/
  base: command === 'build' ? '/MirLer/' : '/',
}))
