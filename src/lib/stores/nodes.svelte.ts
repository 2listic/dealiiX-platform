import { initialNodes, initialEdges } from '../data/flowData'
import type { RegisteredNodes, Network, NodeData } from '../types/nodeTypes'
import {
  nodesFromProtocolToFlow,
  edgesFromProtocolToFlow,
  validateGraphData,
} from '../utils/graphParser'
import type { Node, Edge } from '@xyflow/svelte'

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
 * Node ID management
 */
let lastNodeId = $state<number>(0)

/**
 * Update the last used node ID based on current nodes
 * Scans all nodes to find the highest ID value
 */
export const updateLastNodeId = (): void => {
  lastNodeId = nodes.reduce((max, node) => Math.max(max, parseInt(node.id)), -1)
}
updateLastNodeId() // Initialize lastNodeId

/**
 * Get the next available node ID
 * Increments the internal counter and returns the new ID
 * @returns {number} The next available node ID
 */
export const getNextNodeId = (): number => {
  lastNodeId++
  return lastNodeId
}

/**
 * Application registry containing all the available nodes
 */
let registry = $state<RegisteredNodes>({})

/**
 * Set the application registry for the available nodes
 * @param {RegisteredNodes} data - Dictionary of node data to register
 */
export const setRegistry = (data: RegisteredNodes) => {
  registry = data
  console.log('Imported registry', $state.snapshot(registry))
}

/**
 * Get all the available nodes from the registry
 * @remarks Returns reactive state - changes will trigger UI updates
 * @returns {NodeData[]}
 */
export const getAvailableNodes = (): NodeData[] => {
  const nodes = Object.values(registry)
  return nodes
}

/**
 * Get node data from the registry by type
 * @param {string} type - The node type identifier (e.g., 'Triangulation', 'DoFHandler')
 * @returns {NodeData} A snapshot (non-reactive copy) of the node data for the given type
 * @throws {Error} If the node type is not found in the registry
 */
export const getNodeData = (type: string): NodeData => {
  if (!(type in registry)) {
    console.error(
      `Node type '${type}' was not found in the list of available nodes.`
    )
    throw new Error(
      `Node type '${type}' was not found in the list of available nodes.`
    )
  }
  return $state.snapshot(registry[type])
}

/**
 * Load a graph object into the flow editor. Validates the graph data, then converts protocol
 * format to flow format and updates both nodes and edges in the editor
 * @param {Network} graphData - The graph data object containing workflow.nodes and workflow.edges
 * @throws {Error} If graph data is invalid or missing required fields
 */
export const loadGraph = (graphData: Network): void => {
  validateGraphData(graphData)

  // Reset then load (ensures UI updates correctly)
  setNodes([])
  setEdges([])

  const xyflowNodes = nodesFromProtocolToFlow(graphData.workflow.nodes)
  setNodes(xyflowNodes)
  const xyFlowEdges = edgesFromProtocolToFlow(graphData.workflow.edges)
  setEdges(xyFlowEdges)
  updateLastNodeId()
}
