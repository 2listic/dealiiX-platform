import type { ExecutionLocation } from '../types/settingsTypes'
import { settingsState } from '../stores/settingsStore.svelte'

export type ParameterFileTarget = {
  location: ExecutionLocation
  workingDirectory: string
  fileName: string
}

export type ParameterFileContent = {
  content: string
  resolvedPath: string
}

/** Normalises a relative POSIX path and rejects traversal outside its root. */
export const normalizeRelativeParameterPath = (fileName: string): string => {
  const normalized = fileName.trim().replaceAll('\\', '/')
  if (
    !normalized ||
    normalized.startsWith('/') ||
    /^[A-Za-z]:\//.test(normalized)
  ) {
    throw new Error(
      'Parameter file names must be relative to the working directory'
    )
  }

  const parts: string[] = []
  for (const part of normalized.split('/')) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (parts.length === 0) {
        throw new Error(
          'Parameter file must remain inside the working directory'
        )
      }
      parts.pop()
    } else {
      parts.push(part)
    }
  }
  if (parts.length === 0) throw new Error('Parameter file name is empty')
  return parts.join('/')
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
