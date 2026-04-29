export const EXECUTION_LOCATIONS = ['local', 'remote'] as const
export const BACKEND_KINDS = ['coral', 'executable'] as const

export type ExecutionLocation = (typeof EXECUTION_LOCATIONS)[number]
export type BackendKind = (typeof BACKEND_KINDS)[number]

export type NodeRegistryMetadata = {
  kind: 'nodeRegistry'
  data: Record<string, unknown>
}

export type ParametersTemplateMetadata = {
  kind: 'parametersTemplate'
  data: Record<string, unknown>
}

export type ExecutionMetadata =
  | NodeRegistryMetadata
  | ParametersTemplateMetadata
  | null

export type ExecutionTargetSettings = {
  coralBinaryPath: string
  coralPluginPath: string
  executablePath: string
  parametersFileName: string
  workingDirectory: string
}

export type RemoteExecutionSettings = ExecutionTargetSettings & {
  host: string
  port: number
  username: string
  sshKeyPath: string
}

export type ExecutionSettings = {
  location: ExecutionLocation
  backendKind: BackendKind
  local: ExecutionTargetSettings
  remote: RemoteExecutionSettings
}

export type ProbeResult = {
  ok: boolean
  message: string
  metadata?: ExecutionMetadata
  syncedAt?: string
}

export type AppSettings = {
  urlVisualizer: string
  urlRemoteServer: string
  execution: ExecutionSettings
  lastProbe: ProbeResult | null
}

const defaultExecutionTargetSettings = (): ExecutionTargetSettings => ({
  coralBinaryPath: '',
  coralPluginPath: '',
  executablePath: '',
  parametersFileName: 'parameters.json',
  workingDirectory: '',
})

export const createDefaultSettings = (): AppSettings => ({
  urlVisualizer: '',
  urlRemoteServer: '',
  execution: {
    location: 'remote',
    backendKind: 'coral',
    local: defaultExecutionTargetSettings(),
    remote: {
      ...defaultExecutionTargetSettings(),
      host: 'localhost',
      port: 2222,
      username: 'root',
      sshKeyPath: '',
      workingDirectory: '/app/shared-data',
      coralBinaryPath: '/app/build/core/coral',
      coralPluginPath: '/app/build/backends/dealii/libcoral_backend_dealii.so',
    },
  },
  lastProbe: null,
})

/**
 * Checks whether a value loaded from disk has the expected AppSettings structure.
 * Returns false for any malformed or legacy-format data.
 *
 * @param value - The raw value read from the electron store.
 * @returns True if the value is a structurally valid AppSettings.
 */
export const isValidAppSettings = (value: unknown): value is AppSettings => {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  if (!v.execution || typeof v.execution !== 'object') return false
  const exec = v.execution as Record<string, unknown>
  if (exec.location !== 'local' && exec.location !== 'remote') return false
  if (exec.backendKind !== 'coral' && exec.backendKind !== 'executable')
    return false
  return true
}
