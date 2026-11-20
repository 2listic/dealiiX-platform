import type { Edge, Node } from '@xyflow/svelte'
import {
  resolveOverloadGraph,
  type OverloadResolution,
} from '../registry/overloadResolution'
import type {
  NodeDefinitions,
  StandardNodeDefinition,
} from '../types/nodeTypes'
import {
  getEdges,
  getEdgesSnapshot,
  getNodes,
  getNodesSnapshot,
} from './nodes.svelte'

type ResolvedGraph = {
  nodes: Node[]
  edges: Edge[]
  resolution: OverloadResolution
}

let lastResolved: ResolvedGraph | null = null

// One resolution of the canvas for every family node. A drag or a selection
// gives new node objects with the same `data`, so the previous result, and its
// identity, is kept: the family nodes reading it do not re-run.
const resolution = $derived.by((): OverloadResolution => {
  const nodes = getNodes()
  const edges = getEdges()
  if (
    lastResolved &&
    sameNodeData(lastResolved.nodes, nodes) &&
    sameConnections(lastResolved.edges, edges)
  ) {
    lastResolved = { ...lastResolved, nodes, edges }
    return lastResolved.resolution
  }
  lastResolved = {
    nodes,
    edges,
    resolution: resolveOverloadGraph(
      getNodesSnapshot() as Node<NodeDefinitions>[],
      getEdgesSnapshot()
    ),
  }
  return lastResolved.resolution
})

/**
 * Returns the variants a family node on the canvas can still be, given its
 * edges.
 * @param nodeId - Canvas id of the family node.
 * @returns The remaining variants (empty when none fits), or undefined when
 *   the node is not a family on the canvas.
 */
export const getOverloadCandidates = (
  nodeId: string
): StandardNodeDefinition[] | undefined => resolution.candidatesByNodeId[nodeId]

// ── Private helpers ──

const sameNodeData = (previous: Node[], next: Node[]): boolean =>
  previous.length === next.length &&
  previous.every(
    (node, index) =>
      node.id === next[index].id && node.data === next[index].data
  )

const sameConnections = (previous: Edge[], next: Edge[]): boolean =>
  previous.length === next.length &&
  previous.every((edge, index) => {
    const other = next[index]
    return (
      edge.source === other.source &&
      edge.target === other.target &&
      edge.sourceHandle === other.sourceHandle &&
      edge.targetHandle === other.targetHandle
    )
  })
