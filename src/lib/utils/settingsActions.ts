import type {
  ExecutionSettings,
  ExecutionLocation,
  ExecutionMetadata,
  BackendKind,
  ProbeResponse,
  ProbeResult,
} from '../types/settingsTypes'
import type { ParameterTree } from '../types/parameterTypes'
import { parametersState } from '../stores/parametersStore.svelte'
import { setActiveLocation as setParamsLocation } from '../stores/parametersStore.svelte'
import {
  setRegistry,
  setActiveLocation as setRegistryLocation,
} from '../stores/registryStore.svelte'
import { settingsState } from '../stores/settingsStore.svelte'
import { toastState } from '../stores/toastsStore.svelte'
import { viewModeState } from '../stores/viewModeStore.svelte'

/**
 * Probes the backend with the given execution settings, routes any synced payload
 * (node registry or parameters template) to the active location's store, records
 * the probe status for that location × backend kind, and persists the paths.
 *
 * @param execution - The execution settings to probe and save.
 * @returns The probe status, or an error status if the probe could not run.
 */
export const probeAndSaveExecution = async (
  execution: ExecutionSettings
): Promise<ProbeResult> => {
  if (!window.electron?.invoke || !window.electron?.store) {
    return {
      ok: false,
      message:
        'Validate & Sync is available only in the Electron app, not in dev:vite mode.',
    }
  }

  let response: ProbeResponse
  try {
    response = await window.electron.invoke(
      'probe-sync-execution-settings',
      execution
    )
  } catch (error) {
    return {
      ok: false,
      message: (error as Error)?.message || 'Configuration probe failed',
    }
  }

  const { status, metadata } = response
  if (!status.ok) return status

  await applySyncedMetadata(execution, metadata)
  await settingsState.saveExecutionPaths(execution)
  await settingsState.recordProbe(
    execution.location,
    execution.backendKind,
    status
  )
  if (metadata?.kind === 'parametersTemplate' && metadata.parametersFileName) {
    await settingsState.saveParametersFileName(metadata.parametersFileName)
  }
  return status
}

/**
 * Switches the active execution location (lightweight — no probe) and warns if
 * the resulting combination has never been validated. The per-location stores
 * follow `settingsState.execution.location` via a sync effect in `App.svelte`.
 *
 * @param location - The execution location to switch to.
 */
export const switchLocation = async (location: ExecutionLocation) => {
  await settingsState.setExecutionLocation(location)
  if (viewModeState.value === 'single') {
    warnIfUnvalidated(location, settingsState.execution.backendKind)
  }
}

/**
 * Switches the active mode (lightweight — no probe). `pipeline` selects the
 * pipeline view; `coral`/`executable` select the single-stage view and set the
 * backend kind, warning if the resulting combination has never been validated.
 *
 * @param mode - `'coral'`, `'executable'`, or `'pipeline'`.
 */
export const switchMode = async (mode: BackendKind | 'pipeline') => {
  if (mode === 'pipeline') {
    viewModeState.value = 'pipeline'
    return
  }
  viewModeState.value = 'single'
  await settingsState.setBackendKind(mode)
  warnIfUnvalidated(settingsState.execution.location, mode)
}

// ── Private helpers ──

const applySyncedMetadata = async (
  execution: ExecutionSettings,
  metadata: ExecutionMetadata
) => {
  if (!metadata) return

  if (metadata.kind === 'nodeRegistry') {
    setRegistryLocation(execution.location)
    await setRegistry(metadata.data)
    return
  }

  if (metadata.kind === 'parametersTemplate') {
    setParamsLocation(execution.location)
    parametersState.value = metadata.data as unknown as ParameterTree
  }
}

const warnIfUnvalidated = (
  location: ExecutionLocation,
  backendKind: BackendKind
) => {
  if (!settingsState.getProbe(location, backendKind)?.ok) {
    toastState.add({
      message: `Configuration for ${location}/${backendKind} not validated yet — open Settings and Validate & Sync.`,
      type: 'error',
    })
  }
}
