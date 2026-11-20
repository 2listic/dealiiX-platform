import { execFile } from 'child_process'
import { promisify } from 'util'
import { describe, expect, it } from 'vitest'
import { printOutputOnlyOnFailure, shellEscape } from './shellEscape'

const execFileAsync = promisify(execFile)

/** Runs a script with `sh -c`, returning its exit code and stdout. */
const runSh = async (
  script: string
): Promise<{ code: number; stdout: string }> => {
  try {
    const { stdout } = await execFileAsync('sh', ['-c', script])
    return { code: 0, stdout }
  } catch (error) {
    const failed = error as { code: number; stdout: string }
    return { code: failed.code, stdout: failed.stdout }
  }
}

describe('printOutputOnlyOnFailure', () => {
  it('prints nothing when the command succeeds', async () => {
    const result = await runSh(
      printOutputOnlyOnFailure('echo registered; echo warning >&2')
    )

    expect(result).toEqual({ code: 0, stdout: '' })
  })

  it('prints stdout and stderr and keeps the exit code when it fails', async () => {
    const result = await runSh(
      printOutputOnlyOnFailure(
        'echo "plugin not found"; echo detail >&2; exit 3'
      )
    )

    expect(result).toEqual({ code: 3, stdout: 'plugin not found\ndetail\n' })
  })

  it('keeps a quoted argument as one word', async () => {
    const result = await runSh(
      printOutputOnlyOnFailure(
        `printf '%s\\n' ${shellEscape("it's $HOME")}; exit 1`
      )
    )

    expect(result).toEqual({ code: 1, stdout: "it's $HOME\n" })
  })
})
