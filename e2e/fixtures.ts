import { test as base, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'

// Worker-scoped fixtures are shared across all tests in the same worker process.
type WorkerFixtures = {
  /** The running Electron application. */
  electronApp: ElectronApplication
}

// Test-scoped fixtures get a fresh instance per test.
type TestFixtures = {
  /** The first BrowserWindow opened by the app. */
  page: Page
}

/** Playwright fixture async function that sets up a resource, calls `await use(value)`
 *  to hand it to the test, then tears it down after `use` resolves.
 */
export const test = base.extend<TestFixtures, WorkerFixtures>({
  // Launches the app the same way `npm run dev` does: `electron .`
  // Worker scope: it avoids a per-test cold start.
  electronApp: [
    async ({}, use) => {
      const app = await electron.launch({ args: ['.'] })
      await use(app)
      await app.close()
    },
    { scope: 'worker' },
  ],

  // Receives the shared electronApp and waits for the canvas to mount.
  // 60 s covers the Electron + Chromium cold-start (~30 s in CI), only paid once.
  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow()
    await page.waitForSelector('[data-testid="flow-canvas"]', {
      timeout: 60_000,
    })
    await use(page)
  },
})

export { expect } from '@playwright/test'
