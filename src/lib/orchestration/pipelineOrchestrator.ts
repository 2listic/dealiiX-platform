/**
 * In-app pipeline orchestration (remote / Slurm only, MVP).
 *
 * Topologically orders the stage DAG and submits every stage as its own Slurm job,
 * chaining each one after its parents with `--dependency=afterok`. Slurm then
 * enforces the order and runs independent branches in parallel — the run survives
 * the app being closed; the concurrent polling here is only for live feedback.
 */

import {
  submitCoralStageRemote,
  submitExecutableStageRemote,
  jobPolling,
} from '../utils/sshMessages'
import { jobsState } from '../stores/jobsStore.svelte'
import { settingsState } from '../stores/settingsStore.svelte'
import { toastState } from '../stores/toastsStore.svelte'
import { JobStatus } from '../types/jobTypes'
import { resolveExecutionOrder, parentsOf } from './executionOrder'
import type { Pipeline } from '../types/pipelineTypes'

const POLL_INTERVAL_MS = 10 * 1000
const POLL_TIMEOUT_MS = 24 * 60 * 60 * 1000

/**
 * Submits every stage of a pipeline to the remote Slurm scheduler in dependency
 * order and reports progress via toasts and the jobs table.
 * @param pipeline - The pipeline (stages + ordering edges) to execute.
 * @returns Resolves once all stages have reached a terminal state.
 * @throws {Error} If not in remote mode, or if the pipeline is empty/cyclic, or if
 * any stage fails to submit.
 */
export const runPipelineRemote = async (pipeline: Pipeline): Promise<void> => {
  if (settingsState.execution.location !== 'remote') {
    toastState.add({
      message: 'Pipelines currently run in remote mode only',
      type: 'error',
    })
    return
  }
  if (pipeline.stages.length === 0) {
    toastState.add({ message: 'Pipeline has no stages', type: 'error' })
    return
  }

  try {
    // Throws PipelineCycleError if the DAG is cyclic.
    const order = resolveExecutionOrder(pipeline)
    const pipelineDir = `${settingsState.remote.workingDirectory}/pipeline-${Date.now()}`

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
      if (stage.kind === 'coral') {
        slurmId = await submitCoralStageRemote({
          graph: stage.graph as object,
          stageDir,
          config: stage.config,
          dependencyJobIds,
        })
      } else if (stage.kind === 'executable') {
        if (!stage.parameters)
          throw new Error(
            `Executable stage "${stage.name}" has no parameters loaded`
          )
        slurmId = await submitExecutableStageRemote({
          executablePath: stage.executablePath,
          parameters: stage.parameters,
          parametersFileName: stage.parametersFileName,
          stageDir,
          config: stage.config,
          dependencyJobIds,
        })
      } else {
        throw new Error(
          `Unknown stage kind for stage ${(stage as { id: string }).id}`
        )
      }

      slurmIdByStage.set(stage.id, slurmId)
    }

    toastState.add({
      message: `Submitted ${order.length} stage(s) to Slurm`,
      type: 'success',
    })
    await jobsState.update()

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

    await jobsState.update()
    for (const { stage, slurmId, finalState } of results) {
      toastState.add({
        message: `${stage.name} (job ${slurmId}): ${finalState}`,
        type: finalState === JobStatus.COMPLETED ? 'success' : 'error',
      })
    }
  } catch (error) {
    toastState.add({
      message: error instanceof Error ? error.message : 'Pipeline run failed',
      type: 'error',
    })
  }
}
