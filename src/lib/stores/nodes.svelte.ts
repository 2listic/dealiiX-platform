import { initialNodes, initialEdges } from '../data/flowData'
import { setLastNodeId, getNextNodeId } from './nodeIdCounter.svelte'
export { getNextNodeId }
import type { Node, Edge } from '@xyflow/svelte'

// ============= Nodes and edges states (on the canvas) ================
/**
 * Svelte internal nodes and edges states
 */
let nodes = $state.raw(initialNodes)
let edges = $state.raw(initialEdges)

/**
 * Get the current nodes in the flow editor
 * @remarks Returns reactive state - changes will trigger UI updates
 * @returns {Node[]} Array of flow nodes
 */
export const getNodes = (): Node[] => nodes

/**
 * Get the current edges in the flow editor
 * @remarks Returns reactive state - changes will trigger UI updates
 * @returns {Edge[]} Array of flow edges
 */
export const getEdges = (): Edge[] => edges

/**
 * Get a plain snapshot of the current nodes for serialization/computation
 * @remarks Returns non-reactive snapshot
 * @returns {Node[]} Plain array of flow nodes
 */
export const getNodesSnapshot = (): Node[] => {
  return $state.snapshot(getNodes()) as unknown as Node[]
}

/**
 * Get a plain snapshot of the current edges for serialization/computation
 * @remarks Returns non-reactive snapshot
 * @returns {Edge[]} Plain array of flow edges
 */
export const getEdgesSnapshot = (): Edge[] => {
  return $state.snapshot(getEdges()) as unknown as Edge[]
}

/**
 * Replace all nodes in the flow editor
 * @param {Node[]} newNodes - Array of nodes to set
 */
export const setNodes = (newNodes: Node[]): void => {
  nodes = newNodes
}

/**
 * Remove a node and all connected edges from the flow editor
 * @param {string} nodeId - ID of the node to remove
 */
export const removeNode = (nodeId: string): void => {
  nodes = nodes.filter((node) => node.id !== nodeId)
  edges = edges.filter(
    (edge) => edge.source !== nodeId && edge.target !== nodeId
  )
}

/**
 * Replace all edges in the flow editor
 * @param {Edge[]} newEdges - Array of edges to set
 */
export const setEdges = (newEdges: Edge[]): void => {
  edges = newEdges
}

/**
 * Append a single node to the flow editor
 * @param {Node} node - The node to add
 */
export const addNode = (node: Node): void => {
  nodes = [...nodes, node]
}

/**
 * Append a single edge to the flow editor
 * @param {Edge} edge - The edge to add
 */
export const addEdge = (edge: Edge): void => {
  edges = [...edges, edge]
}

/**
 * Sync the ID counter to the highest node ID in the current graph.
 * Call this after loading a graph so new nodes don't collide with existing ones.
 */
export const updateLastNodeId = (): void => {
  setLastNodeId(
    nodes.reduce((max, node) => Math.max(max, parseInt(node.id)), -1)
  )
}
updateLastNodeId() // Initialize counter from current nodes
