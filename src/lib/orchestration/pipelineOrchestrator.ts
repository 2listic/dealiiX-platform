/**
 * In-app pipeline orchestration.
 *
 * Topologically orders the stage DAG and submits every stage through a
 * {@link StageScheduler}, passing each one its parents' handles. The scheduler
 * holds a stage until its parents succeed and runs independent branches in
 * parallel; remotely that is Slurm (`--dependency=afterok`), so the run survives
 * the app being closed and the concurrent waiting here is only for live feedback.
 *
 * Toasts / `jobsState.update()` are side effects of the *caller*, reported
 * through the progress callbacks, so this module stays focused on ordering and
 * submission.
 */

import { JobStatus } from '../types/jobTypes'
import { resolveExecutionOrder, parentsOf } from './executionOrder'
import { remoteScheduler, type StageScheduler } from './stageScheduler'
import { buildDirName } from '../utils/slugify'
import type { Pipeline } from '../types/pipelineTypes'
import type { ExecutionLocation } from '../types/settingsTypes'

/** A progress event emitted by [`runPipeline`]. */
export type PipelineProgress =
  | { type: 'info'; message: string }
  | { type: 'success'; message: string }
  | { type: 'error'; message: string }

/**
 * Runs every stage of a pipeline at the given execution location in dependency
 * order and reports progress through `onProgress` callbacks.
 *
 * @param location - Where the stages run; only `remote` is supported for now.
 * @param pipeline - The pipeline (stages + ordering edges) to execute.
 * @param runName - Optional user-supplied name; slugified into the pipeline's output folder.
 * @param onProgress - Optional callback for progress events (toasts, job-table refresh).
 * @returns Resolves once all stages have reached a terminal state.
 * @throws {Error} If the location is unsupported, the pipeline is cyclic, or any stage fails to submit.
 */
export const runPipeline = async (
  location: ExecutionLocation,
  pipeline: Pipeline,
  runName: string | undefined,
  onProgress?: (event: PipelineProgress) => void
): Promise<void> => {
  let scheduler: StageScheduler
  if (location === 'remote') {
    scheduler = remoteScheduler()
  } else if (location === 'local') {
    throw new Error('Pipelines run in remote mode only')
  } else {
    throw new Error(`Unknown execution location: ${location}`)
  }
  await runPipelineOnScheduler(scheduler, pipeline, runName, onProgress)
}

/**
 * Submits every stage of a pipeline through `scheduler` in dependency order,
 * then waits for all of them, reporting each stage as soon as it finishes.
 *
 * @param scheduler - The backend that allocates directories, submits and tracks stages.
 * @param pipeline - The pipeline (stages + ordering edges) to execute.
 * @param runName - Optional user-supplied name; slugified into the pipeline's output folder.
 * @param onProgress - Optional callback for progress events (toasts, job-table refresh).
 * @returns Resolves once all stages have reached a terminal state.
 * @throws {Error} If the pipeline is cyclic or any stage fails to submit.
 */
export const runPipelineOnScheduler = async (
  scheduler: StageScheduler,
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
  const pipelineDir = await scheduler.allocateDirectory(
    `${scheduler.workingDirectory()}/${buildDirName('pipeline', runName)}`
  )

  // Map each stage id to its scheduler handle so children can depend on parents.
  const handleByStage = new Map<string, string>()

  for (const stage of order) {
    const stageDir = `${pipelineDir}/stage-${stage.id}`
    const parentHandles = parentsOf(stage.id, pipeline.edges).map(
      (parentId) => {
        const parentHandle = handleByStage.get(parentId)
        // Guaranteed present: topo order submits every parent before its children.
        if (!parentHandle)
          throw new Error(
            `Missing submitted job id for parent stage ${parentId}`
          )
        return parentHandle
      }
    )

    handleByStage.set(
      stage.id,
      await scheduler.submitStage(stage, stageDir, parentHandles)
    )
  }

  emit({
    type: 'success',
    message: `Submitted ${order.length} stage(s) to Slurm`,
  })

  // Wait for all stages concurrently; each stage reports as soon as it finishes,
  // rather than waiting for the whole pipeline to reach a terminal state.
  await Promise.all(
    order.map(async (stage) => {
      const handle = handleByStage.get(stage.id)!
      const finalState = await scheduler.waitForTerminal(handle)
      emit({
        type: finalState === JobStatus.COMPLETED ? 'success' : 'error',
        message: `${stage.name} (job ${handle}): ${finalState}`,
      })
    })
  )
}
