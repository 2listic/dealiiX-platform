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
  get hasRemoteServer() {
    return !!settings.urlRemoteServer
  },
  get hasVisualizer() {
    return !!settings.urlVisualizer
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
  get isExecutableMode() {
    return settings.execution.backendKind === 'executable'
  },
  get isCoralMode() {
    return settings.execution.backendKind === 'coral'
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
  async saveParametersFileName(parametersFileName: string) {
    const location = settings.execution.location
    await persistSettings({
      ...settings,
      execution: {
        ...settings.execution,
        [location]: {
          ...settings.execution[location],
          parametersFileName,
        },
      },
    })
  },
}

// ── Private helpers ──

const persistSettings = async (nextSettings: AppSettings) => {
  settings = nextSettings
  await window.electron.store.set('settings', $state.snapshot(settings))
}
