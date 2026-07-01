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

vi.mock('../utils/sshMessages', () => ({
  submitCoralStageRemote: (args: never) => submitCoralStageRemote(args),
  submitExecutableStageRemote: (args: never) =>
    submitExecutableStageRemote(args),
  jobPolling: (...args: never[]) => jobPolling(...args),
}))

vi.mock('../stores/settingsStore.svelte', () => ({
  settingsState: { remote: { workingDirectory: '/app/shared-data' } },
}))

const { runPipelineRemote } = await import('./pipelineOrchestrator')

/** Builds a coral stage with a complete (widened) config. */
const coralStage = (id: string): PipelineStage => ({
  id,
  name: id,
  kind: 'coral',
  graph: { workflow: id },
  config: {
    kind: 'coral',
    coralBinaryPath: '/coral',
    coralPluginPath: '/plugin',
    nodes: 1,
    tasksPerNode: 1,
    timeLimit: '01:00:00',
    useMpi: false,
  },
})

/** Builds an executable stage with a complete (widened) config. */
const executableStage = (id: string): PipelineStage => ({
  id,
  name: id,
  kind: 'executable',
  parameters: { kind: 'group', children: {} } as never,
  config: {
    kind: 'executable',
    executablePath: '/exe',
    parametersFileName: 'parameters.json',
    timeLimit: '01:00:00',
  },
})

const pipeline = (
  stages: PipelineStage[],
  edges: [string, string][]
): Pipeline => ({
  stages,
  edges: edges.map(([source, target]) => ({ source, target })),
})

beforeEach(() => {
  submits.length = 0
  submitCounter = 100
  pollResult = JobStatus.COMPLETED
  submitCoralStageRemote.mockClear()
  submitExecutableStageRemote.mockClear()
  jobPolling.mockClear()
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

    await runPipelineRemote(p)

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

    await runPipelineRemote(p)

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

    await runPipelineRemote(p, (event) => {
      if (event.type === 'success') events.push(`success:${event.message}`)
      if (event.type === 'error') events.push(`error:${event.message}`)
      if (event.type === 'stageTerminal')
        events.push(`terminal:${event.stage.id}:${event.finalState}`)
    })

    expect(events).toContain('terminal:a:COMPLETED')
    expect(events.some((e) => e.startsWith('success:'))).toBe(true)
  })

  it('dispatches coral vs executable stages to the right submit primitive', async () => {
    const p = pipeline([coralStage('a'), executableStage('b')], [['a', 'b']])

    await runPipelineRemote(p)

    expect(submitCoralStageRemote).toHaveBeenCalledTimes(1)
    expect(submitExecutableStageRemote).toHaveBeenCalledTimes(1)
  })

  it('rejects an empty pipeline without submitting', async () => {
    const events: string[] = []

    await runPipelineRemote({ stages: [], edges: [] }, (e) => {
      if (e.type === 'error') events.push(e.message)
    })

    expect(submitCoralStageRemote).not.toHaveBeenCalled()
    expect(submitExecutableStageRemote).not.toHaveBeenCalled()
    expect(events).toContain('Pipeline has no stages')
  })
})
