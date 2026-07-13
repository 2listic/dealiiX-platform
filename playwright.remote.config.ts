import { defineConfig } from '@playwright/test'

/**
 * Playwright configuration for Tier 2 E2E tests (auth + project management).
 *
 * Requires coral-remote-server to be running on localhost:8080 before the
 * suite starts. Run locally with:
 *   docker compose up -d coral-remote-server
 *   npm run test:e2e:remote:build
 */
export default defineConfig({
  testDir: './e2e-remote',
  timeout: 90_000,
  workers: 1,
  retries: 1,
  globalSetup: './e2e-remote/global-setup.ts',
  use: {
    video: 'on-first-retry',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
})
