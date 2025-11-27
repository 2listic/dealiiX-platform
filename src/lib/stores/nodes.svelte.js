import { initialNodes, initialEdges } from '../data/flowData'
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
let lastNodeId = $state()

export const updateLastNodeId = () => {
  lastNodeId = nodes.reduce((max, node) => Math.max(max, parseInt(node.id)), -1)
}
updateLastNodeId() // Initialize lastNodeId

export const getNextNodeId = () => {
  lastNodeId++
  return lastNodeId
}

/**
 * Imported available nodes managment
 */
let importedData = $state({})

export const setImportedNodes = (data) => {
  const nodes = Object.values(data)

  // Group nodes by node_type
  const nodesByNodetype = nodes.reduce((acc, node) => {
    const nodeType = node.node_type
    if (!acc[nodeType]) {
      acc[nodeType] = []
    }
    acc[nodeType].push(node)
    return acc
  }, Object.create(null))
  importedData = nodesByNodetype
  console.log('importedData', $state.snapshot(importedData))
}

export const getImportedNodes = () => importedData

export const getImportedNodesByType = (svelteNodeType) => {
  if (!(svelteNodeType in importedData)) {
    console.error(`Node type '${svelteNodeType}' not found in imported data.`)
  }
  return importedData?.[svelteNodeType] || []
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
