import path from 'path'
import { test, expect } from './fixtures'
import { connectHandles } from './helpers'

const TWO_NODES_FIXTURE = path.resolve('e2e/fixtures/two-nodes-no-edges.json')

test('connecting an output handle to a compatible input handle creates an edge', async ({
  page,
}) => {
  await page
    .locator('[data-testid="import-graph-input"]')
    .setInputFiles(TWO_NODES_FIXTURE)

  const nodes = page.locator('.svelte-flow__node')
  await expect(nodes).toHaveCount(2)

  const sourceHandle = nodes.first().locator('.svelte-flow__handle-right')
  const targetHandle = nodes.last().locator('.svelte-flow__handle-left').first()

  await connectHandles(page, sourceHandle, targetHandle)

  await expect(page.locator('.svelte-flow__edge')).toHaveCount(1)
})
