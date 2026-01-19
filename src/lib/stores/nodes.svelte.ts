import { initialNodes, initialEdges } from '../data/flowData'
import type { RegisteredNodes, Network, NodeData } from '../types/nodeTypes'
import {
  nodesFromProtocolToFlow,
  edgesFromProtocolToFlow,
  validateGraphData,
  parseGraph,
} from '../utils/graphParser'
import type { Node, Edge } from '@xyflow/svelte'
import { NodeType, ConnectionType } from '../types/nodeTypes'
import type { Type } from '../types/nodeTypes'

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
 * Creates a new network node from the current graph by identifying free (unconnected)
 * inputs and outputs and encapsulating the entire graph structure.
 *
 * @param {string} name - The custom name for the network node
 * @returns {NodeData} A complete network node definition ready to be added to the networkNodes store
 * @throws {Error} If the current graph is empty (no nodes)
 */
export const createNewNetworkNode = (name: string): NodeData => {
  // Step 1: Retrieve current graph state
  const currentNodes = getNodes()
  const currentEdges = getEdges()

  // Step 1.1: Validate we have nodes
  if (currentNodes.length === 0) {
    throw new Error('Cannot create network node from empty graph')
  }

  // Step 2: Identify free inputs and outputs
  // We'll collect them with their node ID for sorting
  interface FreeConnection {
    nodeId: string
    argument: NodeData['arguments'][number]
    isFreeInput: boolean
    isFreeOutput: boolean
  }

  const freeConnectionsMap: Record<string, FreeConnection> = {}

  // Sort nodes by numeric ID for deterministic ordering
  const sortedNodes = [...currentNodes].sort(
    (a, b) => parseInt(a.id) - parseInt(b.id)
  )

  for (const node of sortedNodes) {
    const nodeData = node.data as NodeData

    // Check for free inputs
    if (nodeData.inputs && Array.isArray(nodeData.inputs)) {
      nodeData.inputs.forEach((argIndex, inputIndex) => {
        const targetHandle = `input-${inputIndex}`
        const isConnected = currentEdges.some(
          (edge) =>
            edge.target === node.id && edge.targetHandle === targetHandle
        )

        if (
          !isConnected &&
          nodeData.arguments &&
          nodeData.arguments[argIndex]
        ) {
          const arg = nodeData.arguments[argIndex]
          const key = `${node.id}-${arg.name}-${arg.type}`

          const existing = freeConnectionsMap[key]
          if (existing) {
            existing.isFreeInput = true
          } else {
            freeConnectionsMap[key] = {
              nodeId: node.id,
              argument: {
                connection_type: arg.connection_type,
                name: arg.name,
                type: arg.type,
              },
              isFreeInput: true,
              isFreeOutput: false,
            }
          }
        }
      })
    }

    // Check for free outputs
    if (nodeData.outputs && Array.isArray(nodeData.outputs)) {
      nodeData.outputs.forEach((argIndex, outputIndex) => {
        const sourceHandle = `output-${outputIndex}`
        const isConnected = currentEdges.some(
          (edge) =>
            edge.source === node.id && edge.sourceHandle === sourceHandle
        )

        if (!isConnected) {
          // Handle SELF outputs (argIndex === -1)
          if (argIndex === -1) {
            const key = `${node.id}-self-${nodeData.type}`
            freeConnectionsMap[key] = {
              nodeId: node.id,
              argument: {
                connection_type: ConnectionType.OUTPUT,
                name: 'self',
                type: nodeData.type as Type,
              },
              isFreeInput: false,
              isFreeOutput: true,
            }
          } else if (nodeData.arguments && nodeData.arguments[argIndex]) {
            // Handle regular outputs with arguments
            const arg = nodeData.arguments[argIndex]
            const key = `${node.id}-${arg.name}-${arg.type}`

            const existing = freeConnectionsMap[key]
            if (existing) {
              existing.isFreeOutput = true
            } else {
              freeConnectionsMap[key] = {
                nodeId: node.id,
                argument: {
                  connection_type: arg.connection_type,
                  name: arg.name,
                  type: arg.type,
                },
                isFreeInput: false,
                isFreeOutput: true,
              }
            }
          }
        }
      })
    }
  }

  // Step 3: Build the arguments array
  // Sort by node ID, then process to determine final connection_type
  const sortedFreeConnections = Object.values(freeConnectionsMap).sort(
    (a, b) => parseInt(a.nodeId) - parseInt(b.nodeId)
  )

  const argumentsArray: NodeData['arguments'] = []
  const inputsArray: number[] = []
  const outputsArray: number[] = []

  sortedFreeConnections.forEach((conn) => {
    let finalConnectionType: ConnectionType

    if (conn.isFreeInput && conn.isFreeOutput) {
      // Both input and output → pass_through
      finalConnectionType = ConnectionType.PASSTHROUGH
    } else if (conn.isFreeInput) {
      finalConnectionType = ConnectionType.INPUT
    } else {
      finalConnectionType = ConnectionType.OUTPUT
    }

    const currentIndex = argumentsArray.length
    argumentsArray.push({
      connection_type: finalConnectionType,
      name: conn.argument.name,
      type: conn.argument.type,
    })

    // Step 4: Build inputs and outputs arrays
    if (
      finalConnectionType === ConnectionType.INPUT ||
      finalConnectionType === ConnectionType.PASSTHROUGH
    ) {
      inputsArray.push(currentIndex)
    }

    if (
      finalConnectionType === ConnectionType.OUTPUT ||
      finalConnectionType === ConnectionType.PASSTHROUGH
    ) {
      outputsArray.push(currentIndex)
    }
  })

  // Step 5: Serialize the graph to the value field
  const graphData = parseGraph(currentNodes, currentEdges)
  const value = JSON.stringify(graphData)

  // Step 6: Construct the final NodeData object
  return {
    type: 'coral::Network',
    node_type: NodeType.NETWORK,
    name: name,
    arguments: argumentsArray,
    inputs: inputsArray,
    outputs: outputsArray,
    value: value,
    is_valid: true,
  }
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
