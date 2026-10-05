import type { ExecutionLocation } from '../types/settingsTypes'
import { settingsState } from '../stores/settingsStore.svelte'
import { normalizeRelativeParameterPath } from './workspacePath'

export { normalizeRelativeParameterPath } from './workspacePath'

export type ParameterFileTarget = {
  location: ExecutionLocation
  workingDirectory: string
  fileName: string
}

export type ParameterFileContent = {
  content: string
  resolvedPath: string
}

const shellEscape = (value: string): string =>
  `'${String(value).replaceAll("'", `'\\''`)}'`

const remotePath = (target: ParameterFileTarget): string => {
  const relative = normalizeRelativeParameterPath(target.fileName)
  return `${target.workingDirectory.replace(/\/+$/, '')}/${relative}`
}

const remoteCommand = async (command: string, rejectOnNonZeroCode = true) =>
  window.electron.invoke('execute-ssh-with-key', {
    command,
    rejectOnNonZeroCode,
  })

/**
 * Resolves a parameter or data filename against the active execution settings.
 * @param location - Execution location containing the file.
 * @param fileName - Relative filename inside the working directory.
 * @returns Target containing the working directory and filename.
 */
export const parameterFileTarget = (
  location: ExecutionLocation,
  fileName: string
): ParameterFileTarget => ({
  location,
  workingDirectory:
    location === 'local'
      ? settingsState.local.workingDirectory
      : settingsState.remote.workingDirectory,
  fileName,
})

/**
 * Checks whether a parameter or data file exists at its target.
 * @param target - File target to check.
 * @returns Promise resolving to whether the file exists.
 */
export const parameterFileExists = async (
  target: ParameterFileTarget
): Promise<boolean> => {
  if (!target.workingDirectory) return false
  if (target.location === 'local') {
    return await window.electron.invoke('local-parameter-file-exists', {
      workingDirectory: target.workingDirectory,
      fileName: target.fileName,
    })
  }

  try {
    const filePath = remotePath(target)
    await remoteCommand(`test -f ${shellEscape(filePath)}`)
    return true
  } catch {
    return false
  }
}

/**
 * Reads a parameter or data file from its target.
 * @param target - File target to read.
 * @returns Promise resolving to file content and resolved path.
 * @throws Error when the target has no working directory or cannot be read.
 */
export const readParameterFile = async (
  target: ParameterFileTarget
): Promise<ParameterFileContent> => {
  if (!target.workingDirectory) {
    throw new Error('A working directory is required to open parameters')
  }
  if (target.location === 'local') {
    return await window.electron.invoke('read-local-parameter-file', {
      workingDirectory: target.workingDirectory,
      fileName: target.fileName,
    })
  }

  const filePath = remotePath(target)
  return {
    resolvedPath: filePath,
    content: await remoteCommand(
      `test -f ${shellEscape(filePath)} && cat ${shellEscape(filePath)}`
    ),
  }
}

/**
 * Writes content to a parameter or data file target.
 * @param target - File target to write.
 * @param content - Content to write.
 * @returns Promise resolved after the write completes.
 * @throws Error when the target has no working directory or cannot be written.
 */
export const writeParameterFile = async (
  target: ParameterFileTarget,
  content: string
): Promise<void> => {
  if (!target.workingDirectory) {
    throw new Error('A working directory is required to save parameters')
  }
  if (target.location === 'local') {
    await window.electron.invoke('write-local-parameter-file', {
      workingDirectory: target.workingDirectory,
      fileName: target.fileName,
      content,
    })
    return
  }

  const filePath = remotePath(target)
  const directory = filePath.slice(0, filePath.lastIndexOf('/'))
  await remoteCommand(`mkdir -p ${shellEscape(directory)}`)
  await window.electron.invoke('upload-file-ssh', {
    content,
    remotePath: filePath,
  })
}
