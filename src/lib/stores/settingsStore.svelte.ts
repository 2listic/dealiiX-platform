import {
  createDefaultSettings,
  getActiveTargetSettings,
  isExecutableBackend,
  normalizeSettings,
  type AppSettings,
} from '../config/execution'
import { setRegistry } from './registryStore.svelte'
import { parametersState } from './parametersStore.svelte'

let settings = $state(createDefaultSettings())
let isSaving = $state(false)

// Load initial settings from electron-store.
const loadSettings = async () => {
  if (window.electron?.store) {
    const storedSettings = await window.electron.store.get('settings', {})
    settings = normalizeSettings(storedSettings)
  } else {
    console.warn('Electron store not available (e.g., dev:vite mode)')
  }
}
loadSettings()

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

const persistSettings = async (nextSettings: AppSettings) => {
  settings = normalizeSettings(nextSettings)
  await window.electron.store.set('settings', $state.snapshot(settings))
}

export const settingsState = {
  get current() {
    return settings
  },
  get saving() {
    return isSaving
  },
  get activeExecution() {
    return settings.execution
  },
  get activeTarget() {
    return getActiveTargetSettings(settings)
  },
  isExecutableMode() {
    return isExecutableBackend(settings)
  },
  async save(nextSettings: AppSettings) {
    await persistSettings(nextSettings)
  },
  async finalizeDraft(nextDraft: AppSettings) {
    isSaving = true
    try {
      const normalizedDraft = normalizeSettings(nextDraft)
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
          normalizedDraft.execution
        )
      } catch (error) {
        return {
          ok: false,
          message: (error as Error)?.message || 'Configuration probe failed',
          warnings: [],
        }
      }

      if (!probeResult?.ok) {
        return probeResult
      }

      normalizedDraft.lastProbe = {
        ok: true,
        message: probeResult.message ?? 'Configuration saved and synchronized',
        metadataKind: probeResult.metadata?.kind ?? null,
        syncedAt: probeResult.syncedAt ?? null,
      }

      await applySyncedMetadata(probeResult)
      await persistSettings(normalizedDraft)
      return probeResult
    } finally {
      isSaving = false
    }
  },
}
