import {
  createDefaultSettings,
  isValidAppSettings,
  type AppSettings,
  type ExecutionSettings,
} from '../types/settingsTypes'
import { toastState } from './toastsStore.svelte'

let settings = $state(createDefaultSettings())

// Load initial settings from electron-store.
const loadSettings = async () => {
  if (window.electron?.store) {
    const storedSettings = await window.electron.store.get('settings', {})
    if (isValidAppSettings(storedSettings)) {
      settings = storedSettings
    } else {
      settings = createDefaultSettings()
      toastState.add({
        message: 'Saved settings were invalid or outdated — defaults restored.',
        type: 'error',
      })
    }
  } else {
    console.warn('Electron store not available (e.g., dev:vite mode)')
  }
}
loadSettings()

export const settingsState = {
  get current() {
    return settings
  },
  get urlVisualizer() {
    return settings.urlVisualizer
  },
  get urlRemoteServer() {
    return settings.urlRemoteServer
  },
  get execution() {
    return settings.execution
  },
  get remote() {
    return settings.execution.remote
  },
  get local() {
    return settings.execution.local
  },
  isExecutableMode() {
    return settings.execution.backendKind === 'executable'
  },
  async saveUrlVisualizer(url: string) {
    await persistSettings({ ...settings, urlVisualizer: url })
  },
  async saveUrlRemoteServer(url: string) {
    await persistSettings({ ...settings, urlRemoteServer: url })
  },
  async saveExecution(
    execution: ExecutionSettings,
    lastProbe: NonNullable<AppSettings['lastProbe']>
  ) {
    await persistSettings({ ...settings, execution, lastProbe })
  },
}

// ── Private helpers ──

const persistSettings = async (nextSettings: AppSettings) => {
  settings = nextSettings
  await window.electron.store.set('settings', $state.snapshot(settings))
}
