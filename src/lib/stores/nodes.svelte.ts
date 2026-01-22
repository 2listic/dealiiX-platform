import { initialNodes, initialEdges } from '../data/flowData'
import {
  type RegisteredNodes,
  type NodeData,
  type NetworkNodes,
  type NetworkEdges,
} from '../types/nodeTypes'
import {
  nodesFromProtocolToFlow,
  edgesFromProtocolToFlow,
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
  if (!isNodeInRegistry(type)) {
    console.error(`Node type '${type}' was not found in the available nodes.`)
    throw new Error(`Node type '${type}' was not found in the available nodes.`)
  }
  return $state.snapshot(registry[type])
}

/**
 * Returns if node is present in the registry of the available nodes
 * @param {string} type - The node type identifier (e.g., 'Triangulation', 'DoFHandler')
 * @returns {boolean} True if present, false if not
 */
export const isNodeInRegistry = (type: string): boolean => {
  return type in registry
}

/**
 * Store containing all the registered network nodes
 */
let networkNodes = $state<RegisteredNodes>({})

/**
 * Set the application store for the available network nodes
 * @param {RegisteredNodes} data - Dictionary of node data to register
 */
export const setNetworkNodes = (data: RegisteredNodes) => {
  networkNodes = data
  console.log('Imported network nodes', $state.snapshot(registry))
}

/**
 * Add or update a single network node in the relative store
 * @param {string} key - The unique identifier for the network node
 * @param {NodeData} nodeData - The node data to add or update
 */
export const addNetworkNode = (key: string, nodeData: NodeData) => {
  networkNodes = { ...networkNodes, [key]: nodeData }
  console.log(`Network node '${key}' added/updated`, $state.snapshot(nodeData))
}

/**
 * Get all the stored network nodes
 * @remarks Returns reactive state - changes will trigger UI updates
 * @returns {NodeData[]}
 */
export const getStoredNetworkNodes = (): NodeData[] => {
  const nodes = Object.values(networkNodes)
  return nodes
}

/**
 * Get network node data from the networkNodes store by name
 * @param {string} name - The network node name identifier (unique key for the network node)
 * @returns {NodeData} A snapshot (non-reactive copy) of the node data for the given network node
 * @throws {Error} If the network node name is not found in the networkNodes store
 */
export const getNetworkNodeData = (name: string): NodeData => {
  if (!isNodeInNetworkNodes(name)) {
    console.error(`Sub-graph node '${name}' not found in networkNodes store`)
    throw new Error(`Sub-graph node '${name}' not found in networkNodes store`)
  }
  return $state.snapshot(networkNodes[name])
}

/**
 * Returns if network node exists in the networkNodes store
 * @param {string} name - The network node name identifier (unique key for the network node)
 * @returns {boolean} True if exists, false if not
 */
export const isNodeInNetworkNodes = (name: string): boolean => {
  return name in networkNodes
}

/**
 * Load a graph into the flow editor. Converts protocol format to flow format
 * and updates both nodes and edges in the editor
 * @param {NetworkNodes} nodes - The nodes to load
 * @param {NetworkEdges} edges - The edges to load
 */
export const loadGraph = (nodes: NetworkNodes, edges: NetworkEdges): void => {
  // Reset then load (ensures UI updates correctly)
  setNodes([])
  setEdges([])

  const xyflowNodes = nodesFromProtocolToFlow(nodes)
  setNodes(xyflowNodes)
  const xyFlowEdges = edgesFromProtocolToFlow(edges)
  setEdges(xyFlowEdges)
  updateLastNodeId()
}
