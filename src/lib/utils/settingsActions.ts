import type { ExecutionSettings } from '../types/settingsTypes'
import { parametersState } from '../stores/parametersStore.svelte'
import { setRegistry } from '../stores/registryStore.svelte'
import { settingsState } from '../stores/settingsStore.svelte'

/**
 * Probes the backend with the given execution settings, applies any synced metadata
 * (node registry or parameters template), and persists the settings on success.
 *
 * @param execution - The execution settings to probe and save.
 * @returns The probe result object from the backend, or an error result.
 */
export const probeAndSaveExecution = async (execution: ExecutionSettings) => {
  if (!window.electron?.invoke || !window.electron?.store) {
    return {
      ok: false,
      message:
        'Save & Sync Execution is available only in the Electron app, not in dev:vite mode.',
      warnings: [],
    }
  }

  let probeResult
  try {
    probeResult = await window.electron.invoke(
      'probe-sync-execution-settings',
      execution
    )
  } catch (error) {
    return {
      ok: false,
      message: (error as Error)?.message || 'Configuration probe failed',
      warnings: [],
    }
  }

  if (!probeResult?.ok) return probeResult

  const lastProbe = {
    ok: true,
    message: probeResult.message ?? 'Configuration saved and synchronized',
    metadataKind: probeResult.metadata?.kind ?? null,
    syncedAt: probeResult.syncedAt ?? null,
  }

  await applySyncedMetadata(probeResult)
  await settingsState.saveExecution(execution, lastProbe)
  return probeResult
}

// ── Private helpers ──

const applySyncedMetadata = async (probeResult: Record<string, unknown>) => {
  const metadata = probeResult?.metadata as
    | { kind: string; data: Record<string, unknown> }
    | undefined
  if (!metadata) return

  if (metadata.kind === 'nodeRegistry') {
    await setRegistry(metadata.data)
    return
  }

  if (metadata.kind === 'parametersTemplate') {
    parametersState.value = metadata.data as any
  }
}
