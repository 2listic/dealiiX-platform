import type { Node, Edge } from '@xyflow/svelte'
import {
  ConnectionType,
  NodeType,
  type Type,
  type StandardNodeDefinition,
  TypeField,
  type SubGraphNodeDefinition,
  type LeanStandardNode,
  isSubGraphNodeDefinition,
} from '../types/nodeTypes'
import { parseGraphToProtocol } from './graphParser'
import { handleIdToIndex } from './canvasNodeUtils'
import { getNetworkNodeDefinition, getNodeData } from '../stores/nodes.svelte'

type SelectionPortBindings = {
  networkNode: SubGraphNodeDefinition
  inputHandleByTarget: Record<string, number>
  outputHandleBySource: Record<string, number>
  targetByInputHandle: Record<number, { nodeId: string; handleId: string }>
  sourceByOutputHandle: Record<number, { nodeId: string; handleId: string }>
}

type BoundaryAnalysis = Omit<SelectionPortBindings, 'networkNode'> & {
  argumentsArray: StandardNodeDefinition['arguments']
  inputsArray: number[]
  outputsArray: number[]
}

type ExpandedSubgraphSelection = {
  expandedNodes: Node[]
  expandedInternalEdges: Edge[]
  targetByInputHandle: Record<number, { nodeId: string; handleId: string }>
  sourceByOutputHandle: Record<number, { nodeId: string; handleId: string }>
}

type FlattenedSelectedSubgraphs = {
  nodes: Node[]
  edges: Edge[]
  aliasedInputTargetByOriginal: Record<string, string>
  aliasedOutputSourceByOriginal: Record<string, string>
}

/**
 * Creates a new network node from the provided graph by identifying free (unconnected)
 * inputs and outputs and encapsulating the entire graph structure.
 *
 * @param {string} name - The custom name for the network node
 * @param {Node[]} currentNodes - Array of nodes (must be snapshots, not reactive)
 * @param {Edge[]} currentEdges - Array of edges (must be snapshots, not reactive)
 * @returns {SubGraphNodeDefinition} A complete network node definition ready to be added to the networkNodes store
 * @throws {Error} If the graph is empty (no nodes)
 */
export const createNewNetworkNode = (
  name: string,
  currentNodes: Node[],
  currentEdges: Edge[]
): SubGraphNodeDefinition => {
  return createNetworkNodeWithBindings(name, currentNodes, currentEdges)
    .networkNode
}

export const createNetworkNodeWithBindings = (
  name: string,
  currentNodes: Node[],
  currentEdges: Edge[]
): SelectionPortBindings => {
  const boundary = analyzeNetworkBoundary(currentNodes, currentEdges)

  // Step 5: Serialize the graph to the value field
  const graphData = parseGraphToProtocol(currentNodes, currentEdges)
  const value = graphData

  // Step 6: Construct the final node definition object
  const networkNode: SubGraphNodeDefinition = {
    type: TypeField.CORAL_NETWORK,
    node_type: NodeType.NETWORK,
    name: name,
    arguments: boundary.argumentsArray,
    inputs: boundary.inputsArray,
    outputs: boundary.outputsArray,
    value: value,
    is_valid: true,
  }

  return {
    networkNode,
    ...boundary,
  }
}

const analyzeNetworkBoundary = (
  currentNodes: Node[],
  currentEdges: Edge[]
): BoundaryAnalysis => {
  // Step 1: Validate there are nodes
  if (currentNodes.length === 0) {
    throw new Error('Cannot create network node from empty graph')
  }

  // Step 2: Identify free inputs and outputs
  // We'll collect them with their node ID for sorting
  interface FreeConnection {
    nodeId: string
    argument: StandardNodeDefinition['arguments'][number]
    isFreeInput: boolean
    isFreeOutput: boolean
    inputHandles: string[]
    outputHandles: string[]
  }

  const freeConnectionsMap: Record<string, FreeConnection> = {}

  // Sort nodes by numeric ID for deterministic ordering
  const sortedNodes = [...currentNodes].sort(
    (a, b) => parseInt(a.id) - parseInt(b.id)
  )

  for (const node of sortedNodes) {
    const nodeData = node.data as
      | StandardNodeDefinition
      | SubGraphNodeDefinition

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
              inputHandles: [targetHandle],
              outputHandles: [],
            }
          }
          existing?.inputHandles.push(targetHandle)
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
              inputHandles: [],
              outputHandles: [sourceHandle],
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
                inputHandles: [],
                outputHandles: [sourceHandle],
              }
            }
            existing?.outputHandles.push(sourceHandle)
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

  const argumentsArray: StandardNodeDefinition['arguments'] = []
  const inputsArray: number[] = []
  const outputsArray: number[] = []
  const inputHandleByTarget: Record<string, number> = {}
  const outputHandleBySource: Record<string, number> = {}
  const targetByInputHandle: Record<
    number,
    { nodeId: string; handleId: string }
  > = {}
  const sourceByOutputHandle: Record<
    number,
    { nodeId: string; handleId: string }
  > = {}

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
      const networkInputHandleIndex = inputsArray.length - 1
      const firstInputHandle = conn.inputHandles[0]
      if (firstInputHandle) {
        targetByInputHandle[networkInputHandleIndex] = {
          nodeId: conn.nodeId,
          handleId: firstInputHandle,
        }
      }
      conn.inputHandles.forEach((handle) => {
        inputHandleByTarget[`${conn.nodeId}::${handle}`] =
          networkInputHandleIndex
      })
    }

    if (
      finalConnectionType === ConnectionType.OUTPUT ||
      finalConnectionType === ConnectionType.PASSTHROUGH
    ) {
      outputsArray.push(currentIndex)
      const networkOutputHandleIndex = outputsArray.length - 1
      const firstOutputHandle = conn.outputHandles[0]
      if (firstOutputHandle) {
        sourceByOutputHandle[networkOutputHandleIndex] = {
          nodeId: conn.nodeId,
          handleId: firstOutputHandle,
        }
      }
      conn.outputHandles.forEach((handle) => {
        outputHandleBySource[`${conn.nodeId}::${handle}`] =
          networkOutputHandleIndex
      })
    }
  })

  return {
    argumentsArray,
    inputsArray,
    outputsArray,
    inputHandleByTarget,
    outputHandleBySource,
    targetByInputHandle,
    sourceByOutputHandle,
  }
}

const resolveNetworkNodeValue = (node: Node): SubGraphNodeDefinition => {
  const data = node.data as Record<string, unknown>
  if (!isSubGraphNodeDefinition(data as SubGraphNodeDefinition)) {
    throw new Error(`Node '${node.id}' is not a subnetwork`)
  }

  if ('value' in data) {
    return data as SubGraphNodeDefinition
  }

  return getNetworkNodeDefinition((data as SubGraphNodeDefinition).name)
}

const createEdgeId = (
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle: string
): string => {
  return `xy-edge__${source}${sourceHandle}-${target}${targetHandle}`
}

const toCanvasNodeFromProtocol = (
  protocolNode: LeanStandardNode | SubGraphNodeDefinition,
  nodeId: string,
  positionOffset: { x: number; y: number },
  index: number
): Node => {
  const position = {
    x: (protocolNode.position?.x ?? index * 100) + positionOffset.x,
    y: (protocolNode.position?.y ?? index * 100) + positionOffset.y,
  }

  if (isSubGraphNodeDefinition(protocolNode)) {
    return {
      id: nodeId,
      type: protocolNode.node_type,
      position,
      selected: true,
      data: {
        ...protocolNode,
        position,
      },
    }
  }

  const storeNodeData = getNodeData(protocolNode.type)
  return {
    id: nodeId,
    type: storeNodeData.node_type,
    position,
    selected: true,
    data: {
      ...storeNodeData,
      position,
      ...(protocolNode.name && { name: protocolNode.name }),
      ...(protocolNode.value !== undefined && { value: protocolNode.value }),
      ...(protocolNode.base && { base: protocolNode.base }),
    },
  }
}

const expandSubgraphNodeSelection = (
  networkCanvasNode: Node,
  getNextId: () => number
): ExpandedSubgraphSelection => {
  const networkNodeData = resolveNetworkNodeValue(networkCanvasNode)
  const protocolNodes = Object.entries(networkNodeData.value.workflow.nodes)
  const protocolEdges = Object.values(networkNodeData.value.workflow.edges)

  if (protocolNodes.length === 0) {
    throw new Error('Cannot merge an empty subnetwork.')
  }

  const internalCentroid = protocolNodes.reduce(
    (acc, [, node], index) => ({
      x: acc.x + (node.position?.x ?? index * 100),
      y: acc.y + (node.position?.y ?? index * 100),
    }),
    { x: 0, y: 0 }
  )

  const positionOffset = {
    x: networkCanvasNode.position.x - internalCentroid.x / protocolNodes.length,
    y: networkCanvasNode.position.y - internalCentroid.y / protocolNodes.length,
  }

  const oldToNewNodeId: Record<string, string> = {}
  protocolNodes.forEach(([oldId]) => {
    oldToNewNodeId[oldId] = String(getNextId())
  })

  const expandedNodes = protocolNodes.map(([oldId, node], index) =>
    toCanvasNodeFromProtocol(node, oldToNewNodeId[oldId], positionOffset, index)
  )
  const expandedInternalEdges: Edge[] = protocolEdges.map((edge) => ({
    id: createEdgeId(
      oldToNewNodeId[String(edge.source)],
      `output-${edge.source_output}`,
      oldToNewNodeId[String(edge.target)],
      `input-${edge.target_input}`
    ),
    source: oldToNewNodeId[String(edge.source)],
    target: oldToNewNodeId[String(edge.target)],
    sourceHandle: `output-${edge.source_output}`,
    targetHandle: `input-${edge.target_input}`,
    selected: false,
  }))

  const boundary = analyzeNetworkBoundary(expandedNodes, expandedInternalEdges)

  return {
    expandedNodes,
    expandedInternalEdges,
    targetByInputHandle: boundary.targetByInputHandle,
    sourceByOutputHandle: boundary.sourceByOutputHandle,
  }
}

export const flattenSelectedSubgraphs = (
  selectedNodes: Node[],
  selectedEdges: Edge[],
  getNextId: () => number
): FlattenedSelectedSubgraphs => {
  let workingNodes: Node[] = selectedNodes.map((node) => ({
    ...node,
    selected: true,
  }))
  let workingEdges: Edge[] = selectedEdges.map((edge) => ({
    ...edge,
    selected: false,
  }))

  const aliasedInputTargetByOriginal: Record<string, string> = {}
  const aliasedOutputSourceByOriginal: Record<string, string> = {}

  const selectedSubgraphIds = selectedNodes
    .filter((node) =>
      isSubGraphNodeDefinition(
        node.data as StandardNodeDefinition | SubGraphNodeDefinition
      )
    )
    .map((node) => node.id)

  for (const subgraphNodeId of selectedSubgraphIds) {
    const subgraphNode = workingNodes.find((node) => node.id === subgraphNodeId)
    if (!subgraphNode) {
      continue
    }

    const expansion = expandSubgraphNodeSelection(subgraphNode, getNextId)

    Object.entries(expansion.targetByInputHandle).forEach(
      ([handleIndex, binding]) => {
        aliasedInputTargetByOriginal[
          `${subgraphNodeId}::input-${handleIndex}`
        ] = `${binding.nodeId}::${binding.handleId}`
      }
    )

    Object.entries(expansion.sourceByOutputHandle).forEach(
      ([handleIndex, binding]) => {
        aliasedOutputSourceByOriginal[
          `${subgraphNodeId}::output-${handleIndex}`
        ] = `${binding.nodeId}::${binding.handleId}`
      }
    )

    const rewiredSelectionEdges = workingEdges
      .map((edge) => {
        let source = edge.source
        let sourceHandle = edge.sourceHandle
        let target = edge.target
        let targetHandle = edge.targetHandle

        if (edge.source === subgraphNodeId) {
          const binding =
            expansion.sourceByOutputHandle[handleIdToIndex(edge.sourceHandle)]
          if (!binding) {
            return null
          }
          source = binding.nodeId
          sourceHandle = binding.handleId
        }

        if (edge.target === subgraphNodeId) {
          const binding =
            expansion.targetByInputHandle[handleIdToIndex(edge.targetHandle)]
          if (!binding) {
            return null
          }
          target = binding.nodeId
          targetHandle = binding.handleId
        }

        return {
          ...edge,
          id: createEdgeId(source, sourceHandle, target, targetHandle),
          source,
          sourceHandle,
          target,
          targetHandle,
          selected: false,
        }
      })
      .filter((edge) => edge !== null)

    workingNodes = [
      ...workingNodes.filter((node) => node.id !== subgraphNodeId),
      ...expansion.expandedNodes,
    ]
    workingEdges = [
      ...rewiredSelectionEdges,
      ...expansion.expandedInternalEdges,
    ]
  }

  return {
    nodes: workingNodes,
    edges: workingEdges,
    aliasedInputTargetByOriginal,
    aliasedOutputSourceByOriginal,
  }
}

export const expandNetworkNodeInGraph = (
  nodeId: string,
  allNodes: Node[],
  allEdges: Edge[],
  getNextId: () => number
): { nodes: Node[]; edges: Edge[] } => {
  const networkCanvasNode = allNodes.find((node) => node.id === nodeId)
  if (!networkCanvasNode) {
    throw new Error(`Node '${nodeId}' was not found.`)
  }

  const { expandedNodes, expandedInternalEdges } = expandSubgraphNodeSelection(
    networkCanvasNode,
    getNextId
  )

  const boundary = analyzeNetworkBoundary(expandedNodes, expandedInternalEdges)
  const incomingEdges = allEdges.filter((edge) => edge.target === nodeId)
  const outgoingEdges = allEdges.filter((edge) => edge.source === nodeId)
  const untouchedEdges = allEdges.filter(
    (edge) => edge.source !== nodeId && edge.target !== nodeId
  )

  const rewiredIncomingEdges = incomingEdges
    .map((edge) => {
      const handleIndex = Number.parseInt(edge.targetHandle.split('-')[1], 10)
      const binding = boundary.targetByInputHandle[handleIndex]
      if (!binding) {
        return null
      }

      return {
        ...edge,
        id: `xy-edge__${edge.source}${edge.sourceHandle}-${binding.nodeId}${binding.handleId}`,
        target: binding.nodeId,
        targetHandle: binding.handleId,
        selected: false,
      }
    })
    .filter((edge) => edge !== null)

  const rewiredOutgoingEdges = outgoingEdges
    .map((edge) => {
      const handleIndex = Number.parseInt(edge.sourceHandle.split('-')[1], 10)
      const binding = boundary.sourceByOutputHandle[handleIndex]
      if (!binding) {
        return null
      }

      return {
        ...edge,
        id: `xy-edge__${binding.nodeId}${binding.handleId}-${edge.target}${edge.targetHandle}`,
        source: binding.nodeId,
        sourceHandle: binding.handleId,
        selected: false,
      }
    })
    .filter((edge) => edge !== null)

  const survivingNodes = allNodes
    .filter((node) => node.id !== nodeId)
    .map((node) => ({ ...node, selected: false }))

  return {
    nodes: [...survivingNodes, ...expandedNodes],
    edges: [
      ...untouchedEdges.map((edge) => ({ ...edge, selected: false })),
      ...expandedInternalEdges,
      ...rewiredIncomingEdges,
      ...rewiredOutgoingEdges,
    ],
  }
}
