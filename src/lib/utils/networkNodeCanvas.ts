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

/**
 * Expands every network (subgraph) node in a selection in-place, replacing each one
 * with its constituent nodes and rewiring all selection edges through the exploded
 * internals. Non-subgraph nodes in the selection pass through unchanged.
 *
 * Also returns alias maps (`aliasedInputTargetByOriginal` /
 * `aliasedOutputSourceByOriginal`) that let callers translate any handle reference
 * that pointed at a now-removed network node into the equivalent internal handle.
 * These maps are used by {@link collapseSelectionToSubnetwork} when the flatten is
 * a preprocessing step before collapsing a mixed selection into a new subnetwork.
 *
 * @param selectedNodes - Canvas nodes in the current selection (snapshots, not reactive).
 * @param selectedEdges - Canvas edges whose both endpoints are within the selection.
 * @param getNextId - Monotonic ID generator; called once per internal node to assign fresh canvas IDs.
 * @returns The expanded node/edge lists plus the two alias maps.
 */
export const flattenSelectedSubgraphs = (
  selectedNodes: Node[],
  selectedEdges: Edge[],
  getNextId: () => number
): FlattenedSelectedSubgraphs => {
  // Initialise working copies: nodes stay selected, edges deselected.
  let workingNodes: Node[] = selectedNodes.map((node) => ({
    ...node,
    selected: true,
  }))
  let workingEdges: Edge[] = selectedEdges.map((edge) => ({
    ...edge,
    selected: false,
  }))

  // Alias maps: network-node handle → internal handle, built up across all explosions.
  const aliasedInputTargetByOriginal: Record<string, string> = {}
  const aliasedOutputSourceByOriginal: Record<string, string> = {}

  // Collect IDs of subgraph nodes up-front; the working list mutates each iteration.
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

    // Expand the subgraph into its constituent canvas nodes and internal edges.
    const explosion = explodeSubgraphNodeSelection(subgraphNode, getNextId)

    // Record input alias: "networkNodeId::input-N" → "internalNodeId::input-M"
    Object.entries(explosion.networkInputToInternalHandle).forEach(
      ([handleIndex, binding]) => {
        aliasedInputTargetByOriginal[
          `${subgraphNodeId}::input-${handleIndex}`
        ] = `${binding.nodeId}::${binding.handleId}`
      }
    )

    // Record output alias: "networkNodeId::output-N" → "internalNodeId::output-M"
    Object.entries(explosion.networkOutputToInternalHandle).forEach(
      ([handleIndex, binding]) => {
        aliasedOutputSourceByOriginal[
          `${subgraphNodeId}::output-${handleIndex}`
        ] = `${binding.nodeId}::${binding.handleId}`
      }
    )

    // Rewire any selection edge that touches the now-exploded network node.
    // Edges whose handle maps to nothing (dangling) are dropped.
    const rewiredSelectionEdges = workingEdges
      .map((edge) => {
        let source = edge.source
        let sourceHandle = edge.sourceHandle
        let target = edge.target
        let targetHandle = edge.targetHandle

        if (edge.source === subgraphNodeId) {
          const binding =
            explosion.networkOutputToInternalHandle[
              handleIdToIndex(edge.sourceHandle as string)
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
              handleIdToIndex(edge.targetHandle as string)
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

    // Replace the network node with its exploded internals for the next iteration.
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

/**
 * Removes a network node from the full canvas graph and replaces it with its
 * constituent internal nodes and edges, rewiring all outer edges that connected
 * to the network node's boundary handles to their corresponding internal handles.
 *
 * Outer edges whose handle index has no matching boundary binding (e.g. the
 * subgraph definition is inconsistent) are silently dropped.
 *
 * @param nodeId - Canvas ID of the network node to explode.
 * @param allNodes - All nodes currently on the canvas (snapshots, not reactive).
 * @param allEdges - All edges currently on the canvas (snapshots, not reactive).
 * @param getNextId - Monotonic ID generator; called once per internal node to assign fresh canvas IDs.
 * @returns A new `{ nodes, edges }` pair with the network node replaced by its internals.
 * @throws {Error} If `nodeId` is not found in `allNodes`.
 */
export const explodeNetworkNodeInGraph = (
  nodeId: string,
  allNodes: Node[],
  allEdges: Edge[],
  getNextId: () => number
): { nodes: Node[]; edges: Edge[] } => {
  // Locate the network node and expand it into its internal canvas nodes and edges.
  const networkCanvasNode = allNodes.find((node) => node.id === nodeId)
  if (!networkCanvasNode) {
    throw new Error(`Node '${nodeId}' was not found.`)
  }

  const { explodedNodes, explodedInternalEdges } = explodeSubgraphNodeSelection(
    networkCanvasNode,
    getNextId
  )

  // Re-analyse the boundary on the freshly expanded nodes to get handle maps.
  const boundary = analyzeNetworkBoundary(explodedNodes, explodedInternalEdges)

  // Partition outer edges: those touching the network node vs those that do not.
  const incomingEdges = allEdges.filter((edge) => edge.target === nodeId)
  const outgoingEdges = allEdges.filter((edge) => edge.source === nodeId)
  const untouchedEdges = allEdges.filter(
    (edge) => edge.source !== nodeId && edge.target !== nodeId
  )

  // Redirect each incoming edge from the network input handle to the internal target handle.
  const rewiredIncomingEdges = incomingEdges
    .map((edge) => {
      const handleIndex = Number.parseInt(
        (edge.targetHandle as string).split('-')[1],
        10
      )
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

  // Redirect each outgoing edge from the network output handle to the internal source handle.
  const rewiredOutgoingEdges = outgoingEdges
    .map((edge) => {
      const handleIndex = Number.parseInt(
        (edge.sourceHandle as string).split('-')[1],
        10
      )
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

  // Deselect all surviving outer nodes and splice in the exploded internals.
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

/**
 * Collapses the currently selected canvas nodes into a single network node,
 * persisting the new definition to the registry store and returning the
 * updated node/edge lists to apply to the canvas.
 *
 * Two modes are supported:
 * - `'create'`: wraps the selected nodes as-is; any nested subgraphs in the
 *   selection remain as network nodes inside the new subnetwork.
 * - `'merge'`: first flattens all subgraph nodes in the selection via
 *   {@link flattenSelectedSubgraphs}, so the resulting subnetwork contains
 *   only primitive nodes. Outer edges that previously pointed at an inner
 *   subgraph's handles are translated through the alias maps produced by
 *   the flatten step before being rewired to the new network node's boundary.
 *
 * @param name - Name for the new network node (used as registry key and display label).
 * @param mode - `'create'` to wrap the selection as-is; `'merge'` to flatten nested subgraphs first.
 * @returns `{ newNodes, newEdges }` — the full canvas node/edge lists after collapsing.
 * @throws {Error} If fewer than two nodes are selected.
 */
export const collapseSelectionToSubnetwork = async (
  name: string,
  mode: 'create' | 'merge'
): Promise<{ newNodes: Node[]; newEdges: Edge[] }> => {
  // Snapshot the live canvas so the rest of this function works on plain objects.
  const allNodes = getNodesSnapshot()
  const allEdges = getEdgesSnapshot()

  // Identify the selected node IDs and guard against trivially small selections.
  const selectedNodeIds = new Set(
    allNodes.filter((node) => node.selected).map((node) => node.id)
  )

  if (selectedNodeIds.size <= 1) {
    throw new Error('Select at least two nodes to create a subnetwork.')
  }

  // Separate selected nodes and their purely internal edges from the rest of the graph.
  const selectedCanvasNodes = allNodes.filter((node) =>
    selectedNodeIds.has(node.id)
  )
  const selectedInternalEdges = allEdges.filter(
    (edge) =>
      selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
  )

  // In 'merge' mode, flatten any nested subgraphs inside the selection so the
  // resulting subnetwork contains only primitive nodes. The alias maps produced
  // here are needed later to translate outer edge endpoints that used to point
  // at a now-exploded inner network node.
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

  // Build the SubGraphNodeDefinition and its handle maps, then register it.
  const networkNodeDefinition = createNetworkNodeDefinition(
    name,
    selectedNodesForSubgraph,
    internalEdgesForSubgraph
  )
  const { internalHandleToNetworkInput, internalHandleToNetworkOutput } =
    analyzeNetworkBoundary(selectedNodesForSubgraph, internalEdgesForSubgraph)

  await addNetworkNode(networkNodeDefinition.name, networkNodeDefinition)

  // Place the new network node at the centroid of the original selection.
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

  // Deselect all nodes that are not part of the collapsed selection.
  const unselectedNodes = allNodes
    .filter((node) => !selectedNodeIds.has(node.id))
    .map((node) => ({ ...node, selected: false }))

  // Partition outer edges by direction relative to the selection boundary.
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

  // Redirect incoming edges to the new network node's input handles.
  // If the original target was an inner subgraph handle, resolve it through
  // the alias map first before looking up the network boundary index.
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

  // Redirect outgoing edges from the new network node's output handles.
  // Same alias-map resolution applies for sources that were inner subgraph handles.
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
