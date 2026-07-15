import {
  createDefaultSettings,
  isValidAppSettings,
  type AppSettings,
  type ExecutionSettings,
  type ExecutionLocation,
  type BackendKind,
  type ProbeResult,
} from '../types/settingsTypes'
import { toastState } from './toastsStore.svelte'

let settings = $state(createDefaultSettings())

// Load initial settings from electron-store.
const loadSettings = async () => {
  if (window.electron?.store) {
    const storedSettings = await window.electron.store.get('settings')
    if (storedSettings === undefined) {
      // Key absent — first launch or isolated E2E store. Silently use defaults.
      settings = createDefaultSettings()
    } else if (isValidAppSettings(storedSettings)) {
      settings = normalizeProbes(storedSettings)
    } else {
      // Key present but schema is wrong (e.g. after an app upgrade).
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
  get activeParametersFileName() {
    return settings.execution[settings.execution.location].parametersFileName
  },
  /** Probe status recorded for the currently-active location × backend kind. */
  get activeProbe(): ProbeResult | undefined {
    const { location, backendKind } = settings.execution
    return settings.execution[location].probes?.[backendKind]
  },
  /** Probe status recorded for a specific location × backend kind. */
  getProbe(
    location: ExecutionLocation,
    backendKind: BackendKind
  ): ProbeResult | undefined {
    return settings.execution[location].probes?.[backendKind]
  },
  async saveUrlVisualizer(url: string) {
    await persistSettings({ ...settings, urlVisualizer: url })
  },
  async saveUrlRemoteServer(url: string) {
    await persistSettings({ ...settings, urlRemoteServer: url })
  },
  /** Lightweight mode switch: persist just the execution location (no probe). */
  async setExecutionLocation(location: ExecutionLocation) {
    await persistSettings({
      ...settings,
      execution: { ...settings.execution, location },
    })
  },
  /** Lightweight mode switch: persist just the backend kind (no probe). */
  async setBackendKind(backendKind: BackendKind) {
    await persistSettings({
      ...settings,
      execution: { ...settings.execution, backendKind },
    })
  },
  /** Persist the edited path fields, preserving each target's probe status. */
  async saveExecutionPaths(execution: ExecutionSettings) {
    await persistSettings({
      ...settings,
      execution: {
        ...execution,
        local: { ...execution.local, probes: settings.execution.local.probes },
        remote: {
          ...execution.remote,
          probes: settings.execution.remote.probes,
        },
      },
    })
  },
  /** Record a probe outcome into the given location × backend kind slot. */
  async recordProbe(
    location: ExecutionLocation,
    backendKind: BackendKind,
    status: ProbeResult
  ) {
    const target = settings.execution[location]
    await persistSettings({
      ...settings,
      execution: {
        ...settings.execution,
        [location]: {
          ...target,
          probes: { ...target.probes, [backendKind]: status },
        },
      },
    })
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

// Backfill the per-target `probes` map for settings persisted before it existed.
const normalizeProbes = (stored: AppSettings): AppSettings => ({
  ...stored,
  execution: {
    ...stored.execution,
    local: {
      ...stored.execution.local,
      probes: stored.execution.local.probes ?? {},
    },
    remote: {
      ...stored.execution.remote,
      probes: stored.execution.remote.probes ?? {},
    },
  },
})
