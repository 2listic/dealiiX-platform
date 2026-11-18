import type { Viewport } from '@xyflow/system'

// Read once when the canvas mounts, never reactively.
let savedViewport: Viewport | null = null

/** Viewport to restore when the graph canvas is remounted. */
export const graphViewportState = {
  /** The last saved viewport, or null before the canvas first mounts. */
  get value(): Viewport | null {
    return savedViewport
  },
  /**
   * Saves the canvas viewport; called on every move, fitView included.
   * @param viewport - Current viewport of the canvas.
   * @returns Nothing.
   */
  save(viewport: Viewport): void {
    savedViewport = { ...viewport }
  },
}
