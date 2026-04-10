import {
  cloneSettings,
  createDefaultSettings,
  getActiveTargetSettings,
  isExecutableBackend,
  normalizeSettings,
} from '../config/execution'
import { setRegistry } from './nodes.svelte'
import { parametersState } from './parametersStore.svelte'

let settings = $state(createDefaultSettings())
let draftSettings = $state(createDefaultSettings())
let isSaving = $state(false)

// Load initial settings from electron-store.
const loadSettings = async () => {
  if (window.electron?.store) {
    const storedSettings = await window.electron.store.get('settings', {})
    settings = normalizeSettings(storedSettings)
    const storedDraft = await window.electron.store.get('settingsDraft', null)
    draftSettings = storedDraft
      ? normalizeSettings(storedDraft)
      : cloneSettings(settings)
  } else {
    console.warn('Electron store not available (e.g., dev:vite mode)')
  }
}
loadSettings()

export const SSH_PATH = 'sshPathKey'
export const URL_VISUALIZER = 'urlVisualizerKey'
export const URL_REMOTE_SERVER = 'urlRemoteServerKey'
export const USE_MPI = 'useMpiKey'

const getLegacyKey = (currentSettings, key) => {
  switch (key) {
    case SSH_PATH:
      return currentSettings.execution.remote.sshKeyPath
    case URL_VISUALIZER:
      return currentSettings.urlVisualizer
    case URL_REMOTE_SERVER:
      return currentSettings.urlRemoteServer
    case USE_MPI:
      return currentSettings.useMpi
    default:
      return undefined
  }
}

const setLegacyKey = (currentSettings, key, value) => {
  const nextSettings = cloneSettings(currentSettings)
  switch (key) {
    case SSH_PATH:
      nextSettings.execution.remote.sshKeyPath = value
      break
    case URL_VISUALIZER:
      nextSettings.urlVisualizer = value
      break
    case URL_REMOTE_SERVER:
      nextSettings.urlRemoteServer = value
      break
    case USE_MPI:
      nextSettings.useMpi = value
      break
    default:
      break
  }
  return nextSettings
}

const applySyncedMetadata = async (probeResult) => {
  const metadata = probeResult?.metadata
  if (!metadata) return

  if (metadata.kind === 'nodeRegistry') {
    await setRegistry(metadata.data)
    return
  }

  if (metadata.kind === 'parametersTemplate') {
    parametersState.value = metadata.data
  }
}

const persistSettings = async (nextSettings) => {
  settings = normalizeSettings(nextSettings)
  draftSettings = cloneSettings(settings)
  await window.electron.store.set('settings', $state.snapshot(settings))
  await window.electron.store.set('settingsDraft', $state.snapshot(draftSettings))
}

const persistDraftSettings = async (nextDraft) => {
  draftSettings = normalizeSettings(nextDraft)
  if (!window.electron?.store) return
  await window.electron.store.set('settingsDraft', $state.snapshot(draftSettings))
}

export const settingsState = {
  get current() {
    return settings
  },
  get draft() {
    return draftSettings
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
  getKey(key) {
    return getLegacyKey(settings, key)
  },
  async setKey(key, value) {
    const nextSettings = setLegacyKey(settings, key, value)
    await persistSettings(nextSettings)
  },
  resetDraft() {
    draftSettings = cloneSettings(settings)
  },
  async setDraft(nextDraft) {
    await persistDraftSettings(nextDraft)
  },
  async finalizeDraft(nextDraft) {
    isSaving = true
    try {
      const normalizedDraft = normalizeSettings(nextDraft)
      await persistDraftSettings(normalizedDraft)
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
          message: error?.message || 'Configuration probe failed',
          warnings: [],
        }
      }

      if (!probeResult?.ok) {
        return probeResult
      }

      normalizedDraft.lastProbe = {
        ok: true,
        message: probeResult.message ?? 'Configuration saved and synchronized',
        warnings: probeResult.warnings ?? [],
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
