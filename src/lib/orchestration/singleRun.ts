/**
 * A single run from the Run dialog, launched through the same
 * {@link StageScheduler} as a pipeline stage: one job with no parents, in its
 * own `run-<name>/` directory.
 */

import { JobStatus } from '../types/jobTypes'
import { buildDirName } from '../utils/slugify'
import { schedulerFor, type StageScheduler } from './stageScheduler'
import type { StageJob } from '../types/pipelineTypes'
import type { ExecutionLocation } from '../types/settingsTypes'
import type { PipelineProgress } from './pipelineOrchestrator'

/**
 * Runs one job at the given execution location and waits for it, reporting
 * progress through `onProgress`.
 *
 * @param location - Where the job runs: Slurm for `remote`, a local process for `local`.
 * @param job - The graph or parameter tree to run, with its job config.
 * @param runName - Optional user-supplied name; slugified into the run's output folder.
 * @param onProgress - Optional callback for progress events (toasts, job-table refresh).
 * @returns Resolves once the job has reached a terminal state.
 * @throws {Error} If the location is unknown or the job fails to submit.
 */
export const runSingle = async (
  location: ExecutionLocation,
  job: StageJob,
  runName: string | undefined,
  onProgress?: (event: PipelineProgress) => void
): Promise<void> => {
  const emit = (event: PipelineProgress) => onProgress?.(event)
  const scheduler: StageScheduler = schedulerFor(location, emit)

  const runDir = await scheduler.allocateDirectory(
    `${scheduler.workingDirectory()}/${buildDirName('run', runName)}`
  )
  const jobId = await scheduler.submitStage(job, runDir, [])
  emit({ type: 'info', message: `Submitted job ${jobId}` })

  const finalState = await scheduler.waitForTerminal(jobId)
  emit({
    type: finalState === JobStatus.COMPLETED ? 'success' : 'error',
    message: `Job id ${jobId}: ${finalState}`,
  })
}
