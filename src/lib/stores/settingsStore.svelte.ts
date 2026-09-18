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
      settings = normalizeStoredSettings(storedSettings)
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
  /** Parameters file name configured for the given location's target. */
  getParametersFileName(location: ExecutionLocation): string {
    return settings.execution[location].parametersFileName
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
  async saveParametersFileName(
    location: ExecutionLocation,
    parametersFileName: string
  ) {
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

// Backfill per-target fields added after settings were first persisted. Defaults
// come from createDefaultSettings so they are never spelled out twice.
const normalizeStoredSettings = (stored: AppSettings): AppSettings => {
  const defaults = createDefaultSettings()

  return {
    ...stored,
    execution: {
      ...stored.execution,
      local: {
        ...stored.execution.local,
        mpiLauncher:
          stored.execution.local.mpiLauncher ??
          defaults.execution.local.mpiLauncher,
        probes: currentProbes(stored.execution.local.probes),
      },
      remote: {
        ...stored.execution.remote,
        mpiLauncher:
          stored.execution.remote.mpiLauncher ??
          defaults.execution.remote.mpiLauncher,
        probes: currentProbes(stored.execution.remote.probes),
      },
    },
  }
}

// Keeps only the probes carrying an `outcome`. Ones recorded before that field
// existed are dropped rather than translated, so the combination reads as
// unvalidated until Validate & Sync runs again.
const currentProbes = (
  stored: Partial<Record<BackendKind, ProbeResult>> | undefined
): Partial<Record<BackendKind, ProbeResult>> =>
  Object.fromEntries(
    Object.entries(stored ?? {}).filter(([, probe]) => probe?.outcome)
  )
