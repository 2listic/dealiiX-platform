/**
 * In-app pipeline orchestration (remote / Slurm only, MVP).
 *
 * Topologically orders the stage DAG and submits every stage as its own Slurm job,
 * chaining each one after its parents with `--dependency=afterok`. Slurm then
 * enforces the order and runs independent branches in parallel — the run survives
 * the app being closed; the concurrent polling here is only for live feedback.
 *
 * Toasts / `jobsState.update()` are side effects of the *caller*, reported
 * through the progress callbacks, so this module stays focused on ordering and
 * submission.
 */

import { JobStatus } from '../types/jobTypes'
import { resolveExecutionOrder, parentsOf } from './executionOrder'
import {
  submitCoralStageRemote,
  submitExecutableStageRemote,
  jobPolling,
  ensureUniqueRemoteDir,
} from '../utils/sshMessages'
import { buildDirName } from '../utils/slugify'
import { settingsState } from '../stores/settingsStore.svelte'
import type { Pipeline, PipelineStage } from '../types/pipelineTypes'

const POLL_INTERVAL_MS = 10 * 1000
const POLL_TIMEOUT_MS = 24 * 60 * 60 * 1000

/** A progress event emitted by [`runPipelineRemote`]. */
export type PipelineProgress =
  | { type: 'info'; message: string }
  | { type: 'success'; message: string }
  | { type: 'error'; message: string }
  | {
      type: 'stageTerminal'
      stage: PipelineStage
      slurmId: string
      finalState: string
    }

/**
 * Submits every stage of a pipeline to the remote Slurm scheduler in dependency
 * order and reports progress through `onProgress` callbacks.
 *
 * @param pipeline - The pipeline (stages + ordering edges) to execute.
 * @param runName - Optional user-supplied name; slugified into the pipeline's output folder.
 * @param onProgress - Optional callback for progress events (toasts, job-table refresh).
 * @returns Resolves once all stages have reached a terminal state.
 * @throws {Error} If the pipeline is empty or cyclic, or if any stage fails to submit.
 */
export const runPipelineRemote = async (
  pipeline: Pipeline,
  runName: string | undefined,
  onProgress?: (event: PipelineProgress) => void
): Promise<void> => {
  const emit = (event: PipelineProgress) => onProgress?.(event)

  if (pipeline.nodes.length === 0) {
    emit({ type: 'error', message: 'Pipeline has no stages' })
    return
  }

  // Throws PipelineCycleError if the DAG is cyclic.
  const order = resolveExecutionOrder(pipeline)
  // Absolute pipeline dir: stage subdirs recorded via jobIdMapState must be
  // absolute so later reads (getOutFileContent / getNodesExecutionStatus)
  // resolve regardless of the SSH session's cwd. Settled once, up front, since
  // every stage dir nests under it.
  const pipelineDir = await ensureUniqueRemoteDir(
    `${settingsState.remote.workingDirectory}/${buildDirName('pipeline', runName)}`
  )

  // Map each stage id to its submitted Slurm id so children can depend on parents.
  const slurmIdByStage = new Map<string, string>()

  for (const stage of order) {
    const stageDir = `${pipelineDir}/stage-${stage.id}`
    const dependencyJobIds = parentsOf(stage.id, pipeline.edges).map(
      (parentId) => {
        const parentSlurmId = slurmIdByStage.get(parentId)
        // Guaranteed present: topo order submits every parent before its children.
        if (!parentSlurmId)
          throw new Error(
            `Missing submitted job id for parent stage ${parentId}`
          )
        return parentSlurmId
      }
    )

    let slurmId: string
    if (stage.type === 'coralStage') {
      slurmId = await submitCoralStageRemote({
        graph: stage.graph as object,
        stageDir,
        config: stage.config,
        dependencyJobIds,
      })
    } else if (stage.type === 'executableStage') {
      if (!stage.parameters)
        throw new Error(
          `Executable stage "${stage.name}" has no parameters loaded`
        )
      slurmId = await submitExecutableStageRemote({
        parameters: stage.parameters,
        stageDir,
        config: stage.config,
        dependencyJobIds,
      })
    } else {
      throw new Error(
        `Unknown stage type for stage ${(stage as { id: string }).id}`
      )
    }

    slurmIdByStage.set(stage.id, slurmId)
  }

  emit({
    type: 'success',
    message: `Submitted ${order.length} stage(s) to Slurm`,
  })

  // Poll all stages concurrently for live feedback; Slurm runs them in order regardless.
  const results = await Promise.all(
    order.map(async (stage) => {
      const slurmId = slurmIdByStage.get(stage.id)!
      const finalState = await jobPolling(
        slurmId,
        POLL_INTERVAL_MS,
        POLL_TIMEOUT_MS
      )
      return { stage, slurmId, finalState }
    })
  )

  for (const { stage, slurmId, finalState } of results) {
    emit({
      type: 'stageTerminal',
      stage,
      slurmId,
      finalState,
    })
    emit({
      type: finalState === JobStatus.COMPLETED ? 'success' : 'error',
      message: `${stage.name} (job ${slurmId}): ${finalState}`,
    })
  }
}
