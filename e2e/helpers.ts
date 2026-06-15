import type { Page } from '@playwright/test'

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
