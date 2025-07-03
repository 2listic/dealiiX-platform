import { initialNodes, initialEdges } from '../data/flowData'

let nodes = $state.raw(initialNodes)
let edges = $state.raw(initialEdges)
 
export const getNodes = () => nodes
export const getEdges = () => edges
export const setNodes = (newNodes) => nodes = newNodes
export const setEdges = (newEdges) => edges = newEdges

let lastNodeId = $state(initialNodes.length+1)
export const getNextNodeId = () => lastNodeId++