import type {
  ExecutionReply,
  ExecutionRequest,
  RegistryDocument,
} from './lib/types/executionService'
import type {
  FrontendSettingsSave,
  FrontendSettingsSnapshot,
  FrontendTheme,
} from './lib/types/frontendSettings'
import type { ParameterTree } from './lib/types/parameterTypes'

// Electron API types exposed over the context bridge
export interface ElectronAPI {
  frontendSettings: {
    get(): Promise<FrontendSettingsSnapshot>
    save(configuration: ParameterTree): Promise<FrontendSettingsSave>
    setTheme(theme: FrontendTheme): Promise<FrontendSettingsSave>
  }
  workflow: {
    enabled(): Promise<boolean>
    openWorkflow(): Promise<string | null>
    readConfiguration(): Promise<{
      parameters: ParameterTree
      revision: string
    }>
    saveConfiguration(
      parameters: ParameterTree,
      revision: string
    ): Promise<RegistryDocument>
    exchange(request: ExecutionRequest): Promise<ExecutionReply>
    subscribe(listener: (response: ExecutionReply) => void): () => void
  }
  send(channel: string, data?: unknown): void
  on(channel: string, func: (...args: any[]) => void): void
  invoke(channel: string, data?: unknown): Promise<any>
  getFilePath(file: File): string
  store: {
    get(key: string, defaultValue?: any): Promise<any>
    set(key: string, value: any): Promise<boolean>
    remove(key: string): Promise<boolean>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
