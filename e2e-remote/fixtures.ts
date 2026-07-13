import { test as base, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { clearCanvas, waitForToasts } from './helpers'

export const REMOTE_URL = 'http://localhost:8080'

export const TEST_USER = {
  username: 'e2etest',
  password: 'e2epassword',
}

type WorkerFixtures = {
  electronApp: ElectronApplication
}

type TestFixtures = {
  /** Page fixture with a valid auth token seeded into the store. */
  authedPage: Page
  /** Page fixture with no auth token — starts logged out. */
  unauthedPage: Page
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  /**
   * Worker-scoped fixture: launches the Electron application once, shared
   * across all tests in the worker.
   *
   * Uses an isolated userData directory so the real electron-store is never
   * read or written:
   * - registered_nodes falls back to defaultNodes.json (built-in fallback)
   * - settings falls back to createDefaultSettings(), which already sets
   *   backendKind: 'coral' and urlRemoteServer: 'http://localhost:8080'
   */
  electronApp: [
    async ({}, use) => {
      const tempUserData = mkdtempSync(join(tmpdir(), 'dealiix-e2e-remote-'))

      const app = await electron.launch({
        args: ['.'],
        env: { ...process.env, E2E_TEST: '1', ELECTRON_USERDATA: tempUserData },
      })

      await app.firstWindow().then((page) =>
        page.waitForSelector('[data-testid="flow-canvas"]', {
          timeout: 60_000,
        })
      )

      await use(app)

      await app.close()
      rmSync(tempUserData, { recursive: true, force: true })
    },
    { scope: 'worker' },
  ],

  /**
   * Test-scoped fixture: each test starts fully authenticated with a clean canvas.
   *
   * Logs in fresh for every test so no auth state has to be shared between fixtures.
   * Seeds the token into electron-store and reloads so loadAuth() picks it up,
   * then clears the canvas and waits for any lingering toasts.
   * Teardown is limited to clear electron-store because server has a pure stateless
   * JWT token with a 24h expiration limit and no session state or token blacklist.
   */
  authedPage: async ({ electronApp }, use) => {
    const loginRes = await fetch(`${REMOTE_URL}/api/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER),
    })
    if (!loginRes.ok) {
      throw new Error(
        `authedPage fixture: login failed with HTTP ${loginRes.status}. ` +
          `Is coral-remote-server running at ${REMOTE_URL}?`
      )
    }
    const { token } = (await loginRes.json()) as { token: string }

    const page = await electronApp.firstWindow()

    await page.evaluate(
      async (args) => {
        const store = (window as any).electron.store
        await store.set('access_token', args.token)
        await store.set('username', args.username)
      },
      { token, username: TEST_USER.username }
    )
    await page.reload()
    await page.waitForSelector('[data-testid="flow-canvas"]', {
      timeout: 30_000,
    })
    // Wait for auth state to propagate to the UI.
    await expect(page.locator('[data-testid="login-status"]')).toHaveText(
      TEST_USER.username,
      { timeout: 5_000 }
    )
    await clearCanvas(page)
    await waitForToasts(page)

    await use(page)

    // Teardown: clear auth for the next test.
    await page.evaluate(async () => {
      const store = (window as any).electron.store
      await store.remove('access_token')
      await store.remove('username')
    })
  },

  /**
   * Test-scoped fixture: each test starts logged out.
   *
   * Clears any stored auth token, reloads so the renderer starts with
   * no auth state, then clears the canvas and waits for toasts.
   */
  unauthedPage: async ({ electronApp }, use) => {
    const page = await electronApp.firstWindow()

    await page.evaluate(async () => {
      const store = (window as any).electron.store
      await store.remove('access_token')
      await store.remove('username')
    })
    await page.reload()
    await page.waitForSelector('[data-testid="flow-canvas"]', {
      timeout: 30_000,
    })
    // Confirm we are logged out before handing the page to the test.
    await expect(page.locator('[data-testid="login-status"]')).toHaveText(
      'Login',
      { timeout: 5_000 }
    )
    await clearCanvas(page)
    await waitForToasts(page)

    await use(page)
  },
})

export { expect } from '@playwright/test'
