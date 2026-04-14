import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  optimizeDeps: {
    entries: ['index.html'],
    exclude: ['@xyflow/svelte', '@xyflow/system'],
  },
  build: {
    outDir: 'dist',
  },
  plugins: [svelte()],
})
