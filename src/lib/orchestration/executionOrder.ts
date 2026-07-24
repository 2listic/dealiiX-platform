/**
 * Pure dependency-resolution for pipelines. Topologically sorts the stage DAG so
 * the orchestrator can submit each stage after its parents, and rejects cyclic
 * graphs up front. No app/IO dependencies — trivially unit-testable and portable.
 */

import type {
  Pipeline,
  PipelineEdge,
  PipelineStage,
} from '../types/pipelineTypes'

/** Thrown by {@link resolveExecutionOrder} when the pipeline contains a cycle. */
export class PipelineCycleError extends Error {
  constructor(message = 'Pipeline contains a cycle') {
    super(message)
    this.name = 'PipelineCycleError'
  }
}

/**
 * Returns the ids of the direct parents of a stage (the sources of edges that
 * target it). Parents must complete before the stage runs.
 * @param stageId - The stage whose parents to collect.
 * @param edges - All pipeline edges.
 * @returns The deduplicated list of parent stage ids.
 */
export const parentsOf = (stageId: string, edges: PipelineEdge[]): string[] => {
  const parents = new Set<string>()
  for (const edge of edges) {
    if (edge.target === stageId) parents.add(edge.source)
  }
  return [...parents]
}

/**
 * Topologically sorts a pipeline's stages using Kahn's algorithm so that every
 * stage appears after all of its parents.
 * @param pipeline - The pipeline whose stages and edges to order.
 * @returns The stages in a valid execution order.
 * @throws {PipelineCycleError} If the dependency graph contains a cycle.
 */
export const resolveExecutionOrder = (pipeline: Pipeline): PipelineStage[] => {
  const { stages, edges } = pipeline
  const stageById = new Map(stages.map((stage) => [stage.id, stage]))

  // Only count edges between known stages so dangling edges can't corrupt counts.
  const validEdges = edges.filter(
    (edge) => stageById.has(edge.source) && stageById.has(edge.target)
  )

  const indegree = new Map<string, number>(stages.map((stage) => [stage.id, 0]))
  const children = new Map<string, string[]>(
    stages.map((stage) => [stage.id, []])
  )
  for (const edge of validEdges) {
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1)
    children.get(edge.source)!.push(edge.target)
  }

  // Seed the queue with all roots (no unmet dependencies), preserving input order.
  const queue = stages
    .filter((stage) => indegree.get(stage.id) === 0)
    .map((s) => s.id)
  const order: PipelineStage[] = []

  while (queue.length > 0) {
    const id = queue.shift()!
    order.push(stageById.get(id)!)
    for (const child of children.get(id)!) {
      const next = indegree.get(child)! - 1
      indegree.set(child, next)
      if (next === 0) queue.push(child)
    }
  }

  // Fewer ordered stages than total ⇒ at least one stage never reached indegree 0.
  if (order.length !== stages.length) {
    throw new PipelineCycleError()
  }

  return order
}
