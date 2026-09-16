import { describe, expect, it, vi, beforeEach } from 'vitest'

// sshMessages.ts transitively imports several `.svelte.ts` stores that check
// `window.electron` at module-init time, so `window` must be stubbed globally
// before the module is (dynamically) imported.
const invoke = vi.fn()

vi.stubGlobal('window', {
  electron: {
    invoke,
    store: {
      get: vi.fn(async (_key: string, defaultValue: unknown) => defaultValue),
      set: vi.fn(async () => true),
      remove: vi.fn(async () => true),
    },
  },
})

const { ensureUniqueRemoteDir, submitExecutableStageRemote } = await import(
  './sshMessages'
)

beforeEach(() => {
  invoke.mockReset()
})

/**
 * Drives a stage submission with every SSH round-trip stubbed and returns the
 * uploaded `job.sh`, so the generated sbatch script can be asserted directly.
 */
const uploadedBatchScript = async (
  config: Parameters<typeof submitExecutableStageRemote>[0]['config']
): Promise<string> => {
  const uploads: Record<string, string> = {}
  invoke.mockImplementation(
    async (channel: string, payload: Record<string, string>) => {
      if (channel === 'upload-file-ssh') {
        uploads[payload.remotePath] = payload.content
        return ''
      }
      // mkdir and sbatch share a channel; only sbatch must return a job id.
      return payload.command?.startsWith('sbatch') ? '4242' : ''
    }
  )

  await submitExecutableStageRemote({
    parameters: {},
    stageDir: '/data/stage-p0',
    config,
    dependencyJobIds: [],
  })
  return uploads['/data/stage-p0/job.sh']
}

const baseExecutableConfig = {
  executablePath: '/opt/step-70',
  parametersFileName: 'parameters.json',
  nodes: 2,
  tasksPerNode: 4,
  timeLimit: '02:00:00',
  useMpi: false,
}

describe('submitExecutableStageRemote batch script', () => {
  it('omits MPI resource directives and the launcher when MPI is off', async () => {
    const script = await uploadedBatchScript(baseExecutableConfig)

    expect(script).not.toContain('--nodes=')
    expect(script).not.toContain('--ntasks-per-node=')
    expect(script).not.toContain('mpirun')
    expect(script).toContain('"/opt/step-70" "parameters.json"')
  })

  it('requests the resources and launches through mpirun when MPI is on', async () => {
    const script = await uploadedBatchScript({
      ...baseExecutableConfig,
      useMpi: true,
    })

    expect(script).toContain('#SBATCH --nodes=2')
    expect(script).toContain('#SBATCH --ntasks-per-node=4')
    // -np defers to Slurm's own rank count so the launcher cannot disagree
    // with the allocation requested above.
    expect(script).toContain(
      'mpirun --allow-run-as-root -np ${SLURM_NTASKS:-1} "/opt/step-70" "parameters.json"'
    )
  })

  it('applies the configured time limit rather than the fallback', async () => {
    const script = await uploadedBatchScript(baseExecutableConfig)

    expect(script).toContain('#SBATCH --time=02:00:00')
  })
})

describe('ensureUniqueRemoteDir', () => {
  it('returns the requested dir when it does not already exist', async () => {
    invoke.mockResolvedValueOnce('')

    const result = await ensureUniqueRemoteDir('/data/run-poisson')

    expect(result).toBe('/data/run-poisson')
    expect(invoke).toHaveBeenCalledTimes(1)
  })

  it('retries with a timestamp-suffixed dir when the first candidate collides', async () => {
    invoke.mockResolvedValueOnce('EXISTS').mockResolvedValueOnce('')

    const result = await ensureUniqueRemoteDir('/data/run-poisson')

    expect(result).toMatch(/^\/data\/run-poisson-\d+$/)
    expect(invoke).toHaveBeenCalledTimes(2)
  })

  it('throws after exhausting all retry attempts', async () => {
    invoke.mockResolvedValue('EXISTS')

    await expect(ensureUniqueRemoteDir('/data/run-poisson')).rejects.toThrow(
      'Could not allocate a unique directory under /data/run-poisson'
    )
    expect(invoke).toHaveBeenCalledTimes(3)
  })
})
