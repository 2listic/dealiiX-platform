import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

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

/**
 * Simulates an HTML5 drag-and-drop from a sidebar node onto the SvelteFlow canvas.
 *
 * Event sequence: dragstart (source) → dragenter → dragover → drop (.svelte-flow) → dragend (source)
 *
 * @param page - The Playwright Page object for the Electron window under test.
 * @param sourceSelector - CSS selector identifying the element to drag (e.g. `'[data-testid="sidebar-node"]'`).
 * @returns A promise that resolves once all drag events have been dispatched.
 * @throws If either the source element or `.svelte-flow` cannot be found in the DOM.
 */
export async function simulateDragToCanvas(
  page: Page,
  sourceSelector: string
): Promise<void> {
  // page.evaluate runs inside the Electron renderer — the only place where
  // real DragEvent / DataTransfer objects exist.
  await page.evaluate((src: string) => {
    const source = document.querySelector(src)
    const target = document.querySelector('.svelte-flow')
    if (!source || !target)
      throw new Error(`simulateDragToCanvas: element not found (${src})`)

    const dt = new DataTransfer()
    const rect = target.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2

    source.dispatchEvent(
      new DragEvent('dragstart', { dataTransfer: dt, bubbles: true })
    )
    target.dispatchEvent(
      new DragEvent('dragenter', { dataTransfer: dt, bubbles: true })
    )
    target.dispatchEvent(
      new DragEvent('dragover', {
        dataTransfer: dt,
        bubbles: true,
        clientX: x,
        clientY: y,
      })
    )
    target.dispatchEvent(
      new DragEvent('drop', {
        dataTransfer: dt,
        bubbles: true,
        clientX: x,
        clientY: y,
      })
    )
    source.dispatchEvent(
      new DragEvent('dragend', { dataTransfer: dt, bubbles: true })
    )
  }, sourceSelector)
}

/**
 * Simulates a pointer drag between two SvelteFlow handles to create an edge.
 *
 * @param page - The Playwright Page object for the Electron window under test.
 * @param source - Locator for the output (right) handle to drag from.
 * @param target - Locator for the input (left) handle to drag to.
 * @returns A promise that resolves once the mouse-up event has been dispatched.
 * @throws If either handle's bounding box cannot be determined.
 */
export async function connectHandles(
  page: Page,
  source: Locator,
  target: Locator
): Promise<void> {
  const srcBox = await source.boundingBox()
  const tgtBox = await target.boundingBox()
  if (!srcBox || !tgtBox)
    throw new Error('connectHandles: could not read handle bounding box')

  // Offset 2px inward from each handle centre so the click lands on the node body.
  const sx = srcBox.x + srcBox.width / 2 - 2
  const sy = srcBox.y + srcBox.height / 2
  const tx = tgtBox.x + tgtBox.width / 2 + 2
  const ty = tgtBox.y + tgtBox.height / 2

  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(tx, ty, { steps: 20 })
  await page.mouse.up()
}
