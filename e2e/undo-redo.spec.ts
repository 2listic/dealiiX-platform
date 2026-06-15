import { test, expect } from './fixtures'
import { simulateDragToCanvas } from './helpers'

test('undo removes a node and redo restores it', async ({ page }) => {
  await expect(page.locator('[data-testid="sidebar-node"]').first()).toBeVisible()

  await simulateDragToCanvas(page, '[data-testid="sidebar-node"]')

  const nodes = page.locator('.svelte-flow__node')
  await expect(nodes.first()).toBeVisible()
  const countAfterAdd = await nodes.count()

  // Undo — node should disappear
  await page.keyboard.press('Control+Z')
  await expect(nodes).toHaveCount(countAfterAdd - 1)

  // Redo — node should reappear
  await page.keyboard.press('Control+Shift+Z')
  await expect(nodes).toHaveCount(countAfterAdd)
})
