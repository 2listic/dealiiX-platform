import type {
  FrontendSettingsSave,
  FrontendSettingsSnapshot,
  FrontendTheme,
} from '../types/frontendSettings'
import type { ParameterTree } from '../types/parameterTypes'
import { workflowService } from './workflowService.svelte'
import { auth } from './auth.svelte'
import { currentProjectState } from './currentProjectStore.svelte'
import { toastState } from './toastsStore.svelte'

let configuration = $state<FrontendSettingsSnapshot['configuration']>()
let browserTheme = $state<FrontendTheme>('auto')

async function load() {
  const bridge = globalThis.window?.electron?.frontendSettings
  if (!bridge) return
  const saved = await bridge.get()
  configuration = saved.configuration
  if (saved.warning) toastState.add({ message: saved.warning, type: 'error' })
}

void load()

async function applySavedSettings(saved: FrontendSettingsSave) {
  if (
    configuration?.['Project server URL'].value !==
    saved.configuration['Project server URL'].value
  ) {
    currentProjectState.clear()
    await auth.clearToken()
  }
  configuration = saved.configuration
  workflowService.adoptBackend(saved.registry, saved.backendChanged)
}

export const frontendSettingsState = {
  get theme() {
    return configuration?.Theme.value ?? browserTheme
  },
  get visualizerUrl() {
    return configuration?.['VTK visualizer URL'].value ?? ''
  },
  get projectServerUrl() {
    return configuration?.['Project server URL'].value ?? ''
  },
  async getConfiguration() {
    const bridge = window.electron?.frontendSettings
    if (!bridge)
      throw new Error('Frontend Settings are available in the desktop app.')
    return (await bridge.get()).configuration
  },
  changesBackend(draft: ParameterTree) {
    return (['Backend command', 'Backend configuration file'] as const).some(
      (key) => {
        const previous = configuration?.[key]
        const value = draft[key]
        return (
          previous &&
          value &&
          typeof value === 'object' &&
          value.value !== previous.value
        )
      }
    )
  },
  async save(draft: ParameterTree) {
    const saved = await window.electron.frontendSettings.save(draft)
    await applySavedSettings(saved)
  },
  async setTheme(theme: FrontendTheme) {
    const bridge = window.electron?.frontendSettings
    if (!bridge) {
      browserTheme = theme
      return
    }
    await applySavedSettings(await bridge.setTheme(theme))
  },
}
