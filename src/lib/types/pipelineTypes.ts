/**
 * Types for the pipeline orchestrator: a higher-level DAG whose nodes are whole
 * CORAL graphs or standalone executables ("stages"). Edges express pure ordering
 * ("target runs after source") — no data/artifact passing in this MVP.
 *
 * Note the vocabulary split: the serialized JSON key is `nodes` (mirroring the
 * CORAL graph's `workflow.nodes`), but each element is a {@link PipelineStage} —
 * "stage" is the domain term used throughout the app (StageData, addCoralStage,
 * submitCoralStageRemote, …).
 *
 * Two related shapes:
 * - {@link Pipeline} — the flat orchestrator format (`toPipeline()`): `nodes`/`edges`.
 *   Each stage carries its `id`/`type`/`position` + payload.
 *   The coral-vs-executable discriminant is `type` ('coralStage' | 'executableStage'),
 *   matching the xyflow node type. The orchestrator ignores `position`.
 * - {@link PipelineFile} — the download/import format: {@link Pipeline} wrapped under
 *   a `pipeline` key plus a top-level metadata envelope, mirroring the CORAL graph
 *   export's `workflow`-wrapped-with-envelope shape.
 *
 * The xyflow canvas node holds the {@link StageData} under `node.data` — `id`/`type`/
 * `position` are node-level in xyflow, so they are not duplicated into `data`.
 */

import type { CoralJobConfig, ExecutableJobConfig } from './jobConfigTypes'
import type { ParameterTree } from './parameterTypes'

/** A pipeline stage that runs a whole CORAL graph. */
export type CoralPipelineStage = {
  id: string
  type: 'coralStage'
  position: { x: number; y: number }
  name: string
  /** A Network JSON object (loaded from a file or snapshotted from the canvas). */
  graph: unknown
  config: CoralJobConfig
}

/** A pipeline stage that runs a standalone executable with a parameters file. */
export type ExecutablePipelineStage = {
  id: string
  type: 'executableStage'
  position: { x: number; y: number }
  name: string
  /** Parameter tree loaded from a file, serialized to disk before the run. */
  parameters: ParameterTree | null
  /** Complete run-mechanics bag: executablePath, parametersFileName, timeLimit. */
  config: ExecutableJobConfig
}

/** A pipeline stage, discriminated on `type`. */
export type PipelineStage = CoralPipelineStage | ExecutablePipelineStage

/** Stage fields stored on a canvas node's `data` (the stage minus `id`/`type`/`position`, which live on the xyflow node). */
export type CoralStageData = Omit<
  CoralPipelineStage,
  'id' | 'type' | 'position'
>
export type ExecutableStageData = Omit<
  ExecutablePipelineStage,
  'id' | 'type' | 'position'
>
export type StageData = CoralStageData | ExecutableStageData

/** A dependency edge: `target` runs after `source` completes successfully. */
export type PipelineEdge = {
  source: string
  target: string
}

/** The flat orchestrator format: stages (JSON key `nodes`) + ordering edges. */
export type Pipeline = {
  nodes: PipelineStage[]
  edges: PipelineEdge[]
}

/** The download/import file format: {@link Pipeline} wrapped + a metadata envelope (stamped at export time). */
export type PipelineFile = {
  pipeline: Pipeline
  version: number
  author: string
  date_time_utc: string
}
