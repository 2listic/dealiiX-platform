import { test, expect } from './fixtures'

test('canvas and sidebar are visible on launch', async ({ page }) => {
  await expect(page.locator('[data-testid="flow-canvas"]')).toBeVisible()
  await expect(page.locator('[data-testid="sidebar"]')).toBeVisible()
})

test('sidebar contains nodes from the default registry', async ({ page }) => {
  const nodes = page.locator('[data-testid="sidebar-node"]')
  await expect(nodes.first()).toBeVisible()
  expect(await nodes.count()).toBeGreaterThan(0)
})
