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
    // check if node is a method or function because they are handled as a unique type/component
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

/**
 * Functions to parse nodes and edges from protocol into flow internal format
 */
export const nodesFromProtocolToFlow = (nodes) => {
  const arrNodeIds = Object.keys(nodes)

  const arrIdNodes = arrNodeIds.reduce((acc, id, index) => {
    // check if node is a method or function because they are handled as a unique type/component
    const type =
      'method_name' in nodes[id] ? nodes[id].method_name : nodes[id].type
    const positionX =
      'position' in nodes[id] ? nodes[id].position.x : index * 100
    const positionY =
      'position' in nodes[id] ? nodes[id].position.y : index * 100
    acc.push({
      id: id,
      type: type,
      position: { x: positionX, y: positionY },
      data: { ...nodes[id] },
    })
    return acc
  }, [])
  return arrIdNodes
}

export const edgesFromProtocolToFlow = (edges) => {
  const arrEdges = Object.values(edges)
  const arrParsedEdges = arrEdges.reduce((acc, edge) => {
    acc.push({
      id: `xy-edge__${edge.source}output-${edge.source_output}-${edge.target}input-${edge.target_input}`,
      source: edge.source.toString(),
      target: edge.target.toString(),
      sourceHandle: `output-${edge.source_output}`,
      targetHandle: `input-${edge.target_input}`,
    })
    return acc
  }, [])
  return arrParsedEdges
}
