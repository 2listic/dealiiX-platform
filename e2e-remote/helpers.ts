import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

/**
 * Selects all nodes on the canvas and deletes them, then waits for the canvas to be empty.
 *
 * @param page - The Playwright Page object for the Electron window under test.
 */
export async function clearCanvas(page: Page): Promise<void> {
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
    await expect(page.locator('.svelte-flow__node'))
      .toHaveCount(0, { timeout: 5_000 })
      .catch(() => {})
  }
}

/**
 * Waits for all toast notifications to disappear from the page.
 *
 * @param page - The Playwright Page object for the Electron window under test.
 */
export async function waitForToasts(page: Page): Promise<void> {
  await expect(page.locator('[role="alert"]')).toHaveCount(0, {
    timeout: 15_000,
  })
}
