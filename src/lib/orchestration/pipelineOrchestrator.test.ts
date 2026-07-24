import { describe, expect, it, vi, beforeEach } from 'vitest'
import { JobStatus } from '../types/jobTypes'
import type { Pipeline, PipelineStage } from '../types/pipelineTypes'

const submits: { id: string; deps: string[] }[] = []
let submitCounter = 100
let pollResult: string = JobStatus.COMPLETED

const submitCoralStageRemote = vi.fn(
  async ({ dependencyJobIds }: { dependencyJobIds: string[] }) => {
    const slurmId = String(submitCounter++)
    submits.push({ id: slurmId, deps: [...dependencyJobIds] })
    return slurmId
  }
)
const submitExecutableStageRemote = vi.fn(
  async ({ dependencyJobIds }: { dependencyJobIds: string[] }) => {
    const slurmId = String(submitCounter++)
    submits.push({ id: slurmId, deps: [...dependencyJobIds] })
    return slurmId
  }
)
const jobPolling = vi.fn(async (..._args: never[]) => pollResult)
// Echoes the requested directory back unchanged by default; tests that care about
// collision-suffix behavior override this per-test.
const ensureUniqueRemoteDir = vi.fn(async (dir: string) => dir)

vi.mock('../utils/sshMessages', () => ({
  submitCoralStageRemote: (args: never) => submitCoralStageRemote(args),
  submitExecutableStageRemote: (args: never) =>
    submitExecutableStageRemote(args),
  jobPolling: (...args: never[]) => jobPolling(...args),
  ensureUniqueRemoteDir: (dir: string) => ensureUniqueRemoteDir(dir),
}))

vi.mock('../stores/settingsStore.svelte', () => ({
  settingsState: { remote: { workingDirectory: '/app/shared-data' } },
}))

const { runPipelineRemote } = await import('./pipelineOrchestrator')

/** Builds a coral stage with a complete config. */
const coralStage = (id: string): PipelineStage => ({
  id,
  type: 'coralStage',
  position: { x: 0, y: 0 },
  name: id,
  graph: { workflow: id },
  config: {
    coralBinaryPath: '/coral',
    coralPluginPath: '/plugin',
    nodes: 1,
    tasksPerNode: 1,
    timeLimit: '01:00:00',
    useMpi: false,
  },
})

/** Builds an executable stage with a complete config. */
const executableStage = (id: string): PipelineStage => ({
  id,
  type: 'executableStage',
  position: { x: 0, y: 0 },
  name: id,
  parameters: {},
  config: {
    executablePath: '/exe',
    parametersFileName: 'parameters.json',
    timeLimit: '01:00:00',
  },
})

const pipeline = (
  stages: PipelineStage[],
  edges: [string, string][]
): Pipeline => ({
  nodes: stages,
  edges: edges.map(([source, target]) => ({ source, target })),
})

beforeEach(() => {
  submits.length = 0
  submitCounter = 100
  pollResult = JobStatus.COMPLETED
  submitCoralStageRemote.mockClear()
  submitExecutableStageRemote.mockClear()
  jobPolling.mockClear()
  ensureUniqueRemoteDir.mockClear()
  ensureUniqueRemoteDir.mockImplementation(async (dir: string) => dir)
})

describe('runPipelineRemote', () => {
  it('submits stages in dependency order with correct --dependency chains', async () => {
    // a → b → c (linear)
    const p = pipeline(
      [coralStage('a'), coralStage('b'), coralStage('c')],
      [
        ['a', 'b'],
        ['b', 'c'],
      ]
    )

    await runPipelineRemote(p, undefined)

    // Three submits, in topo order a, b, c.
    expect(submits.map((s) => s.id)).toEqual(['100', '101', '102'])
    // a has no deps, b depends on a (100), c depends on b (101).
    expect(submits[0].deps).toEqual([])
    expect(submits[1].deps).toEqual(['100'])
    expect(submits[2].deps).toEqual(['101'])
  })

  it('submits independent branches with no cross-dependency', async () => {
    // a → b, a → c (diamond fan-out, no fan-in)
    const p = pipeline(
      [coralStage('a'), coralStage('b'), coralStage('c')],
      [
        ['a', 'b'],
        ['a', 'c'],
      ]
    )

    await runPipelineRemote(p, undefined)

    // a first, then b and c (both depend only on a).
    expect(submits[0].id).toBe('100')
    expect(submits[0].deps).toEqual([])
    const b = submits.find((s) => s.deps.includes('100') && s !== submits[0])!
    const c = submits.find((s) => s !== b && s.deps.includes('100'))!
    expect(b.deps).toEqual(['100'])
    expect(c.deps).toEqual(['100'])
  })

  it('reports terminal states via progress callbacks', async () => {
    const p = pipeline([coralStage('a')], [])
    pollResult = JobStatus.COMPLETED
    const events: string[] = []

    await runPipelineRemote(p, undefined, (event) => {
      if (event.type === 'success') events.push(`success:${event.message}`)
      if (event.type === 'error') events.push(`error:${event.message}`)
    })

    expect(events).toContain('success:a (job 100): COMPLETED')
  })

  it('dispatches coral vs executable stages to the right submit primitive', async () => {
    const p = pipeline([coralStage('a'), executableStage('b')], [['a', 'b']])

    await runPipelineRemote(p, undefined)

    expect(submitCoralStageRemote).toHaveBeenCalledTimes(1)
    expect(submitExecutableStageRemote).toHaveBeenCalledTimes(1)
  })

  it('rejects an empty pipeline without submitting', async () => {
    const events: string[] = []

    await runPipelineRemote({ nodes: [], edges: [] }, undefined, (e) => {
      if (e.type === 'error') events.push(e.message)
    })

    expect(submitCoralStageRemote).not.toHaveBeenCalled()
    expect(submitExecutableStageRemote).not.toHaveBeenCalled()
    expect(events).toContain('Pipeline has no stages')
  })

  it('builds the pipeline dir from a slugified custom name', async () => {
    const p = pipeline([coralStage('a')], [])

    await runPipelineRemote(p, 'My Custom Name')

    expect(ensureUniqueRemoteDir).toHaveBeenCalledWith(
      '/app/shared-data/pipeline-my-custom-name'
    )
  })

  it('falls back to a timestamp-based pipeline dir when no name is given', async () => {
    const p = pipeline([coralStage('a')], [])

    await runPipelineRemote(p, undefined)

    const [dir] = ensureUniqueRemoteDir.mock.calls[0]
    expect(dir).toMatch(/^\/app\/shared-data\/pipeline-\d+$/)
  })

  it('uses the collision-suffixed dir returned by ensureUniqueRemoteDir for stage subdirs', async () => {
    ensureUniqueRemoteDir.mockImplementation(
      async (dir: string) => `${dir}-1740000000000`
    )
    const p = pipeline([coralStage('a')], [])

    await runPipelineRemote(p, 'dup-test')

    expect(submitCoralStageRemote).toHaveBeenCalledWith(
      expect.objectContaining({
        stageDir: '/app/shared-data/pipeline-dup-test-1740000000000/stage-a',
      })
    )
  })
})
