import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { PipelineStage } from '../types/pipelineTypes'

let existingFiles: string[] = []
const invoke = vi.fn(async (channel: string, args: { paths?: string[] }) => {
  if (channel === 'find-existing-local-files')
    return args.paths!.filter((p) => existingFiles.includes(p))
  return { jobId: 'unused', runDirectory: 'unused' }
})
vi.stubGlobal('window', { electron: { invoke } })

// A real map, so key allocation behaves like jobIdMapState: max recorded + 1.
const recorded = new Map<
  string,
  { internalId: number; workingDirectory?: string }
>()
vi.mock('../stores/jobsStore.svelte', () => ({
  jobIdMapState: {
    getNextKey: () =>
      recorded.size === 0
        ? 0
        : Math.max(...[...recorded.values()].map((e) => e.internalId)) + 1,
    add: async (
      schedulerId: number,
      internalId: number,
      _kind: string,
      workingDirectory?: string
    ) => {
      recorded.set(String(schedulerId), { internalId, workingDirectory })
    },
  },
}))

vi.mock('../stores/settingsStore.svelte', () => ({
  settingsState: {
    local: {
      workingDirectory: '/work',
      coralBinaryPath: '/bin/coral',
      coralPluginPath: '/lib/plugin.so',
      mpiLauncher: { kind: 'mpirun', extraArgs: '--oversubscribe' },
    },
  },
}))

vi.mock('../utils/fileReferences', () => ({
  resolveGraphFileReferences: async (graph: object) => graph,
  resolveParameterFileReferences: async (tree: object) => tree,
}))

vi.mock('../utils/sshMessages', () => ({
  withMpiPlugin: (network: object, useMpi: boolean) =>
    useMpi ? { plugin: 'mpi', ...network } : network,
}))

const { prepareStageLocal, startPreparedStage } = await import('./localStages')

const mpiOff = {
  nodes: 1,
  tasksPerNode: 3,
  timeLimit: '01:00:00',
  useMpi: false,
}

const coralStage = (id: string, useMpi = false): PipelineStage => ({
  id,
  type: 'coralStage',
  position: { x: 0, y: 0 },
  name: id,
  graph: { workflow: id },
  config: { ...mpiOff, useMpi },
})

const executableStage = (id: string, executablePath: string): PipelineStage =>
  ({
    id,
    type: 'executableStage',
    position: { x: 0, y: 0 },
    name: id,
    parameters: {},
    config: { ...mpiOff, executablePath, parametersFileName: 'p.json' },
  }) as PipelineStage

beforeEach(() => {
  recorded.clear()
  existingFiles = ['/bin/coral', '/lib/plugin.so', '/bin/exe']
  invoke.mockClear()
})

describe('prepareStageLocal', () => {
  it('gives stages submitted one after another distinct, recorded keys', async () => {
    const a = await prepareStageLocal(coralStage('a'), '/p/stage-a')
    const b = await prepareStageLocal(coralStage('b'), '/p/stage-b')

    expect(a.key).not.toBe(b.key)
    expect(recorded.get(a.key)?.workingDirectory).toBe('/p/stage-a')
    expect(recorded.get(b.key)?.workingDirectory).toBe('/p/stage-b')
  })

  it('builds the Coral start payload from the local install, with the MPI plugin and launcher', async () => {
    const prepared = await prepareStageLocal(
      coralStage('a', true),
      '/p/stage-a'
    )

    expect(prepared.channel).toBe('start-local-coral-run')
    expect(prepared.payload).toEqual({
      coralBinaryPath: '/bin/coral',
      coralPluginPath: '/lib/plugin.so',
      runDirectory: '/p/stage-a',
      graphPayload: { plugin: 'mpi', workflow: 'a' },
      mpi: {
        launcher: { kind: 'mpirun', extraArgs: '--oversubscribe' },
        processes: 3,
      },
      internalJobId: Number(prepared.key),
    })
  })

  it('rejects a missing binary, naming the stage, without recording a key', async () => {
    existingFiles = ['/bin/coral']

    await expect(
      prepareStageLocal(coralStage('a'), '/p/stage-a')
    ).rejects.toThrow('a: not found locally: /lib/plugin.so')
    expect(recorded.size).toBe(0)
  })

  it('leaves a bare command name to PATH', async () => {
    const prepared = await prepareStageLocal(
      executableStage('e', 'step-70'),
      '/p/stage-e'
    )

    expect(prepared.channel).toBe('start-local-executable-run')
    expect(invoke).not.toHaveBeenCalled()
  })

  it('rejects an executable stage with no parameters', async () => {
    const stage = {
      ...executableStage('e', '/bin/exe'),
      parameters: null,
    } as PipelineStage

    await expect(prepareStageLocal(stage, '/p/e')).rejects.toThrow(
      'Executable stage "e" has no parameters loaded'
    )
  })
})

describe('startPreparedStage', () => {
  it('invokes the prepared channel with the prepared payload', async () => {
    const prepared = await prepareStageLocal(
      executableStage('e', '/bin/exe'),
      '/p/stage-e'
    )
    invoke.mockClear()

    await startPreparedStage(prepared)

    expect(invoke).toHaveBeenCalledWith(
      'start-local-executable-run',
      prepared.payload
    )
  })
})
