/**
 * The scheduling backends a pipeline run is dispatched through. The orchestrator
 * only orders the stages and waits for them; a {@link StageScheduler} decides how
 * a stage is held until its parents succeed, launched, and tracked.
 */

import {
  submitCoralStageRemote,
  submitExecutableStageRemote,
  jobPolling,
  ensureUniqueRemoteDir,
  ensureUniqueLocalDir,
  localJobPolling,
} from '../utils/sshMessages'
import { settingsState } from '../stores/settingsStore.svelte'
import { JobStatus } from '../types/jobTypes'
import type { StageJob } from '../types/pipelineTypes'
import type { ExecutionLocation } from '../types/settingsTypes'
import type { PipelineProgress } from './pipelineOrchestrator'
import { prepareStageLocal, startPreparedStage } from './localStages'

const REMOTE_POLL_INTERVAL_MS = 10 * 1000
const REMOTE_POLL_TIMEOUT_MS = 24 * 60 * 60 * 1000
const LOCAL_POLL_INTERVAL_MS = 1000
const LOCAL_POLL_TIMEOUT_MS = 24 * 60 * 60 * 1000

/** How a run allocates, submits and waits for its stages: a pipeline's, or a single run's one. */
export type StageScheduler = {
  /** Root under which the run's directory is created. */
  workingDirectory: () => string
  /** Creates the run's directory, suffixing a timestamp on collision; returns the path created. */
  allocateDirectory: (dir: string) => Promise<string>
  /** Submits one stage to run after its parents; returns its job id without waiting for it. */
  submitStage: (
    stage: StageJob,
    stageDir: string,
    parentJobIds: string[]
  ) => Promise<string>
  /** Resolves with the stage's terminal JobStatus. */
  waitForTerminal: (jobId: string) => Promise<string>
}

/**
 * Creates the scheduler for an execution location, scoped to one run.
 *
 * @param location - Where the run executes.
 * @param emit - Receives the progress events the scheduler reports itself (a local stage failing to start).
 * @returns The Slurm scheduler for `remote`, the in-process scheduler for `local`.
 * @throws {Error} If the location is unknown.
 */
export const schedulerFor = (
  location: ExecutionLocation,
  emit: (event: PipelineProgress) => void
): StageScheduler => {
  if (location === 'remote') {
    return remoteScheduler()
  } else if (location === 'local') {
    return localScheduler(emit)
  }
  throw new Error(`Unknown execution location: ${location}`)
}

/**
 * Creates the Slurm scheduler: each stage is an sbatch job chained on its parents
 * with `--dependency=afterok`, so Slurm enforces the order. Job ids are Slurm ids.
 *
 * @returns A scheduler backed by the remote submit and polling primitives.
 */
export const remoteScheduler = (): StageScheduler => ({
  workingDirectory: () => settingsState.remote.workingDirectory,
  allocateDirectory: ensureUniqueRemoteDir,
  submitStage: async (stage, stageDir, parentJobIds) => {
    if (stage.type === 'coralStage') {
      return await submitCoralStageRemote({
        graph: stage.graph as object,
        stageDir,
        config: stage.config,
        dependencyJobIds: parentJobIds,
      })
    } else if (stage.type === 'executableStage') {
      if (!stage.parameters)
        throw new Error(
          `Executable stage "${stage.name}" has no parameters loaded`
        )
      return await submitExecutableStageRemote({
        parameters: stage.parameters,
        stageDir,
        config: stage.config,
        dependencyJobIds: parentJobIds,
      })
    }
    throw new Error(
      `Unknown stage type for stage ${(stage as { name: string }).name}`
    )
  },
  waitForTerminal: (jobId) =>
    jobPolling(jobId, REMOTE_POLL_INTERVAL_MS, REMOTE_POLL_TIMEOUT_MS),
})

/**
 * Creates the in-process local scheduler for one pipeline run. Each stage is
 * checked and recorded at submit, then started as soon as all of its own parents
 * have completed; if any parent did not complete it is never started and ends
 * CANCELLED, so a failure cascades to every descendant. Job ids are local job ids.
 *
 * @param emit - Receives an error event when a stage fails to start.
 * @returns A scheduler backed by local processes, scoped to a single run.
 */
export const localScheduler = (
  emit: (event: PipelineProgress) => void
): StageScheduler => {
  const outcomes = new Map<string, Promise<string>>()

  const outcomeOf = (jobId: string): Promise<string> => {
    const outcome = outcomes.get(jobId)
    if (!outcome) throw new Error(`Unknown local job id ${jobId}`)
    return outcome
  }

  const runAfterParents = async (
    stageName: string,
    key: string,
    parentOutcomes: Promise<string>[],
    start: () => Promise<void>
  ): Promise<string> => {
    const parentStates = await Promise.all(parentOutcomes)
    if (parentStates.some((state) => state !== JobStatus.COMPLETED))
      return JobStatus.CANCELLED
    try {
      await start()
      return await localJobPolling(
        key,
        LOCAL_POLL_INTERVAL_MS,
        LOCAL_POLL_TIMEOUT_MS
      )
    } catch (error) {
      emit({ type: 'error', message: `${stageName}: ${error}` })
      return JobStatus.FAILED
    }
  }

  return {
    workingDirectory: () => settingsState.local.workingDirectory,
    allocateDirectory: ensureUniqueLocalDir,
    submitStage: async (stage, stageDir, parentJobIds) => {
      // Awaited by the orchestrator, so a missing binary stops submission of
      // this and every later stage, as a failed sbatch does remotely.
      const prepared = await prepareStageLocal(stage, stageDir)
      const parentOutcomes = parentJobIds.map(outcomeOf)
      // Not awaited: the stage waits for its parents in the background.
      outcomes.set(
        prepared.key,
        runAfterParents(stage.name, prepared.key, parentOutcomes, () =>
          startPreparedStage(prepared)
        )
      )
      return prepared.key
    },
    waitForTerminal: outcomeOf,
  }
}
