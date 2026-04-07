import dagre from '@dagrejs/dagre'
import type { Edge, Node } from '@xyflow/svelte'

const DEFAULT_NODE_WIDTH = 240
const DEFAULT_NODE_HEIGHT = 120

/**
 * Positions nodes using the dagre rank-based layout algorithm.
 *
 * @param nodes - @xyflow nodes to lay out.
 * @param edges - Directed edges that define rank ordering.
 * @param direction - `'LR'` (left-to-right, default) or `'TB'` (top-to-bottom).
 * @returns New array of nodes with updated `position` fields; all other properties unchanged.
 */
export const applyAutoLayout = (
  nodes: Node[],
  edges: Edge[],
  direction: 'LR' | 'TB' = 'LR'
): Node[] => {
  // dagre.layout() throws on an empty graph
  if (nodes.length === 0) {
    return []
  }

  // create a new directed graph with dagre
  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({
    rankdir: direction,
    nodesep: 48, // px between nodes within the same rank (default: 10)
    ranksep: 96, // px between ranks (default: 10)
  })

  // register each node with its dimensions so dagre can compute spacing
  nodes.forEach((node) => {
    const width = getNodeWidth(node)
    const height = getNodeHeight(node)
    graph.setNode(node.id, { width, height })
  })

  // only add edges whose both endpoints are in this node set — guards against stale edges
  edges.forEach((edge) => {
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
      graph.setEdge(edge.source, edge.target)
    }
  })

  // ask dagre to compute the layout
  dagre.layout(graph)

  // update the nodes with the new positions
  return nodes.map((node) => {
    const layoutNode = graph.node(node.id)
    if (!layoutNode) {
      return node
    }

    // re-read dimensions here to compute the top-left offset from dagre's center position
    const width = getNodeWidth(node)
    const height = getNodeHeight(node)

    // dagre outputs center coordinates; @xyflow expects the top-left corner
    const x = layoutNode.x - width / 2
    const y = layoutNode.y - height / 2

    return { ...node, position: { x, y } }
  })
}

/**
 * @param node - @xyflow node.
 * @returns Explicit `width` override if set, else `measured?.width` (@xyflow populates this
 *   after the first DOM render), else the compile-time default.
 */
const getNodeWidth = (node: Node): number => {
  if (node.width != null) return node.width
  if (node.measured?.width != null) return node.measured.width
  return DEFAULT_NODE_WIDTH
}

/**
 * @param node - @xyflow node.
 * @returns Explicit `height` override if set, else `measured?.height` (@xyflow populates this
 *   after the first DOM render), else the compile-time default.
 */
const getNodeHeight = (node: Node): number => {
  if (node.height != null) return node.height
  if (node.measured?.height != null) return node.measured.height
  return DEFAULT_NODE_HEIGHT
}
