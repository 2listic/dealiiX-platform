import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { connectToSSHWithKey } from './sshConnections.js'

const execFileAsync = promisify(execFile)

const buildCapabilities = (execution) => ({
  supportsNodeRegistry: execution.backendKind === 'coral',
  supportsParametersTemplate: execution.backendKind === 'executable',
  supportsRunWithParameters: true,
  requiresCanvas: execution.backendKind === 'coral',
  requiresScheduler: execution.location === 'remote',
})

const shellEscape = (value) => {
  return `'${String(value).replaceAll("'", `'\\''`)}'`
}

const resolveWorkingDirectory = (target, backendKind) => {
  if (target.workingDirectory) return target.workingDirectory
  if (backendKind === 'coral' && target.coralBinaryPath) {
    return path.dirname(target.coralBinaryPath)
  }
  if (backendKind === 'executable' && target.executablePath) {
    return path.dirname(target.executablePath)
  }
  return ''
}

const validateExecutionSettings = (execution) => {
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

  const resolvedWorkingDirectory = resolveWorkingDirectory(
    target,
    execution.backendKind
  )

  if (!resolvedWorkingDirectory) {
    throw new Error('A working directory is required')
  }
  target.workingDirectory = resolvedWorkingDirectory

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

const fileMustExist = (filePath, label) => {
  if (!filePath) return
  if (!fs.existsSync(filePath)) {
    throw new Error(`${label} does not exist: ${filePath}`)
  }
}

const probeLocalPaths = (execution) => {
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

const getCoralRegistryMetadataLocal = async (execution) => {
  const registryPath = path.join(execution.local.workingDirectory, 'node_types.json')
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

const getExecutableTemplateMetadataLocal = async (execution) => {
  const tempDir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), 'dealiix-exec-probe-')
  )
  const paramsPath = path.join(tempDir, 'parameters.json')

  try {
    await execFileAsync(execution.local.executablePath, [paramsPath], {
      cwd: execution.local.workingDirectory,
    })

    const parametersRaw = await fs.promises.readFile(paramsPath, 'utf8')
    return {
      kind: 'parametersTemplate',
      data: JSON.parse(parametersRaw),
    }
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true })
  }
}

const getCoralRegistryMetadataRemote = async (execution) => {
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

const buildWarnings = (execution) => {
  const warnings = []
  if (execution.location === 'remote') {
    warnings.push(
      'Remote probe is currently limited to static configuration validation in this branch.'
    )
  }
  return warnings
}

export const probeAndSyncExecutionSettings = async (execution) => {
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
  } else if (
    execution.location === 'local' &&
    execution.backendKind === 'executable'
  ) {
    metadata = await getExecutableTemplateMetadataLocal(execution)
  }

  const warnings = buildWarnings(execution).filter((warning) => {
    if (
      warning.includes('Remote probe is currently limited') &&
      execution.backendKind === 'coral'
    ) {
      return false
    }
    return true
  })

  return {
    ok: true,
    message: 'Configuration validated successfully',
    warnings,
    capabilities: buildCapabilities(execution),
    metadata,
    syncedAt: new Date().toISOString(),
  }
}
