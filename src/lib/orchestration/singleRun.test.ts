import { describe, expect, it, vi, beforeEach } from 'vitest'
import { JobStatus } from '../types/jobTypes'
import type { StageJob } from '../types/pipelineTypes'
import type { StageScheduler } from './stageScheduler'

let terminalState: string = JobStatus.COMPLETED
const scheduler = {
  workingDirectory: () => '/work',
  allocateDirectory: vi.fn(async (dir: string) => `${dir}-x`),
  submitStage: vi.fn(
    async (..._args: Parameters<StageScheduler['submitStage']>) => '7'
  ),
  waitForTerminal: vi.fn(async (_jobId: string) => terminalState),
}
const schedulerFor = vi.fn((..._args: unknown[]) => scheduler)

vi.mock('./stageScheduler', () => ({
  schedulerFor: (...args: unknown[]) => schedulerFor(...args),
}))

const { runSingle } = await import('./singleRun')

const job: StageJob = {
  type: 'coralStage',
  name: 'demo',
  graph: { workflow: {} },
  config: { nodes: 1, tasksPerNode: 1, timeLimit: '01:00:00', useMpi: false },
}

beforeEach(() => {
  terminalState = JobStatus.COMPLETED
  vi.clearAllMocks()
})

describe('runSingle', () => {
  it('submits the job with no parents into its own run directory', async () => {
    await runSingle('local', job, 'My Run')

    expect(schedulerFor).toHaveBeenCalledWith('local', expect.any(Function))
    expect(scheduler.allocateDirectory).toHaveBeenCalledWith('/work/run-my-run')
    expect(scheduler.submitStage).toHaveBeenCalledWith(
      job,
      '/work/run-my-run-x',
      []
    )
    expect(scheduler.waitForTerminal).toHaveBeenCalledWith('7')
  })

  it('reports the submission, then the terminal state', async () => {
    terminalState = JobStatus.FAILED
    const events: string[] = []

    await runSingle('remote', job, undefined, (e) =>
      events.push(`${e.type}:${e.message}`)
    )

    expect(events).toEqual(['info:Submitted job 7', 'error:Job id 7: FAILED'])
  })

  it('rejects without reporting a submission when the job fails its checks', async () => {
    scheduler.submitStage.mockRejectedValueOnce(
      new Error('demo: not found locally')
    )
    const events: string[] = []

    await expect(
      runSingle('local', job, undefined, (e) => events.push(e.message))
    ).rejects.toThrow('demo: not found locally')
    expect(events).toEqual([])
    expect(scheduler.waitForTerminal).not.toHaveBeenCalled()
  })
})
