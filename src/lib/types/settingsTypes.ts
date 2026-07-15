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
  parametersFileName?: string
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
  // Probe status per backend kind for this target (paths/reachability differ per
  // target, so status is stored here; the validated payload lives in the
  // per-location registry/parameters store).
  probes: Partial<Record<BackendKind, ProbeResult>>
}

export type RemoteExecutionSettings = ExecutionTargetSettings & {
  host: string
  port: number
  username: string
  sshKeyPath: string
}

export type ExecutionSettings = {
  local: ExecutionTargetSettings
  remote: RemoteExecutionSettings
}

/**
 * A single validation outcome for one target × backend kind. Status only — the
 * heavy payload (node registry / parameters template) is routed to its own
 * per-location store, not stored here.
 */
export type ProbeResult = {
  ok: boolean
  message: string
  syncedAt?: string
}

/**
 * The renderer-facing return of a probe: the small persisted {@link ProbeResult}
 * status plus the transient {@link ExecutionMetadata} payload to apply to the
 * per-location registry/parameters store.
 */
export type ProbeResponse = {
  status: ProbeResult
  metadata: ExecutionMetadata
}

/**
 * The minimal, structured-cloneable payload sent to the probe IPC: only the
 * active target plus which location/kind it is, not the whole settings object.
 */
export type ProbeRequest = {
  location: ExecutionLocation
  backendKind: BackendKind
  target: ExecutionTargetSettings | RemoteExecutionSettings
}

export type AppSettings = {
  urlVisualizer: string
  urlRemoteServer: string
  execution: ExecutionSettings
}

const defaultExecutionTargetSettings = (): ExecutionTargetSettings => ({
  coralBinaryPath: '',
  coralPluginPath: '',
  executablePath: '',
  parametersFileName: 'parameters.json',
  workingDirectory: '',
  probes: {},
})

export const createDefaultSettings = (): AppSettings => ({
  urlVisualizer: 'http://localhost:8008',
  urlRemoteServer: 'http://localhost:8080',
  execution: {
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
  if (!exec.local || typeof exec.local !== 'object') return false
  if (!exec.remote || typeof exec.remote !== 'object') return false
  return true
}
