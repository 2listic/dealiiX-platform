import type {
  ProbeRequest,
  ProbeResponse,
  ExecutionTargetSettings,
  RemoteExecutionSettings,
  BackendKind,
  NodeRegistryMetadata,
  ParametersTemplateMetadata,
} from '../../src/lib/types/settingsTypes.js'

import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { connectToSSHWithKey } from './sshConnections.js'
import {
  getParameterProbeFileNames,
  parseParametersFileWithFormat,
  replaceExtension,
} from '../../src/lib/utils/parameterFileFormat.js'

const execFileAsync = promisify(execFile)

const shellEscape = (value: string | number) => {
  return `'${String(value).replaceAll("'", `'\\''`)}'`
}

const getExecutableParametersFileName = (
  target: ExecutionTargetSettings
): string => {
  return target.parametersFileName || 'parameters.json'
}

const parseExecutableParametersTemplate = (
  content: string,
  generatedFileName: string
): ParametersTemplateMetadata => {
  const parsed = parseParametersFileWithFormat(content, generatedFileName)
  return {
    kind: 'parametersTemplate',
    data: parsed.data,
    parametersFileName: replaceExtension(generatedFileName, parsed.format),
  }
}

const formatErrorMessage = (error: unknown): string => {
  return (error as Error)?.message || String(error)
}

const validateExecutionSettings = ({
  location,
  backendKind,
  target,
}: ProbeRequest): void => {
  if (!target) {
    throw new Error('Invalid execution target configuration')
  }

  if (location === 'remote') {
    const remote = target as RemoteExecutionSettings
    if (!remote.host || !remote.username) {
      throw new Error('Remote configuration requires host and username')
    }
    if (!remote.sshKeyPath) {
      throw new Error('Remote configuration requires an SSH private key')
    }
    if (!fs.existsSync(remote.sshKeyPath)) {
      throw new Error('Configured SSH private key path does not exist')
    }
  }

  if (!target.workingDirectory) {
    throw new Error('A working directory is required')
  }

  if (backendKind === 'coral' && !target.coralBinaryPath) {
    throw new Error('Coral backend requires a binary path')
  }
  if (backendKind === 'coral' && !target.coralPluginPath) {
    throw new Error('Coral backend requires a plugin path')
  }

  if (backendKind === 'executable' && !target.executablePath) {
    throw new Error('Executable backend requires an executable path')
  }
}

const fileMustExist = (filePath: string | undefined, label: string): void => {
  if (!filePath) return
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} does not exist: ${filePath}`)
  }
}

const probeLocalPaths = (
  target: ExecutionTargetSettings,
  backendKind: BackendKind
): void => {
  if (backendKind === 'coral') {
    fileMustExist(target.coralBinaryPath, 'Coral binary')
  } else if (backendKind === 'executable') {
    fileMustExist(target.executablePath, 'Executable')
  }

  if (!fs.existsSync(target.workingDirectory)) {
    throw new Error(
      `Working directory does not exist: ${target.workingDirectory}`
    )
  }
}

/**
 * @param target - The local execution target.
 * @returns Registry metadata from the local coral binary.
 */
const getCoralRegistryMetadataLocal = async (
  target: ExecutionTargetSettings
): Promise<NodeRegistryMetadata> => {
  const registryPath = path.join(target.workingDirectory, 'node_types.json')
  await execFileAsync(
    target.coralBinaryPath,
    ['-p', target.coralPluginPath, 'register'],
    {
      cwd: target.workingDirectory,
    }
  )

  const registryRaw = await fs.promises.readFile(registryPath, 'utf8')
  return {
    kind: 'nodeRegistry',
    data: JSON.parse(registryRaw),
  }
}

/**
 * @param target - The local execution target.
 * @returns Parameters template metadata from the local executable.
 */
const getExecutableTemplateMetadataLocal = async (
  target: ExecutionTargetSettings
): Promise<ParametersTemplateMetadata> => {
  const tempDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'dealiix-exec-probe-')
  )
  const candidates = getParameterProbeFileNames(
    getExecutableParametersFileName(target)
  )
  let lastError: unknown = null

  try {
    for (const paramsFile of candidates) {
      const paramsPath = path.join(tempDir, paramsFile)
      try {
        await fs.promises.mkdir(path.dirname(paramsPath), { recursive: true })

        try {
          await execFileAsync(target.executablePath, [paramsPath], {
            cwd: target.workingDirectory,
          })
        } catch (error) {
          if (!fs.existsSync(paramsPath)) {
            throw error
          }
        }

        const parametersRaw = await fs.promises.readFile(paramsPath, 'utf8')
        return parseExecutableParametersTemplate(parametersRaw, paramsFile)
      } catch (error) {
        lastError = error
      }
    }

    throw new Error(
      `Executable did not generate a readable parameters template. Tried ${candidates.join(', ')}. Last error: ${formatErrorMessage(lastError)}`
    )
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true })
  }
}

/**
 * @param target - The remote execution target.
 * @returns Registry metadata fetched from the remote coral binary via SSH.
 */
const getCoralRegistryMetadataRemote = async (
  target: RemoteExecutionSettings
): Promise<NodeRegistryMetadata> => {
  const sshConfig = {
    host: target.host,
    port: target.port,
    username: target.username,
    pathToSsh: target.sshKeyPath,
  }

  // Run coral register — stdout suppressed so the registry file is the only output later;
  // stderr flows through SSH so errors surface in the rejection message.
  await connectToSSHWithKey(
    `cd ${shellEscape(target.workingDirectory)} && ${shellEscape(target.coralBinaryPath)} -p ${shellEscape(target.coralPluginPath)} register > /dev/null`,
    sshConfig,
    { rejectOnNonZeroCode: true }
  )

  // Read the generated registry file in a separate call so its content is unambiguous.
  const registryRaw = await connectToSSHWithKey(
    `cd ${shellEscape(target.workingDirectory)} && cat node_types.json`,
    sshConfig,
    { rejectOnNonZeroCode: true }
  )

  return {
    kind: 'nodeRegistry',
    data: JSON.parse(registryRaw),
  }
}

/**
 * @param target - The remote execution target.
 * @returns Parameters template metadata fetched from the remote executable via SSH.
 */
const getExecutableTemplateMetadataRemote = async (
  target: RemoteExecutionSettings
): Promise<ParametersTemplateMetadata> => {
  const sshConfig = {
    host: target.host,
    port: target.port,
    username: target.username,
    pathToSsh: target.sshKeyPath,
  }
  const candidates = getParameterProbeFileNames(
    getExecutableParametersFileName(target)
  )
  let lastError: unknown = null

  for (const paramsFile of candidates) {
    const probeFile = `dealiix-probe-${Date.now()}-${paramsFile}`
    const probePath = `${target.workingDirectory}/${probeFile}`

    try {
      // Clean up any leftover probe file from a previous failed run.
      await connectToSSHWithKey(
        `cd ${shellEscape(target.workingDirectory)} && rm -f ${shellEscape(probeFile)}`,
        sshConfig,
        { rejectOnNonZeroCode: true }
      )

      // Run the executable — tolerate non-zero exit because some executables write the params
      // file but still exit with a non-zero code (e.g. usage errors when no other args are given).
      await connectToSSHWithKey(
        `cd ${shellEscape(target.workingDirectory)} && ${shellEscape(target.executablePath)} ${shellEscape(probeFile)}`,
        sshConfig
      )

      // Read the generated params file; fails if the executable did not create it.
      const parametersRaw = await connectToSSHWithKey(
        `cat ${shellEscape(probePath)} && rm -f ${shellEscape(probePath)}`,
        sshConfig,
        { rejectOnNonZeroCode: true }
      )

      return parseExecutableParametersTemplate(parametersRaw, paramsFile)
    } catch (error) {
      lastError = error
      try {
        await connectToSSHWithKey(`rm -f ${shellEscape(probePath)}`, sshConfig)
      } catch {
        // Best-effort cleanup only; keep the original probe failure.
      }
    }
  }

  throw new Error(
    `Executable did not generate a readable parameters template. Tried ${candidates.join(', ')}. Last error: ${formatErrorMessage(lastError)}`
  )
}

/**
 * Validates one execution target, probes local paths or remote connectivity, and fetches
 * backend metadata (node registry or parameters template) depending on the backend kind.
 *
 * @param request - The focused probe request (location, backend kind, and the one target).
 * @returns Probe result with metadata and sync timestamp, or an error result on failure.
 */
export const probeAndSyncExecutionSettings = async (
  request: ProbeRequest
): Promise<ProbeResponse> => {
  try {
    validateExecutionSettings(request)

    const { location, backendKind, target } = request

    if (location === 'local') {
      probeLocalPaths(target, backendKind)
    }

    let metadata = null
    if (backendKind === 'coral') {
      metadata =
        location === 'local'
          ? await getCoralRegistryMetadataLocal(target)
          : await getCoralRegistryMetadataRemote(
              target as RemoteExecutionSettings
            )
    } else if (backendKind === 'executable') {
      metadata =
        location === 'local'
          ? await getExecutableTemplateMetadataLocal(target)
          : await getExecutableTemplateMetadataRemote(
              target as RemoteExecutionSettings
            )
    }

    return {
      status: {
        ok: true,
        message: 'Configuration validated successfully',
        syncedAt: new Date().toISOString(),
      },
      metadata,
    }
  } catch (error) {
    return {
      status: {
        ok: false,
        message: (error as Error)?.message || 'Configuration probe failed',
      },
      metadata: null,
    }
  }
}
