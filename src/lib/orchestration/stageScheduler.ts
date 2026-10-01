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
} from '../utils/sshMessages'
import { settingsState } from '../stores/settingsStore.svelte'
import type { PipelineStage } from '../types/pipelineTypes'

const REMOTE_POLL_INTERVAL_MS = 10 * 1000
const REMOTE_POLL_TIMEOUT_MS = 24 * 60 * 60 * 1000

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
