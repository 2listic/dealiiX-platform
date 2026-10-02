import { describe, expect, it, vi, beforeEach } from 'vitest'
import { JobStatus } from '../types/jobTypes'
import type { Pipeline, PipelineStage } from '../types/pipelineTypes'
import type { StageScheduler } from './stageScheduler'

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
  ensureUniqueLocalDir: async (dir: string) => dir,
  localJobPolling: async () => JobStatus.COMPLETED,
}))

const prepareStageLocal = vi.fn(
  async (stage: PipelineStage, stageDir: string) => ({
    key: `local-${stage.id}`,
    channel: 'start-local-coral-run',
    payload: { stageDir },
  })
)

vi.mock('./localStages', () => ({
  prepareStageLocal: (stage: PipelineStage, stageDir: string) =>
    prepareStageLocal(stage, stageDir),
  startPreparedStage: async () => {},
}))

vi.mock('../stores/settingsStore.svelte', () => ({
  settingsState: {
    remote: { workingDirectory: '/app/shared-data' },
    local: { workingDirectory: '/home/user/runs' },
  },
}))

const { runPipeline, runPipelineOnScheduler } = await import(
  './pipelineOrchestrator'
)

/** Builds a coral stage with a complete config. */
const coralStage = (id: string): PipelineStage => ({
  id,
  type: 'coralStage',
  position: { x: 0, y: 0 },
  name: id,
  graph: { workflow: id },
  config: {
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
    nodes: 1,
    tasksPerNode: 1,
    timeLimit: '01:00:00',
    useMpi: false,
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

describe("runPipeline('remote')", () => {
  it('submits stages in dependency order with correct --dependency chains', async () => {
    // a → b → c (linear)
    const p = pipeline(
      [coralStage('a'), coralStage('b'), coralStage('c')],
      [
        ['a', 'b'],
        ['b', 'c'],
      ]
    )

    await runPipeline('remote', p, undefined)

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

    await runPipeline('remote', p, undefined)

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

    await runPipeline('remote', p, undefined, (event) => {
      if (event.type === 'success') events.push(`success:${event.message}`)
      if (event.type === 'error') events.push(`error:${event.message}`)
    })

    expect(events).toContain('success:a (stage a, job 100): COMPLETED')
  })

  it('dispatches coral vs executable stages to the right submit primitive', async () => {
    const p = pipeline([coralStage('a'), executableStage('b')], [['a', 'b']])

    await runPipeline('remote', p, undefined)

    expect(submitCoralStageRemote).toHaveBeenCalledTimes(1)
    expect(submitExecutableStageRemote).toHaveBeenCalledTimes(1)
  })

  it('rejects an empty pipeline without submitting', async () => {
    const events: string[] = []

    await runPipeline('remote', { nodes: [], edges: [] }, undefined, (e) => {
      if (e.type === 'error') events.push(e.message)
    })

    expect(submitCoralStageRemote).not.toHaveBeenCalled()
    expect(submitExecutableStageRemote).not.toHaveBeenCalled()
    expect(events).toContain('Pipeline has no stages')
  })

  it('builds the pipeline dir from a slugified custom name', async () => {
    const p = pipeline([coralStage('a')], [])

    await runPipeline('remote', p, 'My Custom Name')

    expect(ensureUniqueRemoteDir).toHaveBeenCalledWith(
      '/app/shared-data/pipeline-my-custom-name'
    )
  })

  it('falls back to a timestamp-based pipeline dir when no name is given', async () => {
    const p = pipeline([coralStage('a')], [])

    await runPipeline('remote', p, undefined)

    const [dir] = ensureUniqueRemoteDir.mock.calls[0]
    expect(dir).toMatch(/^\/app\/shared-data\/pipeline-\d+$/)
  })

  it('uses the collision-suffixed dir returned by ensureUniqueRemoteDir for stage subdirs', async () => {
    ensureUniqueRemoteDir.mockImplementation(
      async (dir: string) => `${dir}-1740000000000`
    )
    const p = pipeline([coralStage('a')], [])

    await runPipeline('remote', p, 'dup-test')

    expect(submitCoralStageRemote).toHaveBeenCalledWith(
      expect.objectContaining({
        stageDir: '/app/shared-data/pipeline-dup-test-1740000000000/stage-a',
      })
    )
  })
})

describe("runPipeline('local')", () => {
  it('runs stages through the local scheduler under the local working directory', async () => {
    const events: string[] = []
    prepareStageLocal.mockClear()

    await runPipeline('local', pipeline([coralStage('a')], []), 'demo', (e) => {
      if (e.type === 'success') events.push(e.message)
    })

    expect(prepareStageLocal).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'a' }),
      '/home/user/runs/pipeline-demo/stage-a'
    )
    expect(submitCoralStageRemote).not.toHaveBeenCalled()
    expect(events).toContain('a (stage a, job local-a): COMPLETED')
  })
})

describe('runPipelineOnScheduler', () => {
  /** A scheduler recording each submit; job ids are `h-<stage id>`. */
  const fakeScheduler = (
    terminal: Record<string, string> = {}
  ): StageScheduler & {
    submitted: { stageDir: string; parents: string[] }[]
  } => {
    const submitted: { stageDir: string; parents: string[] }[] = []
    return {
      submitted,
      workingDirectory: () => '/work',
      allocateDirectory: vi.fn(async (dir: string) => `${dir}-x`),
      submitStage: vi.fn(async (stage, stageDir, parentJobIds) => {
        submitted.push({ stageDir, parents: parentJobIds })
        return `h-${stage.id}`
      }),
      waitForTerminal: vi.fn(
        async (jobId: string) => terminal[jobId] ?? JobStatus.COMPLETED
      ),
    }
  }

  it('allocates the pipeline dir under the scheduler working directory', async () => {
    const scheduler = fakeScheduler()

    await runPipelineOnScheduler(
      scheduler,
      pipeline([coralStage('a')], []),
      'run'
    )

    expect(scheduler.allocateDirectory).toHaveBeenCalledWith(
      '/work/pipeline-run'
    )
    expect(scheduler.submitted[0].stageDir).toBe('/work/pipeline-run-x/stage-a')
  })

  it("passes each stage its parents' job ids", async () => {
    // a → c ← b (fan-in)
    const scheduler = fakeScheduler()
    const p = pipeline(
      [coralStage('a'), coralStage('b'), executableStage('c')],
      [
        ['a', 'c'],
        ['b', 'c'],
      ]
    )

    await runPipelineOnScheduler(scheduler, p, undefined)

    expect(scheduler.submitted.at(-1)!.parents.sort()).toEqual(['h-a', 'h-b'])
  })

  it('waits for every stage and reports each terminal state', async () => {
    const scheduler = fakeScheduler({ 'h-b': JobStatus.FAILED })
    const events: string[] = []
    const p = pipeline([coralStage('a'), coralStage('b')], [['a', 'b']])

    await runPipelineOnScheduler(scheduler, p, undefined, (e) => {
      if (e.type !== 'info') events.push(`${e.type}:${e.message}`)
    })

    expect(scheduler.waitForTerminal).toHaveBeenCalledTimes(2)
    expect(events).toContain('success:a (stage a, job h-a): COMPLETED')
    expect(events).toContain('error:b (stage b, job h-b): FAILED')
  })

  it('names a failed parent as the cause of a cancelled stage', async () => {
    // a → b, and an independent c the user cancelled
    const scheduler = fakeScheduler({
      'h-a': JobStatus.FAILED,
      'h-b': JobStatus.CANCELLED,
      'h-c': JobStatus.CANCELLED,
    })
    const events: string[] = []
    const p = pipeline(
      [coralStage('a'), coralStage('b'), coralStage('c')],
      [['a', 'b']]
    )

    await runPipelineOnScheduler(scheduler, p, undefined, (e) => {
      if (e.type === 'error') events.push(e.message)
    })

    expect(events).toContain(
      'b (stage b, job h-b): CANCELLED (a parent stage did not complete)'
    )
    expect(events).toContain('c (stage c, job h-c): CANCELLED')
  })
})
