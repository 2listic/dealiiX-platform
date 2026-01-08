import { initialNodes, initialEdges } from '../data/flowData'
import type { ImportedNodes, NodeData } from '../types/nodeTypes'
import {
  nodesFromProtocolToFlow,
  edgesFromProtocolToFlow,
  validateGraphData,
} from '../utils/graphParser'

/**
 * Svelte internal nodes and edges states
 */
let nodes = $state.raw(initialNodes)
let edges = $state.raw(initialEdges)

export const getNodes = () => nodes
export const getEdges = () => edges
export const setNodes = (newNodes) => (nodes = newNodes)
export const removeNode = (nodeId) => {
  nodes = nodes.filter((node) => node.id !== nodeId)
  edges = edges.filter(
    (edge) => edge.source !== nodeId && edge.target !== nodeId
  )
}
export const setEdges = (newEdges) => (edges = newEdges)

/**
 * Node ID managment
 */
let lastNodeId = $state<number>(0)

export const updateLastNodeId = () => {
  lastNodeId = nodes.reduce((max, node) => Math.max(max, parseInt(node.id)), -1)
}
updateLastNodeId() // Initialize lastNodeId

export const getNextNodeId = () => {
  lastNodeId++
  return lastNodeId
}

/**
 * Application registry containing all the available nodes
 */
let registry = $state<ImportedNodes>({})

/**
 * Set the application registry for the available nodes
 * @param {ImportedNodes} data
 */
export const setRegistry = (data: ImportedNodes) => {
  registry = data
  console.log('Imported registry', $state.snapshot(registry))
}

/**
 * Get all the available nodes from the registry
 * @returns {NodeData[]}
 */
export const getAvailableNodes = (): NodeData[] => {
  const nodes = Object.values(registry)
  return nodes
}

export const getNodeData = (type) => {
  if (!(type in registry)) {
    console.error(`Node type '${type}' was not found in the list of available nodes.`)
    throw new Error(`Node type '${type}' was not found in the list of available nodes.`)
  }
  return $state.snapshot(registry[type])
}

/**
 * Load a graph object into the flow editor
 * @param {Object} graphData - The graph data object containing workflow.nodes and workflow.edges
 * @returns {{ success: boolean, error?: string }}
 */
export const loadGraph = (graphData) => {
  const validation = validateGraphData(graphData)
  if ('error' in validation) {
    return { success: false, error: validation.error }
  }

  // Reset then load (ensures UI updates correctly)
  setNodes([])
  setEdges([])

  setNodes(nodesFromProtocolToFlow(validation.nodes))
  setEdges(edgesFromProtocolToFlow(validation.edges))
  updateLastNodeId()

  return { success: true }
}
