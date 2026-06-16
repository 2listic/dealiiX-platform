import path from 'path'
import { test, expect } from './fixtures'

const TWO_NODES_FIXTURE = path.resolve('e2e/fixtures/two-nodes-no-edges.json')

test('collapsing a selection into a subnetwork and exploding it restores the nodes', async ({
  page,
}) => {
  await page
    .locator('[data-testid="import-graph-input"]')
    .setInputFiles(TWO_NODES_FIXTURE)

  const nodes = page.locator('.svelte-flow__node')
  await expect(nodes).toHaveCount(2)

  // Select both nodes: click first, then Ctrl+click second
  await nodes.first().click()
  await nodes.last().click({ modifiers: ['Control'] })

  // force: the button may be hidden by the minimap in CI's smaller windows
  await page
    .getByRole('button', { name: 'Create Subnetwork' })
    .click({ force: true })
  await page.locator('#network-node-name-input').fill('test-net')
  await page.getByRole('button', { name: 'Create', exact: true }).click()

  // If "test-net" already exists from a previous run, confirm the override
  const overrideConfirm = page.getByRole('button', { name: 'Override' })
  if (await overrideConfirm.isVisible({ timeout: 500 })) {
    await overrideConfirm.click()
  }

  // Both nodes are now encapsulated in one network node
  await expect(nodes).toHaveCount(1)

  // Explode restores the original two nodes
  await page.locator('.node-button[title="Explode subnetwork"]').click()
  await expect(nodes).toHaveCount(2)
})
