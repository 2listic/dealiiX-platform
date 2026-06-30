/**
 * Which central view is shown: the graph/parameters editor or the pipeline editor.
 * Transient (not persisted) — defaults to the graph editor on each launch.
 */

export type ViewMode = 'single' | 'pipeline'

let mode = $state<ViewMode>('single')

export const viewModeState = {
  get value(): ViewMode {
    return mode
  },
  set value(next: ViewMode) {
    mode = next
  },
  /** Toggles between the single-stage editor and the pipeline editor. */
  toggle(): void {
    mode = mode === 'single' ? 'pipeline' : 'single'
  },
}
