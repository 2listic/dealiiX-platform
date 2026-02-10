import type { Node, Edge } from '@xyflow/svelte'
import {
  ConnectionType,
  NodeType,
  type Type,
  type NodeData,
  TypeField,
  type NetworkNodeOfTypeNetwork,
} from '../types/nodeTypes'
import { parseGraph } from './graphParser'

/**
 * Creates a new network node from the provided graph by identifying free (unconnected)
 * inputs and outputs and encapsulating the entire graph structure.
 *
 * @param {string} name - The custom name for the network node
 * @param {Node[]} currentNodes - Array of nodes (must be snapshots, not reactive)
 * @param {Edge[]} currentEdges - Array of edges (must be snapshots, not reactive)
 * @returns {NetworkNodeOfTypeNetwork} A complete network node definition ready to be added to the networkNodes store
 * @throws {Error} If the graph is empty (no nodes)
 */
export const createNewNetworkNode = (
  name: string,
  currentNodes: Node[],
  currentEdges: Edge[]
): NetworkNodeOfTypeNetwork => {
  // Step 1: Validate there are nodes
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
  const value = graphData

  // Step 6: Construct the final NodeData object
  return {
    type: TypeField.CORAL_NETWORK,
    node_type: NodeType.NETWORK,
    name: name,
    arguments: argumentsArray,
    inputs: inputsArray,
    outputs: outputsArray,
    value: value,
    is_valid: true,
  }
}
