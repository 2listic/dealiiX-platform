import { test as base, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { clearCanvas, waitForToasts } from './helpers'

type WorkerFixtures = {
  electronApp: ElectronApplication
}

type TestFixtures = {
  page: Page
}

/** Playwright fixture async function that sets up a resource, calls `await use(value)`
 *  to hand it to the test, then tears it down after `use` resolves.
 */
export const test = base.extend<TestFixtures, WorkerFixtures>({
  /**
   * Worker-scoped fixture: shared across all tests in the worker.
   *
   * Launches the Electron app with an isolated userData directory so the real
   * electron-store is never read or written. The app starts from a clean state:
   * - registered_nodes falls back to defaultNodes.json (built-in fallback)
   * - settings falls back to createDefaultSettings() — backendKind: 'coral',
   *   so FlowCanvas renders and [data-testid="flow-canvas"] is always present
   *
   * The cold-start wait (up to 60 s) is paid once per worker; subsequent tests
   * share the same Electron instance.
   */
  electronApp: [
    async ({}, use) => {
      // Isolated userData dir.
      const tempUserData = mkdtempSync(join(tmpdir(), 'dealiix-e2e-'))

      const app = await electron.launch({
        args: ['.'], // same way as `npm run dev` does: `electron .`
        env: { ...process.env, E2E_TEST: '1', ELECTRON_USERDATA: tempUserData },
      })

      await app.firstWindow().then((page) =>
        page.waitForSelector('[data-testid="flow-canvas"]', {
          timeout: 60_000, // cold-start (~30 s in CI).
        })
      )

      await use(app)

      await app.close()
      rmSync(tempUserData, { recursive: true, force: true })
    },
    { scope: 'worker' }, // Worker scope fixture definition.
  ],

  /**
   * Test-scoped fixture: each test gets a fresh page instance with a clean canvas.
   */
  page: async ({ electronApp }, use) => {
    // Receive the shared electronApp.
    const page = await electronApp.firstWindow()
    await clearCanvas(page)
    await waitForToasts(page)
    await use(page)
  },
})

export { expect } from '@playwright/test'
