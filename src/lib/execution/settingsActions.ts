import type {
  BackendKind,
  ExecutionLocation,
  ProbeResult,
} from '../types/settingsTypes'
import { settingsState } from '../stores/settingsStore.svelte'
import { toastState } from '../stores/toastsStore.svelte'

/**
 * Whether a recorded probe counts as validated. A `warning` does: the target
 * synced, so the combination is usable — only some part of it will fail later.
 *
 * @param probe - The recorded probe result, or undefined if never probed.
 * @returns True when the combination has been validated.
 */
export const isProbeValidated = (probe?: ProbeResult): boolean =>
  probe?.outcome === 'success' || probe?.outcome === 'warning'

/**
 * Toasts a hint when the given location × backend kind has no successful probe
 * recorded yet. Call after a mode/location switch.
 *
 * @param location - The execution location just selected.
 * @param backendKind - The backend kind just selected.
 */
export const warnIfUnvalidated = (
  location: ExecutionLocation,
  backendKind: BackendKind
) => {
  if (!isProbeValidated(settingsState.getProbe(location, backendKind))) {
    toastState.add({
      message: `Configuration for ${location}/${backendKind} is unavailable. Start the editor with a workflow backend.`,
      type: 'error',
    })
  }
}
