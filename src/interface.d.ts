import type {
  ExecutionReply,
  ExecutionRequest,
} from './lib/types/executionService'

// Electron API types exposed over the context bridge
export interface ElectronAPI {
  workflow: {
    enabled(): Promise<boolean>
    openWorkflow(): Promise<string | null>
    openConfiguration(): Promise<void>
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
