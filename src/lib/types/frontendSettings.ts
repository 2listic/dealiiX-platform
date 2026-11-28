import type { RegistryDocument } from './executionService'
import type { ParameterLeaf } from './parameterTypes'

export type FrontendTheme = 'auto' | 'light' | 'dark'

export type FrontendPreferences = {
  'Backend command': ParameterLeaf
  'Backend configuration file': ParameterLeaf
  'Workflow directory'?: ParameterLeaf
  Theme: ParameterLeaf & { value: FrontendTheme }
  'VTK visualizer URL': ParameterLeaf
  'Project server URL': ParameterLeaf
}

export type FrontendSettingsSnapshot = {
  configuration: FrontendPreferences
  warning?: string
}

export type FrontendSettingsSave = FrontendSettingsSnapshot & {
  registry: RegistryDocument | null
  backendChanged: boolean
}
