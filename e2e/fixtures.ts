import { test as base, expect, _electron as electron } from '@playwright/test'
import type { ElectronApplication, Page } from '@playwright/test'

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
  // This fixture launches the Electron application.
  // It is a worker-scoped fixture meaning it is shared across all tests in the same
  // worker process, so that it avoids several cold starts speeding up the test execution.
  electronApp: [
    async ({}, use) => {
      const app = await electron.launch({
        args: ['.'], // same way as `npm run dev` does: `electron .`
        env: { ...process.env, E2E_TEST: '1' },
      })
      await use(app)
      await app.close()
    },
    { scope: 'worker' }, // Worker scope fixture definition.
  ],

  // The first BrowserWindow opened by the Electron application.
  // This is a test-scoped fixture, meaning it runs once per test.
  page: async ({ electronApp }, use) => {
    // Receive the shared electronApp and wait for the canvas to mount.
    const page = await electronApp.firstWindow()
    await page.waitForSelector('[data-testid="flow-canvas"]', {
      timeout: 60_000, // 60 s covers the cold-start (~30 s in CI), only paid once.
    })
    // Clear any nodes left by the previous test.
    const pane = page.locator('.svelte-flow__pane')
    const box = await pane.boundingBox()
    if (box) {
      await page.mouse.move(box.x + 2, box.y + 2)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width - 2, box.y + box.height - 2, {
        steps: 5,
      })
      await page.mouse.up()
      await page.keyboard.press('Backspace')
      // Wait for the deletion to propagate through Svelte reactivity.
      await expect(page.locator('.svelte-flow__node'))
        .toHaveCount(0, { timeout: 5_000 })
        .catch(() => {})
    }
    // Wait for any toasts from the previous test to fully fade out.
    await expect(page.locator('[role="alert"]')).toHaveCount(0, {
      timeout: 15_000,
    })
    await use(page)
  },
})

export { expect } from '@playwright/test'
