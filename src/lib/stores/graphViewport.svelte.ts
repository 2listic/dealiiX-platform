import type { Viewport } from '@xyflow/system'

let savedViewport = $state<Viewport | null>(null)

/** Viewport to restore when the graph canvas is remounted. */
export const graphViewportState = {
  get value(): Viewport | null {
    return savedViewport
  },
  save(viewport: Viewport): void {
    savedViewport = { ...viewport }
  },
  clear(): void {
    savedViewport = null
  },
}
