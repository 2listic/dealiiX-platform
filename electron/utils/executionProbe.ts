import type {
  ExecutionSettings,
  ProbeResult,
  NodeRegistryMetadata,
  ParametersTemplateMetadata,
} from '../../src/lib/types/settingsTypes.js'

import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { connectToSSHWithKey } from './sshConnections.js'

const execFileAsync = promisify(execFile)

const shellEscape = (value: string | number) => {
  return `'${String(value).replaceAll("'", `'\\''`)}'`
}

const getExecutableParametersFileName = (
  target: ExecutionSettings['local'] | ExecutionSettings['remote']
): string => {
  return target.parametersFileName || 'parameters.json'
}

const validateExecutionSettings = (execution: ExecutionSettings): void => {
  const target = execution?.[execution.location]
  if (!target) {
    throw new Error('Invalid execution target configuration')
  }

  if (execution.location === 'remote') {
    if (!execution.remote.host || !execution.remote.username) {
      throw new Error('Remote configuration requires host and username')
    }
    if (!execution.remote.sshKeyPath) {
      throw new Error('Remote configuration requires an SSH private key')
    }
    if (!fs.existsSync(execution.remote.sshKeyPath)) {
      throw new Error('Configured SSH private key path does not exist')
    }
  }

  if (!target.workingDirectory) {
    throw new Error('A working directory is required')
  }

  if (execution.backendKind === 'coral' && !target.coralBinaryPath) {
    throw new Error('Coral backend requires a binary path')
  }
  if (execution.backendKind === 'coral' && !target.coralPluginPath) {
    throw new Error('Coral backend requires a plugin path')
  }

  if (execution.backendKind === 'executable' && !target.executablePath) {
    throw new Error('Executable backend requires an executable path')
  }
}

const fileMustExist = (filePath: string | undefined, label: string): void => {
  if (!filePath) return
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} does not exist: ${filePath}`)
  }
}

const probeLocalPaths = (execution: ExecutionSettings): void => {
  const target = execution.local
  if (execution.backendKind === 'coral') {
    fileMustExist(target.coralBinaryPath, 'Coral binary')
    if (target.coralPluginPath) {
      fileMustExist(target.coralPluginPath, 'Coral plugin')
    }
  } else {
    fileMustExist(target.executablePath, 'Executable')
  }

  if (!fs.existsSync(target.workingDirectory)) {
    throw new Error(
      `Working directory does not exist: ${target.workingDirectory}`
    )
  }
}

/**
 * @param execution
 * @returns Registry metadata from the local coral binary.
 */
const getCoralRegistryMetadataLocal = async (
  execution: ExecutionSettings
): Promise<NodeRegistryMetadata> => {
  const registryPath = path.join(
    execution.local.workingDirectory,
    'node_types.json'
  )
  await execFileAsync(
    execution.local.coralBinaryPath,
    ['-p', execution.local.coralPluginPath, 'register'],
    {
      cwd: execution.local.workingDirectory,
    }
  )

  const registryRaw = await fs.promises.readFile(registryPath, 'utf8')
  return {
    kind: 'nodeRegistry',
    data: JSON.parse(registryRaw),
  }
}

/**
 * @param execution
 * @returns Parameters template metadata from the local executable.
 */
const getExecutableTemplateMetadataLocal = async (
  execution: ExecutionSettings
): Promise<ParametersTemplateMetadata> => {
  const tempDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'dealiix-exec-probe-')
  )
  const paramsPath = path.join(
    tempDir,
    getExecutableParametersFileName(execution.local)
  )

  try {
    try {
      await execFileAsync(execution.local.executablePath, [paramsPath], {
        cwd: execution.local.workingDirectory,
      })
    } catch (error) {
      if (!fs.existsSync(paramsPath)) {
        throw error
      }
    }

    const parametersRaw = await fs.promises.readFile(paramsPath, 'utf8')
    return {
      kind: 'parametersTemplate',
      data: JSON.parse(parametersRaw),
    }
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true })
  }
}

/**
 * @param execution
 * @returns Registry metadata fetched from the remote coral binary via SSH.
 */
const getCoralRegistryMetadataRemote = async (
  execution: ExecutionSettings
): Promise<NodeRegistryMetadata> => {
  const command = [
    `cd ${shellEscape(execution.remote.workingDirectory)}`,
    `${shellEscape(execution.remote.coralBinaryPath)} -p ${shellEscape(execution.remote.coralPluginPath)} register > /dev/null 2>&1`,
    'cat node_types.json',
  ].join(' && ')

  const registryRaw = await connectToSSHWithKey(command, {
    host: execution.remote.host,
    port: execution.remote.port,
    username: execution.remote.username,
    pathToSsh: execution.remote.sshKeyPath,
  })

  return {
    kind: 'nodeRegistry',
    data: JSON.parse(registryRaw),
  }
}

/**
 * @param execution
 * @returns Parameters template metadata fetched from the remote executable via SSH.
 */
const getExecutableTemplateMetadataRemote = async (
  execution: ExecutionSettings
): Promise<ParametersTemplateMetadata> => {
  const paramsFile = `dealiix-probe-${Date.now()}-${getExecutableParametersFileName(execution.remote)}`
  const command = `cd ${shellEscape(execution.remote.workingDirectory)} && rm -f ${shellEscape(paramsFile)} && ${shellEscape(execution.remote.executablePath)} ${shellEscape(paramsFile)} > /dev/null 2>&1; probe_status=$?; if [ -f ${shellEscape(paramsFile)} ]; then cat ${shellEscape(paramsFile)}; rm -f ${shellEscape(paramsFile)}; exit 0; fi; exit $probe_status`

  const parametersRaw = await connectToSSHWithKey(command, {
    host: execution.remote.host,
    port: execution.remote.port,
    username: execution.remote.username,
    pathToSsh: execution.remote.sshKeyPath,
  })

  return {
    kind: 'parametersTemplate',
    data: JSON.parse(parametersRaw),
  }
}

/**
 * Validates execution settings, probes local paths or remote connectivity, and fetches
 * backend metadata (node registry or parameters template) depending on the backend kind.
 *
 * @param execution - The execution settings to validate and probe.
 * @returns Probe result with metadata and sync timestamp.
 * @throws {Error} If settings are invalid, required paths are missing, or the probe command fails.
 */
export const probeAndSyncExecutionSettings = async (
  execution: ExecutionSettings
): Promise<ProbeResult> => {
  validateExecutionSettings(execution)

  if (execution.location === 'local') {
    probeLocalPaths(execution)
  }

  let metadata = null
  if (execution.backendKind === 'coral') {
    metadata =
      execution.location === 'local'
        ? await getCoralRegistryMetadataLocal(execution)
        : await getCoralRegistryMetadataRemote(execution)
  } else if (execution.backendKind === 'executable') {
    metadata =
      execution.location === 'local'
        ? await getExecutableTemplateMetadataLocal(execution)
        : await getExecutableTemplateMetadataRemote(execution)
  }

  return {
    ok: true,
    message: 'Configuration validated successfully',
    metadata,
    syncedAt: new Date().toISOString(),
  }
}
