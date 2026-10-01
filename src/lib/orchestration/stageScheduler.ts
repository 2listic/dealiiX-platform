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
import type { PipelineStage } from '../types/pipelineTypes'
import type { PipelineProgress } from './pipelineOrchestrator'
import { prepareStageLocal, startPreparedStage } from './localStages'

const REMOTE_POLL_INTERVAL_MS = 10 * 1000
const REMOTE_POLL_TIMEOUT_MS = 24 * 60 * 60 * 1000
const LOCAL_POLL_INTERVAL_MS = 1000
const LOCAL_POLL_TIMEOUT_MS = 24 * 60 * 60 * 1000

/** How the orchestrator allocates, submits and waits for the stages of one run. */
export type StageScheduler = {
  /** Root under which the `pipeline-<name>/` directory is created. */
  workingDirectory: () => string
  /** Creates the pipeline directory, suffixing a timestamp on collision; returns the path created. */
  allocateDirectory: (dir: string) => Promise<string>
  /** Submits one stage to run after its parents; returns its handle without waiting for it. */
  submitStage: (
    stage: PipelineStage,
    stageDir: string,
    parentHandles: string[]
  ) => Promise<string>
  /** Resolves with the stage's terminal JobStatus. */
  waitForTerminal: (handle: string) => Promise<string>
}

/**
 * Creates the Slurm scheduler: each stage is an sbatch job chained on its parents
 * with `--dependency=afterok`, so Slurm enforces the order. Handles are Slurm ids.
 *
 * @returns A scheduler backed by the remote submit and polling primitives.
 */
export const remoteScheduler = (): StageScheduler => ({
  workingDirectory: () => settingsState.remote.workingDirectory,
  allocateDirectory: ensureUniqueRemoteDir,
  submitStage: async (stage, stageDir, parentHandles) => {
    if (stage.type === 'coralStage') {
      return await submitCoralStageRemote({
        graph: stage.graph as object,
        stageDir,
        config: stage.config,
        dependencyJobIds: parentHandles,
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
        dependencyJobIds: parentHandles,
      })
    }
    throw new Error(
      `Unknown stage type for stage ${(stage as { id: string }).id}`
    )
  },
  waitForTerminal: (handle) =>
    jobPolling(handle, REMOTE_POLL_INTERVAL_MS, REMOTE_POLL_TIMEOUT_MS),
})

/**
 * Creates the in-process local scheduler for one pipeline run. Each stage is
 * checked and recorded at submit, then started as soon as all of its own parents
 * have completed; if any parent did not complete it is never started and ends
 * CANCELLED, so a failure cascades to every descendant. Handles are local job ids.
 *
 * @param emit - Receives an error event when a stage fails to start.
 * @returns A scheduler backed by local processes, scoped to a single run.
 */
export const localScheduler = (
  emit: (event: PipelineProgress) => void
): StageScheduler => {
  const outcomes = new Map<string, Promise<string>>()

  const outcomeOf = (handle: string): Promise<string> => {
    const outcome = outcomes.get(handle)
    if (!outcome) throw new Error(`Unknown local stage handle ${handle}`)
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
    submitStage: async (stage, stageDir, parentHandles) => {
      // Awaited by the orchestrator, so a missing binary stops submission of
      // this and every later stage, as a failed sbatch does remotely.
      const prepared = await prepareStageLocal(stage, stageDir)
      const parentOutcomes = parentHandles.map(outcomeOf)
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
