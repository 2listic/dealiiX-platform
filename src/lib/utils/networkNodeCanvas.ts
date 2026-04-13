/**
 * Canvas-level operations on subnetwork (network) nodes.
 * Handles exploding a network node back into its constituent nodes/edges,
 * collapsing a selection into a new network node, and flattening nested subgraphs.
 *
 * Protocol-level definition building (SubGraphNodeDefinition, boundary analysis)
 * lives in networkNode.ts.
 */

import type { Node, Edge } from '@xyflow/svelte'
import {
  NodeType,
  type LeanStandardNode,
  type StandardNodeDefinition,
  type SubGraphNodeDefinition,
  isSubGraphNodeDefinition,
} from '../types/nodeTypes'
import { handleIdToIndex, createCustomEdge } from './canvasNodeUtils'
import {
  getEdgesSnapshot,
  getNextNodeId,
  getNodesSnapshot,
} from '../stores/nodes.svelte'
import {
  addNetworkNode,
  getNetworkNodeDefinition,
  getNodeData,
} from '../stores/registryStore.svelte'
import {
  analyzeNetworkBoundary,
  createNetworkNodeDefinition,
} from './networkNode'

type ExplodedSubgraphSelection = {
  explodedNodes: Node[]
  explodedInternalEdges: Edge[]
  networkInputToInternalHandle: Record<
    number,
    { nodeId: string; handleId: string }
  >
  networkOutputToInternalHandle: Record<
    number,
    { nodeId: string; handleId: string }
  >
}

type FlattenedSelectedSubgraphs = {
  nodes: Node[]
  edges: Edge[]
  aliasedInputTargetByOriginal: Record<string, string>
  aliasedOutputSourceByOriginal: Record<string, string>
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

const explodeSubgraphNodeSelection = (
  networkCanvasNode: Node,
  getNextId: () => number
): ExplodedSubgraphSelection => {
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

  const explodedNodes = protocolNodes.map(([oldId, node], index) =>
    toCanvasNodeFromProtocol(node, oldToNewNodeId[oldId], positionOffset, index)
  )
  const explodedInternalEdges: Edge[] = protocolEdges.map((edge) => ({
    ...createCustomEdge({
      source: oldToNewNodeId[String(edge.source)],
      sourceHandle: `output-${edge.source_output}`,
      target: oldToNewNodeId[String(edge.target)],
      targetHandle: `input-${edge.target_input}`,
    }),
    selected: false,
  }))

  const boundary = analyzeNetworkBoundary(explodedNodes, explodedInternalEdges)

  return {
    explodedNodes,
    explodedInternalEdges,
    networkInputToInternalHandle: boundary.networkInputToInternalHandle,
    networkOutputToInternalHandle: boundary.networkOutputToInternalHandle,
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

    const explosion = explodeSubgraphNodeSelection(subgraphNode, getNextId)

    Object.entries(explosion.networkInputToInternalHandle).forEach(
      ([handleIndex, binding]) => {
        aliasedInputTargetByOriginal[
          `${subgraphNodeId}::input-${handleIndex}`
        ] = `${binding.nodeId}::${binding.handleId}`
      }
    )

    Object.entries(explosion.networkOutputToInternalHandle).forEach(
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
            explosion.networkOutputToInternalHandle[
              handleIdToIndex(edge.sourceHandle)
            ]
          if (!binding) {
            return null
          }
          source = binding.nodeId
          sourceHandle = binding.handleId
        }

        if (edge.target === subgraphNodeId) {
          const binding =
            explosion.networkInputToInternalHandle[
              handleIdToIndex(edge.targetHandle)
            ]
          if (!binding) {
            return null
          }
          target = binding.nodeId
          targetHandle = binding.handleId
        }

        return {
          ...edge,
          id: `xy-edge__${source}${sourceHandle}-${target}${targetHandle}`,
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
      ...explosion.explodedNodes,
    ]
    workingEdges = [
      ...rewiredSelectionEdges,
      ...explosion.explodedInternalEdges,
    ]
  }

  return {
    nodes: workingNodes,
    edges: workingEdges,
    aliasedInputTargetByOriginal,
    aliasedOutputSourceByOriginal,
  }
}

export const explodeNetworkNodeInGraph = (
  nodeId: string,
  allNodes: Node[],
  allEdges: Edge[],
  getNextId: () => number
): { nodes: Node[]; edges: Edge[] } => {
  const networkCanvasNode = allNodes.find((node) => node.id === nodeId)
  if (!networkCanvasNode) {
    throw new Error(`Node '${nodeId}' was not found.`)
  }

  const { explodedNodes, explodedInternalEdges } = explodeSubgraphNodeSelection(
    networkCanvasNode,
    getNextId
  )

  const boundary = analyzeNetworkBoundary(explodedNodes, explodedInternalEdges)
  const incomingEdges = allEdges.filter((edge) => edge.target === nodeId)
  const outgoingEdges = allEdges.filter((edge) => edge.source === nodeId)
  const untouchedEdges = allEdges.filter(
    (edge) => edge.source !== nodeId && edge.target !== nodeId
  )

  const rewiredIncomingEdges = incomingEdges
    .map((edge) => {
      const handleIndex = Number.parseInt(edge.targetHandle.split('-')[1], 10)
      const binding = boundary.networkInputToInternalHandle[handleIndex]
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
      const binding = boundary.networkOutputToInternalHandle[handleIndex]
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

  const unselectedNodes = allNodes
    .filter((node) => node.id !== nodeId)
    .map((node) => ({ ...node, selected: false }))

  return {
    nodes: [...unselectedNodes, ...explodedNodes],
    edges: [
      ...untouchedEdges.map((edge) => ({ ...edge, selected: false })),
      ...explodedInternalEdges,
      ...rewiredIncomingEdges,
      ...rewiredOutgoingEdges,
    ],
  }
}

export const collapseSelectionToSubnetwork = async (
  name: string,
  mode: 'create' | 'merge'
): Promise<{ newNodes: Node[]; newEdges: Edge[] }> => {
  const allNodes = getNodesSnapshot()
  const allEdges = getEdgesSnapshot()

  const selectedNodeIds = new Set(
    allNodes.filter((node) => node.selected).map((node) => node.id)
  )

  if (selectedNodeIds.size <= 1) {
    throw new Error('Select at least two nodes to create a subnetwork.')
  }

  const selectedCanvasNodes = allNodes.filter((node) =>
    selectedNodeIds.has(node.id)
  )
  const selectedInternalEdges = allEdges.filter(
    (edge) =>
      selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
  )

  const {
    nodes: selectedNodesForSubgraph,
    edges: internalEdgesForSubgraph,
    aliasedInputTargetByOriginal,
    aliasedOutputSourceByOriginal,
  } = mode === 'merge'
    ? flattenSelectedSubgraphs(
        selectedCanvasNodes,
        selectedInternalEdges,
        getNextNodeId
      )
    : {
        nodes: selectedCanvasNodes,
        edges: selectedInternalEdges,
        aliasedInputTargetByOriginal: {},
        aliasedOutputSourceByOriginal: {},
      }

  const networkNodeDefinition = createNetworkNodeDefinition(
    name,
    selectedNodesForSubgraph,
    internalEdgesForSubgraph
  )
  const { internalHandleToNetworkInput, internalHandleToNetworkOutput } =
    analyzeNetworkBoundary(selectedNodesForSubgraph, internalEdgesForSubgraph)

  await addNetworkNode(networkNodeDefinition.name, networkNodeDefinition)

  const newNodeId = String(getNextNodeId())
  const selectionCenter = selectedCanvasNodes.reduce(
    (acc, node) => ({ x: acc.x + node.position.x, y: acc.y + node.position.y }),
    { x: 0, y: 0 }
  )
  const centerPosition = {
    x: selectionCenter.x / selectedCanvasNodes.length,
    y: selectionCenter.y / selectedCanvasNodes.length,
  }

  const flowNetworkNode = {
    id: newNodeId,
    type: NodeType.NETWORK,
    position: centerPosition,
    selected: true,
    data: { ...networkNodeDefinition },
  }

  const unselectedNodes = allNodes
    .filter((node) => !selectedNodeIds.has(node.id))
    .map((node) => ({ ...node, selected: false }))

  const incomingEdges = allEdges.filter(
    (edge) =>
      !selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
  )
  const outgoingEdges = allEdges.filter(
    (edge) =>
      selectedNodeIds.has(edge.source) && !selectedNodeIds.has(edge.target)
  )
  const untouchedEdges = allEdges.filter(
    (edge) =>
      !selectedNodeIds.has(edge.source) && !selectedNodeIds.has(edge.target)
  )

  const rewiredIncomingEdges = incomingEdges
    .map((edge) => {
      const targetKey =
        aliasedInputTargetByOriginal[`${edge.target}::${edge.targetHandle}`] ??
        `${edge.target}::${edge.targetHandle}`
      const inputHandleIndex = internalHandleToNetworkInput[targetKey]
      if (inputHandleIndex === undefined) return null
      return {
        ...edge,
        id: `xy-edge__${edge.source}${edge.sourceHandle}-${newNodeId}input-${inputHandleIndex}`,
        target: newNodeId,
        targetHandle: `input-${inputHandleIndex}`,
        selected: false,
      }
    })
    .filter((edge) => edge !== null)

  const rewiredOutgoingEdges = outgoingEdges
    .map((edge) => {
      const sourceKey =
        aliasedOutputSourceByOriginal[`${edge.source}::${edge.sourceHandle}`] ??
        `${edge.source}::${edge.sourceHandle}`
      const outputHandleIndex = internalHandleToNetworkOutput[sourceKey]
      if (outputHandleIndex === undefined) return null
      return {
        ...edge,
        id: `xy-edge__${newNodeId}output-${outputHandleIndex}-${edge.target}${edge.targetHandle}`,
        source: newNodeId,
        sourceHandle: `output-${outputHandleIndex}`,
        selected: false,
      }
    })
    .filter((edge) => edge !== null)

  return {
    newNodes: [...unselectedNodes, flowNetworkNode],
    newEdges: [
      ...untouchedEdges.map((edge) => ({ ...edge, selected: false })),
      ...rewiredIncomingEdges,
      ...rewiredOutgoingEdges,
    ],
  }
}

/**
 * Type guard that checks whether a canvas node carries a `SubGraphNodeDefinition`
 * as its data — i.e. it is a network (subnetwork) node on the canvas.
 * @param node - The canvas node to test, or undefined.
 * @returns True if the node exists and its data is a `SubGraphNodeDefinition`.
 */
export const isNetworkCanvasNode = (
  node: Node | undefined
): node is Node<SubGraphNodeDefinition> => {
  if (!node) {
    return false
  }

  return isSubGraphNodeDefinition(node.data as SubGraphNodeDefinition)
}
