import path from 'path'
import type { Locator } from '@playwright/test'
import { test, expect } from './fixtures'
import { connectHandles, simulateDragToCanvas } from './helpers'

const EMPTY_GRAPH = path.resolve('e2e/fixtures/empty-graph.json')
const TRIANGULATION = 'Triangulation'
const GENERATOR = 'Grid generator -> Generate from name and arguments'

/** Matches an element whose whole text is `text`, ignoring surrounding whitespace. */
const exactly = (text: string): RegExp => new RegExp(`^\\s*${text}\\s*$`)

test('choosing a variant on one family narrows the family connected to it', async ({
  page,
}) => {
  await page
    .locator('[data-testid="import-graph-input"]')
    .setInputFiles(EMPTY_GRAPH)
  await expect(page.locator('.svelte-flow__node')).toHaveCount(0)

  // A collapsed sidebar shows its tile labels only under the mouse.
  await page.getByTestId('sidebar').hover()
  const tile = (label: string) =>
    page.getByTestId('sidebar-node').filter({ hasText: exactly(label) })
  // One above the other: the generator is wider than half the canvas.
  await simulateDragToCanvas(page, tile(TRIANGULATION), { x: 0.1, y: 0.1 })
  await simulateDragToCanvas(page, tile(GENERATOR), { x: 0.3, y: 0.55 })
  // Leave the sidebar, so it collapses before the handles are measured.
  const pane = await page.locator('.svelte-flow__pane').boundingBox()
  if (!pane) throw new Error('The canvas pane has no bounding box')
  await page.mouse.move(pane.x + pane.width - 5, pane.y + pane.height - 5)

  const nodes = page.locator('.svelte-flow__node')
  await expect(nodes).toHaveCount(2)
  const node = (title: string) =>
    nodes.filter({
      has: page.locator('.node-name', { hasText: exactly(title) }),
    })
  const triangulation = node(TRIANGULATION)
  const generator = node(GENERATOR)
  const status = (familyNode: Locator) => familyNode.locator('.overload-status')
  const chooseVariant = (familyNode: Locator) =>
    familyNode.getByRole('combobox', { name: 'Choose variant' })

  await connectHandles(
    page,
    triangulation.locator('.svelte-flow__handle-right'),
    generator.locator('.svelte-flow__handle-left').first()
  )
  await expect(page.locator('.svelte-flow__edge')).toHaveCount(1)
  await expect(status(triangulation)).toHaveText('6 variants')
  await expect(status(generator)).toHaveText('6 variants')

  await chooseVariant(triangulation).selectOption({
    label: 'dealii::Triangulation<2, 2>',
  })

  await expect(status(triangulation)).toHaveText('finalized')
  await expect(status(generator)).toHaveText('resolved')
  await expect(
    generator.getByRole('button', { name: 'Finalize' })
  ).toBeVisible()

  await triangulation.getByRole('button', { name: 'Show variants' }).click()

  await expect(status(triangulation)).toHaveText('6 variants')
  await expect(status(generator)).toHaveText('6 variants')
  await expect(chooseVariant(triangulation)).toBeVisible()
})
