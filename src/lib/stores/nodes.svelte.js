import { initialNodes, initialEdges } from '../data/flowData'
import { NodeType } from '../types/nodeTypes'

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
 * Node ID
 */
const maxId = initialNodes.reduce(
  (max, node) => Math.max(max, parseInt(node.id)),
  -1
)

let lastNodeId = $state(maxId)

export const getNextNodeId = () => {
  lastNodeId++
  return lastNodeId
}

/**
 * Imported available nodes
 */
let importedData = $state({})

export const setImportedNodes = (data) => {
  const nodes = Object.values(data)

  // Group nodes by node_type
  const nodesByNodetype = nodes.reduce((acc, node) => {
    const nodeType = 'method_name' in node ? NodeType.METHOD : node.node_type
    if (!acc[nodeType]) {
      acc[nodeType] = []
    }
    acc[nodeType].push(node)
    return acc
  }, {})
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
