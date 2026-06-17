import path from 'path'
import { test, expect } from './fixtures'

const GRAPH_FIXTURE = path.resolve(
  'test_files/network-mwe-simplified-qualified.json'
)

test('importing a JSON graph populates the canvas', async ({ page }) => {
  await page
    .locator('[data-testid="import-graph-input"]')
    .setInputFiles(GRAPH_FIXTURE)

  await expect(page.locator('.svelte-flow__node').first()).toBeVisible()
  expect(await page.locator('.svelte-flow__node').count()).toBeGreaterThan(0)
  await expect(page.locator('.svelte-flow__edge').first()).toBeVisible()
})
