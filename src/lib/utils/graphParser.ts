import { getNodeData } from '../stores/nodes.svelte'
import type { Network, NetworkEdge, NetworkNodes } from '../types/nodeTypes'
import type { Node, Edge } from '@xyflow/svelte'

/**
 * Takes nodes from the CORAL network JSON and transforms them into
 * xyflow-compatible node objects with positions and merged data
 * @param {NetworkNodes} nodes - Dictionary of nodes from network protocol
 * @returns {Node[]} Array of nodes formatted for the flow editor
 */
export const nodesFromProtocolToFlow = (nodes: NetworkNodes): Node[] => {
  const arrNodeIds = Object.keys(nodes)
  return arrNodeIds.map((id, index) => {
    const node = nodes[id]
    const nodeData = getNodeData(node.type)
    const concatData = { ...nodeData, ...node } // concat data from registry and network
    return {
      id: id,
      type: nodeData.node_type,
      position: {
        x: node.position?.x ?? index * 100,
        y: node.position?.y ?? index * 100,
      },
      data: concatData,
    }
  })
}

/**
 * Transforms CORAL network edges into xyflow-compatible edge objects
 * with proper source/target handles for node connection points
 * @param {Object.<string, NetworkEdge>} edges - Dictionary of edges keyed by edge ID
 * @returns {Edge[]} Array of edges formatted for the flow editor
 */
export const edgesFromProtocolToFlow = (edges: {
  [id: string]: NetworkEdge
}): Edge[] => {
  return Object.values(edges).map((edge) => ({
    id: `xy-edge__${edge.source}output-${edge.source_output}-${edge.target}input-${edge.target_input}`,
    source: edge.source.toString(),
    target: edge.target.toString(),
    sourceHandle: `output-${edge.source_output}`,
    targetHandle: `input-${edge.target_input}`,
  }))
}

/**
 * Parse nodes and edges into the CORAL network JSON format
 * @param {Node[]} nodes - Array of node objects from the flow editor
 * @param {Edge[]} edges - Array of edge objects from the flow editor
 * @returns {Network} Complete network object in CORAL protocol format
 */
export const parseGraph = (nodes: Node[], edges: Edge[]): Network => {
  const nodesGraph = nodes.reduce((acc, obj) => {
    acc[obj.id] = {
      ...obj.data,
      position: obj.position,
    }
    return acc
  }, {})

  const edgesGraph = edges.reduce((acc, obj, index) => {
    acc[index] = {
      source: parseInt(obj.source),
      target: parseInt(obj.target),
      source_output: parseInt(obj.sourceHandle.split('-')[1]),
      target_input: parseInt(obj.targetHandle.split('-')[1]),
    }
    return acc
  }, {})

  return {
    workflow: {
      nodes: nodesGraph,
      edges: edgesGraph,
    },
    version: 1,
    author: 'dealiix-platform',
    date_time_utc: new Date().toISOString(),
  }
}

/**
 * Validate workflow data from a graph object
 * @param {Network} graphData - The graph data object to validate
 * @throws {Error} If graph data is invalid or missing required fields
 */
export const validateGraphData = (graphData: Network): void => {
  if (!graphData) {
    throw new Error('No graph data provided')
  }

  const nodes = graphData?.workflow?.nodes
  if (nodes == null) {
    throw new Error('No nodes found in graph')
  }

  // check if all nodes are present in the registry (getNodeData throws if not found)
  for (const node of Object.values(nodes)) {
    getNodeData(node.type)
  }

  const edges = graphData?.workflow?.edges
  if (edges == null) {
    throw new Error('No edges found in graph')
  }
}
