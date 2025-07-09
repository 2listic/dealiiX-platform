import { initialNodes, initialEdges } from '../data/flowData'

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