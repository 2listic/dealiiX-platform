import { test, expect } from './fixtures'
import { simulateDragToCanvas } from './helpers'

test('dragging a node from sidebar creates it on the canvas', async ({ page }) => {
  await expect(page.locator('[data-testid="sidebar-node"]').first()).toBeVisible()

  await simulateDragToCanvas(page, '[data-testid="sidebar-node"]')

  // @xyflow renders each canvas node inside a .svelte-flow__node wrapper
  await expect(page.locator('.svelte-flow__node').first()).toBeVisible()
})
