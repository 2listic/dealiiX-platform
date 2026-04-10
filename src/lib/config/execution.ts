export const EXECUTION_LOCATIONS = ['local', 'remote'] as const
export const BACKEND_KINDS = ['coral', 'executable'] as const

export type ExecutionLocation = (typeof EXECUTION_LOCATIONS)[number]
export type BackendKind = (typeof BACKEND_KINDS)[number]

export type ProbeCapabilities = {
  supportsNodeRegistry: boolean
  supportsParametersTemplate: boolean
  supportsRunWithParameters: boolean
  requiresCanvas: boolean
  requiresScheduler: boolean
}

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

export type AppSettings = {
  urlVisualizer: string
  urlRemoteServer: string
  useMpi: boolean
  execution: ExecutionSettings
  lastProbe: {
    ok: boolean
    message: string
    warnings: string[]
    metadataKind: 'nodeRegistry' | 'parametersTemplate' | null
    syncedAt: string | null
  } | null
}

type LegacySettings = Record<string, unknown>

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
  useMpi: false,
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

const asString = (value: unknown, fallback = ''): string => {
  return typeof value === 'string' ? value : fallback
}

const asBoolean = (value: unknown, fallback = false): boolean => {
  return typeof value === 'boolean' ? value : fallback
}

const asNumber = (value: unknown, fallback: number): number => {
  return typeof value === 'number' && !Number.isNaN(value) ? value : fallback
}

export const normalizeSettings = (value: unknown): AppSettings => {
  const defaults = createDefaultSettings()
  if (!value || typeof value !== 'object') {
    return defaults
  }

  const maybeSettings = value as LegacySettings

  if ('execution' in maybeSettings) {
    const execution = maybeSettings.execution as Record<string, unknown>
    const local = execution?.local as Record<string, unknown>
    const remote = execution?.remote as Record<string, unknown>
    const lastProbe = maybeSettings.lastProbe as Record<string, unknown> | null

    return {
      urlVisualizer: asString(
        maybeSettings.urlVisualizer,
        defaults.urlVisualizer
      ),
      urlRemoteServer: asString(
        maybeSettings.urlRemoteServer,
        defaults.urlRemoteServer
      ),
      useMpi: asBoolean(maybeSettings.useMpi, defaults.useMpi),
      execution: {
        location:
          execution?.location === 'local'
            ? 'local'
            : defaults.execution.location,
        backendKind:
          execution?.backendKind === 'executable'
            ? 'executable'
            : defaults.execution.backendKind,
        local: {
          coralBinaryPath: asString(
            local?.coralBinaryPath,
            defaults.execution.local.coralBinaryPath
          ),
          coralPluginPath: asString(
            local?.coralPluginPath,
            defaults.execution.local.coralPluginPath
          ),
          executablePath: asString(
            local?.executablePath,
            defaults.execution.local.executablePath
          ),
          parametersFileName: asString(
            local?.parametersFileName,
            defaults.execution.local.parametersFileName
          ),
          workingDirectory: asString(
            local?.workingDirectory,
            defaults.execution.local.workingDirectory
          ),
        },
        remote: {
          host: asString(remote?.host, defaults.execution.remote.host),
          port: asNumber(remote?.port, defaults.execution.remote.port),
          username: asString(
            remote?.username,
            defaults.execution.remote.username
          ),
          sshKeyPath: asString(
            remote?.sshKeyPath,
            defaults.execution.remote.sshKeyPath
          ),
          coralBinaryPath: asString(
            remote?.coralBinaryPath,
            defaults.execution.remote.coralBinaryPath
          ),
          coralPluginPath: asString(
            remote?.coralPluginPath,
            defaults.execution.remote.coralPluginPath
          ),
          executablePath: asString(
            remote?.executablePath,
            defaults.execution.remote.executablePath
          ),
          parametersFileName: asString(
            remote?.parametersFileName,
            defaults.execution.remote.parametersFileName
          ),
          workingDirectory: asString(
            remote?.workingDirectory,
            defaults.execution.remote.workingDirectory
          ),
        },
      },
      lastProbe: lastProbe
        ? {
            ok: asBoolean(lastProbe.ok, false),
            message: asString(lastProbe.message),
            warnings: Array.isArray(lastProbe.warnings)
              ? lastProbe.warnings.filter(
                  (item): item is string => typeof item === 'string'
                )
              : [],
            metadataKind:
              lastProbe.metadataKind === 'parametersTemplate'
                ? 'parametersTemplate'
                : lastProbe.metadataKind === 'nodeRegistry'
                  ? 'nodeRegistry'
                  : null,
            syncedAt: asString(lastProbe.syncedAt, '') || null,
          }
        : null,
    }
  }

  return {
    ...defaults,
    urlVisualizer: asString(
      maybeSettings.urlVisualizerKey,
      defaults.urlVisualizer
    ),
    urlRemoteServer: asString(
      maybeSettings.urlRemoteServerKey,
      defaults.urlRemoteServer
    ),
    useMpi: asBoolean(maybeSettings.useMpiKey, defaults.useMpi),
    execution: {
      ...defaults.execution,
      remote: {
        ...defaults.execution.remote,
        sshKeyPath: asString(
          maybeSettings.sshPathKey,
          defaults.execution.remote.sshKeyPath
        ),
      },
    },
  }
}

export const cloneSettings = (settings: AppSettings): AppSettings => {
  return JSON.parse(JSON.stringify(settings))
}

export const isExecutableBackend = (settings: AppSettings): boolean => {
  return settings.execution.backendKind === 'executable'
}

export const getActiveTargetSettings = (
  settings: AppSettings
): ExecutionTargetSettings | RemoteExecutionSettings => {
  return settings.execution[settings.execution.location]
}
