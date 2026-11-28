import type { ExecutionLocation } from '../types/settingsTypes'
import { shellEscape } from '../utils/shellEscape'

/**

 * Returns the subset of `paths` that are regular files at `location`, in one
 * round trip.
 * @param paths - Absolute paths on the location's filesystem.
 * @param location - Execution location whose filesystem is checked.
 * @returns The paths that exist, as given.
 * @throws {Error} If the check fails (IPC or SSH error).
 */
export const findExistingFiles = async (
  paths: string[],
  location: ExecutionLocation
): Promise<string[]> => {
  if (location === 'local') {
    return await window.electron.invoke('find-existing-local-files', { paths })
  } else if (location === 'remote') {
    // A single command for all paths: one SSH connection per path would trip
    // sshd's MaxStartups limit on large graphs or parameter trees.
    const output: string = await window.electron.invoke(
      'execute-ssh-with-key',
      {
        command: `for p in ${paths.map(shellEscape).join(' ')}; do [ -f "$p" ] && printf '%s\\n' "$p"; done; exit 0`,
        rejectOnNonZeroCode: true,
      }
    )
    // stdout and stderr arrive merged, so keep only lines echoing a requested path.
    const requested = new Set(paths)
    return output.split('\n').filter((line) => requested.has(line))
  }
  return []
}
