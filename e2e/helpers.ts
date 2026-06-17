import type { Locator, Page } from '@playwright/test'

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
