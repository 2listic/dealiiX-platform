import type {
  ExecutionSettings,
  ExecutionLocation,
  ExecutionMetadata,
  BackendKind,
  ProbeRequest,
  ProbeResponse,
  ProbeResult,
} from '../types/settingsTypes'
import type { ParameterTree } from '../types/parameterTypes'
import { setValueFor as setParamsFor } from '../stores/parametersStore.svelte'
import { setRegistry } from '../stores/registryStore.svelte'
import { settingsState } from '../stores/settingsStore.svelte'
import { toastState } from '../stores/toastsStore.svelte'

/**
 * Probes the given target, routes any synced payload (node registry or parameters
 * template) to the location's store, records the probe status for that
 * location × backend kind, and persists the paths.
 *
 * @param location - The execution location being validated.
 * @param backendKind - The backend kind being validated.
 * @param execution - The full runner config (both targets) to persist.
 * @returns The probe status, or an error status if the probe could not run.
 */
export const probeAndSaveExecution = async (
  location: ExecutionLocation,
  backendKind: BackendKind,
  execution: ExecutionSettings
): Promise<ProbeResult> => {
  if (!window.electron?.invoke || !window.electron?.store) {
    return {
      outcome: 'error',
      message:
        'Validate & Sync is available only in the Electron app, not in dev:vite mode.',
    }
  }

  // Send only the active target (not the whole settings object) so the probe IPC
  // is decoupled from the full settings shape.
  const request: ProbeRequest = {
    location,
    backendKind,
    target: execution[location],
  }

  let response: ProbeResponse
  try {
    response = await window.electron.invoke(
      'probe-sync-execution-settings',
      request
    )
  } catch (error) {
    return {
      outcome: 'error',
      message: (error as Error)?.message || 'Configuration probe failed',
    }
  }

  const { status, metadata } = response
  if (status.outcome === 'error') return status

  await applySyncedMetadata(location, metadata)
  await settingsState.saveExecutionPaths(execution)
  await settingsState.recordProbe(location, backendKind, status)
  if (metadata?.kind === 'parametersTemplate' && metadata.parametersFileName) {
    await settingsState.saveParametersFileName(
      location,
      metadata.parametersFileName
    )
  }
  return status
}

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
 * recorded yet, pointing the user to Settings. Call after a mode/location switch.
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
      message: `Configuration for ${location}/${backendKind} not validated yet — open Settings and Validate & Sync.`,
      type: 'error',
    })
  }
}

// ── Private helpers ──

const applySyncedMetadata = async (
  location: ExecutionLocation,
  metadata: ExecutionMetadata
) => {
  if (!metadata) return

  if (metadata.kind === 'nodeRegistry') {
    await setRegistry(metadata.data, location)
    return
  }

  if (metadata.kind === 'parametersTemplate') {
    setParamsFor(location, metadata.data as unknown as ParameterTree)
  }
}
