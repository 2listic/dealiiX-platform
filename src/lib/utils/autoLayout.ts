import dagre from 'dagre'
import type { Edge, Node } from '@xyflow/svelte'

const DEFAULT_NODE_WIDTH = 240
const DEFAULT_NODE_HEIGHT = 120

const getNodeWidth = (node: Node): number =>
  node.width ?? node.measured?.width ?? DEFAULT_NODE_WIDTH

const getNodeHeight = (node: Node): number =>
  node.height ?? node.measured?.height ?? DEFAULT_NODE_HEIGHT

export const applyAutoLayout = (
  nodes: Node[],
  edges: Edge[],
  direction: 'LR' | 'TB' = 'LR'
): Node[] => {
  if (nodes.length === 0) {
    return []
  }

  const graph = new dagre.graphlib.Graph()
  graph.setDefaultEdgeLabel(() => ({}))
  graph.setGraph({
    rankdir: direction,
    nodesep: 48,
    ranksep: 96,
    marginx: 24,
    marginy: 24,
  })

  nodes.forEach((node) => {
    graph.setNode(node.id, {
      width: getNodeWidth(node),
      height: getNodeHeight(node),
    })
  })

  edges.forEach((edge) => {
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
      graph.setEdge(edge.source, edge.target)
    }
  })

  dagre.layout(graph)

  return nodes.map((node) => {
    const layoutNode = graph.node(node.id)
    if (!layoutNode) {
      return node
    }

    const width = getNodeWidth(node)
    const height = getNodeHeight(node)

    return {
      ...node,
      position: {
        x: layoutNode.x - width / 2,
        y: layoutNode.y - height / 2,
      },
    }
  })
}
