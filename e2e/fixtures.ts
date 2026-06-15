import { test as base, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'

// Worker-scoped fixtures are shared across all tests in the same worker process.
type WorkerFixtures = {
  /** The running Electron application. Launched once per worker, closed after all tests in that worker finish. */
  electronApp: ElectronApplication
}

// Test-scoped fixtures get a fresh instance per test.
type TestFixtures = {
  /** The first BrowserWindow opened by the app, ready after the canvas mounts. */
  page: Page
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  // Launches the app the same way `npm run dev` does: `electron .`
  // Worker scope: one Electron process per worker, shared across all tests it runs.
  // This avoids a per-test cold start (Electron + Chromium initialisation).
  electronApp: [
    async ({}, use) => {
      const app = await electron.launch({ args: ['.'] })
      await use(app)
      await app.close()
    },
    { scope: 'worker' },
  ],

  // Waits for [data-testid="flow-canvas"] before handing the page to each test.
  // Test scope: waitForSelector resolves instantly after the first test since the canvas
  // is already mounted.
  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow()
    await page.waitForSelector('[data-testid="flow-canvas"]', {
      timeout: 60_000,
    })
    await use(page)
  },
})

export { expect } from '@playwright/test'
