import type {
  ExecutionSettings,
  ExecutionLocation,
  ExecutionMetadata,
  ParametersTemplateMetadata,
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
import { mergeWorkingDirectoryParameters } from './parametersFileActions'

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

  // Paths first: reading a remote parameters file goes through SSH, which takes
  // its connection from the saved settings.
  await settingsState.saveExecutionPaths(execution)
  await applySyncedMetadata(location, metadata, execution)
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
  metadata: ExecutionMetadata,
  execution: ExecutionSettings
) => {
  if (!metadata) return

  if (metadata.kind === 'nodeRegistry') {
    await setRegistry(metadata.data, location)
    return
  }

  if (metadata.kind === 'parametersTemplate') {
    setParamsFor(
      location,
      await withWorkingDirectoryValues(location, metadata, execution)
    )
  }
}

// Values from the working directory's parameters file, merged onto the template.
// The name typed in Settings comes first, then the one the probe reports, which
// may differ in extension (it tries JSON first) and is the one Save writes to.
const withWorkingDirectoryValues = async (
  location: ExecutionLocation,
  metadata: ParametersTemplateMetadata,
  execution: ExecutionSettings
): Promise<ParameterTree> => {
  const template = metadata.data as unknown as ParameterTree
  const { workingDirectory, parametersFileName } = execution[location]
  if (!workingDirectory) return template
  const fileNames = [
    parametersFileName || 'parameters.json',
    metadata.parametersFileName ?? '',
  ]
  try {
    const result = await mergeWorkingDirectoryParameters(
      location,
      workingDirectory,
      fileNames,
      template
    )
    if (result) {
      toastState.add({
        message: `Loaded parameter values from ${result.resolvedPath}`,
        type: 'success',
      })
      return result.parameters
    }
    toastState.add({
      message: `No ${fileNames[0]} in the working directory: using the executable's defaults`,
      type: 'info',
    })
  } catch (error) {
    toastState.add({
      message: `Could not load ${fileNames[0]}: ${(error as Error)?.message}. Using the executable's defaults`,
      type: 'error',
    })
  }
  return template
}
