import { defineConfig } from 'vitest/config'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte({ hot: false })],
  test: {
    include: ['src/**/*.test.{js,ts}'],
    environment: 'node',
    globals: false,
  },
  resolve: {
    conditions: ['browser'],
  },
})
