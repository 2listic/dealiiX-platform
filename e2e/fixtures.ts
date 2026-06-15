import { test as base, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'

type Fixtures = {
  /** The running Electron application. Closed automatically after each test. */
  electronApp: ElectronApplication
  /** The first BrowserWindow opened by the app, ready after the canvas mounts. */
  page: Page
}

/** Playwright fixture async function that sets up a resource, calls `await use(value)`
 *  to hand it to the test, then tears it down after `use` resolves.
 */
export const test = base.extend<Fixtures>({
  // Launches the app the same way `npm run dev` does: `electron .`
  electronApp: async ({}, use) => {
    const app = await electron.launch({
      args: ['.'],
    })
    await use(app)
    await app.close()
  },

  // Waits for [data-testid="flow-canvas"] before handing the page to each test.
  page: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow()
    await page.waitForSelector('[data-testid="flow-canvas"]', { timeout: 30_000 })
    await use(page)
  },
})

export { expect } from '@playwright/test'
