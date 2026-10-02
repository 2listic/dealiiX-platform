import { describe, expect, it, vi, beforeEach } from 'vitest'
import { JobStatus } from '../types/jobTypes'
import type { PipelineStage } from '../types/pipelineTypes'

/** A promise plus the function that settles it, for driving stage completion by hand. */
const deferred = () => {
  let resolve!: (state: string) => void
  const promise = new Promise<string>((r) => (resolve = r))
  return { promise, resolve }
}

const started: string[] = []
let runs = new Map<string, ReturnType<typeof deferred>>()
let startError: Error | null = null

const prepareStageLocal = vi.fn(async (stage: PipelineStage) => ({
  key: `k-${stage.id}`,
  channel: 'start-local-coral-run',
  payload: {},
}))
const startPreparedStage = vi.fn(async ({ key }: { key: string }) => {
  if (startError) throw startError
  started.push(key)
  runs.set(key, deferred())
})

vi.mock('./localStages', () => ({
  prepareStageLocal: (stage: PipelineStage) => prepareStageLocal(stage),
  startPreparedStage: (prepared: { key: string }) =>
    startPreparedStage(prepared),
}))

vi.mock('../utils/sshMessages', () => ({
  // Resolves when the test settles the run started for this key.
  localJobPolling: async (key: string) => await runs.get(key)!.promise,
  ensureUniqueLocalDir: async (dir: string) => dir,
}))

vi.mock('../stores/settingsStore.svelte', () => ({
  settingsState: { local: { workingDirectory: '/work' } },
}))

const { localScheduler, schedulerFor } = await import('./stageScheduler')

const stage = (id: string): PipelineStage =>
  ({ id, type: 'coralStage', name: id }) as PipelineStage

/** Lets every pending promise callback run. */
const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  started.length = 0
  runs = new Map()
  startError = null
  prepareStageLocal.mockClear()
  startPreparedStage.mockClear()
})

describe('schedulerFor', () => {
  it('gives the local scheduler for local runs', () => {
    expect(schedulerFor('local', () => {}).workingDirectory()).toBe('/work')
  })

  it('rejects an unknown location', () => {
    expect(() => schedulerFor('cloud' as never, () => {})).toThrow(
      'Unknown execution location: cloud'
    )
  })
})

describe('localScheduler', () => {
  it('starts a child only after its parent completes', async () => {
    const scheduler = localScheduler(() => {})
    const a = await scheduler.submitStage(stage('a'), '/p/stage-a', [])
    const b = await scheduler.submitStage(stage('b'), '/p/stage-b', [a])
    await flush()

    expect(started).toEqual(['k-a'])

    runs.get(a)!.resolve(JobStatus.COMPLETED)
    await flush()

    expect(started).toEqual(['k-a', 'k-b'])
    runs.get(b)!.resolve(JobStatus.COMPLETED)
    expect(await scheduler.waitForTerminal(b)).toBe(JobStatus.COMPLETED)
  })

  it('finishes an independent branch while another is still running', async () => {
    const scheduler = localScheduler(() => {})
    const a = await scheduler.submitStage(stage('a'), '/p/stage-a', [])
    const b = await scheduler.submitStage(stage('b'), '/p/stage-b', [])
    await flush()

    expect(started).toEqual(['k-a', 'k-b'])

    runs.get(b)!.resolve(JobStatus.COMPLETED)
    expect(await scheduler.waitForTerminal(b)).toBe(JobStatus.COMPLETED)

    // `a` is still running: its outcome has not settled.
    const aOutcome = vi.fn()
    scheduler.waitForTerminal(a).then(aOutcome)
    await flush()
    expect(aOutcome).not.toHaveBeenCalled()
  })

  it('cancels only the descendants of a failed stage', async () => {
    // a → b → c, and an independent d
    const scheduler = localScheduler(() => {})
    const a = await scheduler.submitStage(stage('a'), '/p/stage-a', [])
    const b = await scheduler.submitStage(stage('b'), '/p/stage-b', [a])
    const c = await scheduler.submitStage(stage('c'), '/p/stage-c', [b])
    const d = await scheduler.submitStage(stage('d'), '/p/stage-d', [])
    await flush()

    runs.get(a)!.resolve(JobStatus.FAILED)
    runs.get(d)!.resolve(JobStatus.COMPLETED)

    expect(await scheduler.waitForTerminal(a)).toBe(JobStatus.FAILED)
    expect(await scheduler.waitForTerminal(b)).toBe(JobStatus.CANCELLED)
    expect(await scheduler.waitForTerminal(c)).toBe(JobStatus.CANCELLED)
    expect(await scheduler.waitForTerminal(d)).toBe(JobStatus.COMPLETED)
    expect(started).toEqual(['k-a', 'k-d'])
  })

  it('fails a stage that cannot start, reports it, and cancels its children', async () => {
    const events: string[] = []
    const scheduler = localScheduler((e) => events.push(e.message))
    startError = new Error('spawn ENOENT')
    const a = await scheduler.submitStage(stage('a'), '/p/stage-a', [])
    const b = await scheduler.submitStage(stage('b'), '/p/stage-b', [a])

    expect(await scheduler.waitForTerminal(a)).toBe(JobStatus.FAILED)
    expect(await scheduler.waitForTerminal(b)).toBe(JobStatus.CANCELLED)
    expect(events).toEqual(['a: Error: spawn ENOENT'])
  })

  it('rejects the submit when a stage fails its checks', async () => {
    const scheduler = localScheduler(() => {})
    prepareStageLocal.mockRejectedValueOnce(new Error('a: not found locally'))

    await expect(
      scheduler.submitStage(stage('a'), '/p/stage-a', [])
    ).rejects.toThrow('a: not found locally')
    expect(startPreparedStage).not.toHaveBeenCalled()
  })
})
