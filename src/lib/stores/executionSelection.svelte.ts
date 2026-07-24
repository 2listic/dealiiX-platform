import type { ExecutionLocation, BackendKind } from '../types/settingsTypes'

/**
 * Active execution selection — which target (`local`/`remote`) and backend kind
 * (`coral`/`executable`) the UI is pointed at. This is pure renderer selection
 * state (Electron never reads it), kept separate from the persisted runner
 * config in `settingsStore`. Persisted so the app reopens in the same mode.
 */
let location: ExecutionLocation = $state('remote')
let backendKind: BackendKind = $state('coral')

const SELECTION_KEY = 'execution_selection'

const persist = async () => {
  if (globalThis.window?.electron?.store) {
    await window.electron.store.set(SELECTION_KEY, { location, backendKind })
  }
}

// Load the persisted selection; fall back to the defaults above when absent.
const loadSelection = async () => {
  if (!globalThis.window?.electron?.store) return
  const stored = await window.electron.store.get(SELECTION_KEY, undefined)
  if (stored && typeof stored === 'object') {
    const s = stored as Partial<{
      location: ExecutionLocation
      backendKind: BackendKind
    }>
    if (s.location) location = s.location
    if (s.backendKind) backendKind = s.backendKind
  }
}
loadSelection()

export const executionSelectionState = {
  get location() {
    return location
  },
  get backendKind() {
    return backendKind
  },
  get isCoralMode() {
    return backendKind === 'coral'
  },
  get isExecutableMode() {
    return backendKind === 'executable'
  },
  async setLocation(next: ExecutionLocation) {
    location = next
    await persist()
  },
  async setBackendKind(next: BackendKind) {
    backendKind = next
    await persist()
  },
}
