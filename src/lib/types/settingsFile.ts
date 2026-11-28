import type { BackendIdentity } from './nodeTypes'
import type { ParameterTree } from './parameterTypes'

export type SettingsTarget = Pick<
  BackendIdentity,
  'id' | 'plugin' | 'version' | 'plugins'
>
export type BackendSettingsDocument = {
  backend: SettingsTarget
  configuration: ParameterTree
}
export type SettingsDraft = {
  parameters: ParameterTree
  target?: SettingsTarget
}
