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

  // force: bypasses Playwright's actionability wait so nodes can be selected
  // even when they appear small or partially covered at the fitView zoom level.
  await nodes.first().click({ force: true })
  await page.keyboard.down('Control')
  await nodes.last().click({ force: true })
  await page.keyboard.up('Control')

  // force: the button may overlap with the minimap at small window sizes
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
