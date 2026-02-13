import { initialNodes, initialEdges } from '../data/flowData'
import {
  type RegisteredNodes,
  type NodeData,
  type NetworkNodeOfTypeNetwork,
  type RegisteredNetworkNodes,
} from '../types/nodeTypes'
import type { Node, Edge } from '@xyflow/svelte'
import defaultNodesJson from '../data/defaultNodes.json'
import defaultNetworkNodesJson from '../data/defaultNetworkNodes.json'
import { filterValidNodes } from '../utils/registryValidator'

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

// ================= Registered nodes (sidebar) ========================

const defaultNodes = defaultNodesJson as RegisteredNodes

/**
 * Application registry containing all the available nodes
 */
let registry = $state<RegisteredNodes>({})

// Load registry from electron-store
const loadRegistry = async () => {
  if (window.electron?.store) {
    registry = await window.electron.store.get('registered_nodes', defaultNodes)
  } else {
    registry = defaultNodes
    console.warn('Electron store not available (e.g., dev:vite mode)')
  }
}
loadRegistry()

/**
 * Set the application registry for the available nodes.
 * Filters out entries that are not valid NodeData objects
 * @param  data - Dictionary of node data to register
 * @returns List of keys that were skipped due to invalid structure
 */
export const setRegistry = async (
  data: Record<string, unknown>
): Promise<string[]> => {
  const [filtered, skipped] = filterValidNodes(data)
  registry = filtered
  console.log('Imported registry', $state.snapshot(registry))
  await window.electron.store.set('registered_nodes', $state.snapshot(registry))
  return skipped
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
 * Get node data from the registry by type (snapshot for validation)
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

// ============ Registered network nodes section (sidebar) ======================

const defaultNetworkNodes = defaultNetworkNodesJson as RegisteredNetworkNodes

/**
 * Store containing all the registered network nodes
 */
let networkNodes = $state<RegisteredNetworkNodes>({})

// Load network nodes from electron-store
const loadNetworkNodes = async () => {
  if (window.electron?.store) {
    networkNodes = await window.electron.store.get(
      'registered_network_nodes',
      defaultNetworkNodes
    )
  } else {
    networkNodes = defaultNetworkNodes
    console.warn('Electron store not available (e.g., dev:vite mode)')
  }
}
loadNetworkNodes()

/**
 * Set the application store for the available network nodes and persist changes
 * @param {RegisteredNetworkNodes} data - Dictionary of node data to register
 */
export const setNetworkNodes = async (data: RegisteredNetworkNodes) => {
  networkNodes = data
  console.log('Imported network nodes', $state.snapshot(networkNodes))
  await window.electron.store.set(
    'registered_network_nodes',
    $state.snapshot(networkNodes)
  )
}

/**
 * Add or update a single network node in the relative store and persist changes
 * @param {string} key - The unique identifier for the network node
 * @param {NetworkNodeOfTypeNetwork} nodeData - The node data to add or update
 */
export const addNetworkNode = async (
  key: string,
  nodeData: NetworkNodeOfTypeNetwork
) => {
  networkNodes = { ...networkNodes, [key]: nodeData }
  console.log(`Network node '${key}' added/updated`, $state.snapshot(nodeData))
  await window.electron.store.set(
    'registered_network_nodes',
    $state.snapshot(networkNodes)
  )
}

/**
 * Remove a network node from the networkNodes store and persist changes
 * @param {string} name - The network node name identifier to remove
 * @throws {Error} If the network node name is not found in the networkNodes store
 */
export const removeNetworkNode = async (name: string) => {
  if (isNodeInNetworkNodes(name)) {
    delete networkNodes[name]
    await window.electron.store.set(
      'registered_network_nodes',
      $state.snapshot(networkNodes)
    )
  } else {
    throw new Error(`Network node '${name}' not found in networkNodes store`)
  }
}

/**
 * Get all the stored network nodes
 * @remarks Returns reactive state - changes will trigger UI updates
 * @returns {NetworkNodeOfTypeNetwork[]}
 */
export const getStoredNetworkNodes = (): NetworkNodeOfTypeNetwork[] => {
  const nodes = Object.values(networkNodes)
  return nodes
}

/**
 * Get network node data from the networkNodes store by name (snapshot for validation)
 * @param {string} name - The network node name identifier (unique key for the network node)
 * @returns {NetworkNodeOfTypeNetwork} A snapshot (non-reactive copy) of the node data for the given network node
 * @throws {Error} If the network node name is not found in the networkNodes store
 */
export const getNetworkNodeData = (name: string): NetworkNodeOfTypeNetwork => {
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
