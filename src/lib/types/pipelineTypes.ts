/**
 * Types for the pipeline orchestrator: a higher-level DAG whose nodes ("stages")
 * are whole CORAL graphs or standalone executables. Edges express pure ordering
 * ("target runs after source") — no data/artifact passing in this MVP.
 */

import type { CoralJobConfig, ExecutableJobConfig } from '../utils/sshMessages'
import type { ParameterTree } from './parameterTypes'

/** A pipeline stage that runs a whole CORAL graph. */
export type CoralPipelineStage = {
  id: string
  name: string
  kind: 'coral'
  /** A Network JSON object (loaded from a file or snapshotted from the canvas). */
  graph: unknown
  config: CoralJobConfig
}

/** A pipeline stage that runs a standalone executable with a parameters file. */
export type ExecutablePipelineStage = {
  id: string
  name: string
  kind: 'executable'
  /** Parameter tree loaded from a file, serialized to disk before the run. */
  parameters: ParameterTree | null
  /** Complete run-mechanics bag: executablePath, parametersFileName, timeLimit. */
  config: ExecutableJobConfig
}

export type PipelineStage = CoralPipelineStage | ExecutablePipelineStage

/** Stage fields stored on a canvas node's `data` (the stage minus its id, which is the node id). */
export type CoralStageData = Omit<CoralPipelineStage, 'id'>
export type ExecutableStageData = Omit<ExecutablePipelineStage, 'id'>
export type StageData = CoralStageData | ExecutableStageData

/** A dependency edge: `target` runs after `source` completes successfully. */
export type PipelineEdge = {
  source: string
  target: string
}

/** A pipeline: a set of stages plus the ordering edges between them. */
export type Pipeline = {
  stages: PipelineStage[]
  edges: PipelineEdge[]
}
