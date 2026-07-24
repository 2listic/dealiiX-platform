/**
 * Pure dependency-resolution for pipelines. Topologically sorts the DAG so the
 * orchestrator can submit each stage after its parents, and rejects cyclic graphs
 * up front. No app/IO dependencies — trivially unit-testable and portable.
 *
 * Uses generic graph vocabulary (`nodes`) internally — it consumes the pipeline's
 * `nodes` array and the algorithm is a plain Kahn topo sort — while the elements
 * are typed as {@link PipelineStage}.
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
 * Returns the ids of the direct parents of a node (the sources of edges that
 * target it). Parents must complete before the node runs.
 * @param nodeId - The node whose parents to collect.
 * @param edges - All pipeline edges.
 * @returns The deduplicated list of parent node ids.
 */
export const parentsOf = (nodeId: string, edges: PipelineEdge[]): string[] => {
  const parents = new Set<string>()
  for (const edge of edges) {
    if (edge.target === nodeId) parents.add(edge.source)
  }
  return [...parents]
}

/**
 * Topologically sorts a pipeline's nodes using Kahn's algorithm so that every
 * node appears after all of its parents.
 * @param pipeline - The pipeline whose nodes and edges to order.
 * @returns The stages in a valid execution order.
 * @throws {PipelineCycleError} If the dependency graph contains a cycle.
 */
export const resolveExecutionOrder = (pipeline: Pipeline): PipelineStage[] => {
  const { nodes, edges } = pipeline
  const nodeById = new Map(nodes.map((node) => [node.id, node]))

  // Only count edges between known nodes so dangling edges can't corrupt counts.
  const validEdges = edges.filter(
    (edge) => nodeById.has(edge.source) && nodeById.has(edge.target)
  )

  const indegree = new Map<string, number>(nodes.map((node) => [node.id, 0]))
  const children = new Map<string, string[]>(nodes.map((node) => [node.id, []]))
  for (const edge of validEdges) {
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1)
    children.get(edge.source)!.push(edge.target)
  }

  // Seed the queue with all roots (no unmet dependencies), preserving input order.
  const queue = nodes
    .filter((node) => indegree.get(node.id) === 0)
    .map((n) => n.id)
  const order: PipelineStage[] = []

  while (queue.length > 0) {
    const id = queue.shift()!
    order.push(nodeById.get(id)!)
    for (const child of children.get(id)!) {
      const next = indegree.get(child)! - 1
      indegree.set(child, next)
      if (next === 0) queue.push(child)
    }
  }

  // Fewer ordered nodes than total ⇒ at least one node never reached indegree 0.
  if (order.length !== nodes.length) {
    throw new PipelineCycleError()
  }

  return order
}
