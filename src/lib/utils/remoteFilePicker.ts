import { normalizeRelativeParameterPath } from './workspacePath'

const shellEscape = (value: string): string =>
  `'${String(value).replaceAll("'", `'\\''`)}'`

const requireWorkingDirectory = (workingDirectory: string): string => {
  const trimmed = workingDirectory.trim()
  if (!trimmed) {
    throw new Error('A remote working directory is required')
  }
  return trimmed
}

const joinRemotePath = (workingDirectory: string, fileName: string): string => {
  if (workingDirectory === '/') return `/${fileName}`
  return `${workingDirectory.replace(/\/+$/, '')}/${fileName}`
}

const executeRemoteCommand = async (command: string): Promise<string> => {
  if (!window.electron?.invoke) {
    throw new Error(
      'Remote file browsing is available only in the Electron app'
    )
  }

  const output = await window.electron.invoke('execute-ssh-with-key', {
    command,
    rejectOnNonZeroCode: true,
  })
  return String(output ?? '')
}

/**
 * Lists graph JSON files directly inside the configured remote working directory.
 * @param workingDirectory - Absolute directory on the remote host.
 * @returns Relative filenames suitable for the remote graph importer.
 */
export const listRemoteGraphFiles = async (
  workingDirectory: string
): Promise<string[]> => {
  const directory = requireWorkingDirectory(workingDirectory)
  const output = await executeRemoteCommand(
    `find ${shellEscape(directory)} -maxdepth 1 -type f -name '*.json' -exec basename {} \\; | sort`
  )

  return output
    .split(/\r?\n/)
    .map((fileName) => fileName.trim())
    .filter((fileName) => fileName.toLowerCase().endsWith('.json'))
}

/**
 * Reads a graph JSON file from the remote working directory.
 * @param workingDirectory - Absolute directory on the remote host.
 * @param fileName - Relative filename returned by listRemoteGraphFiles.
 * @returns The remote file contents.
 */
export const readRemoteGraphFile = async (
  workingDirectory: string,
  fileName: string
): Promise<string> => {
  const directory = requireWorkingDirectory(workingDirectory)
  const relativeName = normalizeRelativeParameterPath(fileName)
  const remotePath = joinRemotePath(directory, relativeName)
  return await executeRemoteCommand(
    `test -f ${shellEscape(remotePath)} && cat ${shellEscape(remotePath)}`
  )
}
