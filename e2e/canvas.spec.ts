import path from 'path'
import { test, expect } from './fixtures'
import { simulateDragToCanvas } from './helpers'

const EMPTY_GRAPH = path.resolve('e2e/fixtures/empty-graph.json')

test('dragging a node from sidebar creates it on the canvas', async ({
  page,
}) => {
  await page
    .locator('[data-testid="import-graph-input"]')
    .setInputFiles(EMPTY_GRAPH)
  await expect(page.locator('.svelte-flow__node')).toHaveCount(0)

  await expect(
    page.locator('[data-testid="sidebar-node"]').first()
  ).toBeVisible()
  await simulateDragToCanvas(page, '[data-testid="sidebar-node"]')

  // @xyflow renders each canvas node inside a .svelte-flow__node wrapper
  await expect(page.locator('.svelte-flow__node').first()).toBeVisible()
})
