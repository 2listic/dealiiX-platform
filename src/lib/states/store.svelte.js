import { initialNodes, initialEdges } from '../data/flowData'
import { NodeType } from '../types/nodeTypes'

let nodes = $state.raw(initialNodes)
let edges = $state.raw(initialEdges)

export const getNodes = () => nodes
export const getEdges = () => edges
export const setNodes = (newNodes) => nodes = newNodes
export const setEdges = (newEdges) => edges = newEdges

const maxId = initialNodes.reduce((max, node) => Math.max(max, parseInt(node.id)), 0)
let lastNodeId = $state(maxId)
export const getNextNodeId = () => {
  lastNodeId++
  return lastNodeId
}

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
export const getImportedNodesByType = (svelteNodeType) => {
  if (!(svelteNodeType in importedData)) {
    console.error(`Node type '${svelteNodeType}' not found in imported data.`)
  }
  return importedData?.[svelteNodeType] || []
}