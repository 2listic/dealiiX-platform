/**
 * Conversion layer between the CORAL network protocol and the @xyflow canvas format.
 * All graph loading, saving, export, and validation passes through here.
 *
 * Key functions:
 *   Protocol → Flow:  nodesFromProtocolToFlow(), edgesFromProtocolToFlow(), loadGraphFromProtocol()
 *   Import pipeline:  importGraphFromProtocol() — validate + strip qualified IDs + load in one call
 *   Flow → Protocol:  parseGraphToProtocol(), parseGraphWithQualifiedIds()
 *   Qualified IDs:    addQualifiedIds(), removeQualifiedIds()
 *   Validation:       validateGraphData()
 */

import { setEdges, setNodes, updateLastNodeId } from '../stores/nodes.svelte'
import { graphStackState } from '../stores/graphStack.svelte'
import {
  addNetworkNode,
  getNetworkNodeDefinition,
  getNodeData,
} from '../stores/registryStore.svelte'
import {
  handleIdToIndex,
  resolveInputArgument,
  resolveOutputType,
} from './canvasNodeUtils'
import {
  isSubGraphNodeDefinition,
  Type,
  TypeField,
  type Network,
  type NetworkEdge,
  type NetworkEdges,
  type LeanStandardNode,
  type SubGraphNodeDefinition,
  type LeanNodes,
  type QualifiedLeanNodes,
  type QualifiedNetwork,
} from '../types/nodeTypes'
import { type Node, type Edge, Position } from '@xyflow/svelte'
import { buildExportMeta } from './exportMeta'

// ==================== From Coral protocol to Svelte xyflow =========================
/**
 * Load a graph into the flow editor. Converts protocol format to flow format
 * and updates both nodes and edges in the editor
 * @param {LeanNodes} nodes - The nodes to load
 * @param {NetworkEdges} edges - The edges to load
 * @returns {Promise<string[]>} Network node names that were registered or updated
 */
export const loadGraphFromProtocol = async (
  nodes: LeanNodes,
  edges: NetworkEdges
): Promise<string[]> => {
  const networkNodes = await addNetworkNodesFromGraph(nodes)

  // Reset then load (ensures UI updates correctly)
  setNodes([])
  setEdges([])

  const xyflowNodes = nodesFromProtocolToFlow(nodes)
  setNodes(xyflowNodes)
  const xyFlowEdges = edgesFromProtocolToFlow(edges)
  setEdges(xyFlowEdges)
  updateLastNodeId()

  // Discard any subnetwork navigation state and undo history from a prior session.
  graphStackState.reset()
  graphStackState.syncCurrent()

  return networkNodes
}

/**
 * Validates, cleans, and loads a network into the flow editor in one step.
 * Combines validateGraphData, removeQualifiedIds, and loadGraphFromProtocol so callers
 * only need to handle toasting and project-state updates.
 * @param graph - The network to import (may include qualified_id fields from a saved file)
 * @returns invalidEdges found during type-compatibility validation, and registeredNetworkNodes
 * @throws {Error} If graph data is missing required fields or contains structural errors
 */
export const importGraphFromProtocol = async (
  graph: Network | QualifiedNetwork
): Promise<{
  invalidEdges: Array<{ edgeId: string; edge: NetworkEdge; error: string }>
  registeredNetworkNodes: string[]
}> => {
  const [validEdges, invalidEdges] = validateGraphData(graph as Network)
  const cleanedGraph = removeQualifiedIds(graph)
  const registeredNetworkNodes = await loadGraphFromProtocol(
    cleanedGraph.workflow.nodes,
    validEdges
  )
  return { invalidEdges, registeredNetworkNodes }
}

/**
 * Register or update network nodes from a graph in protocol format into the internal store.
 * Each network node is added or updated only if it has the required fields.
 * TODO: generate network node arguments, inputs and ouptuts if not already present
 * @param {LeanNodes} nodes - The nodes to check and register
 * @returns {Promise<string[]>} Network node names that were registered or updated
 */
const addNetworkNodesFromGraph = async (
  nodes: LeanNodes
): Promise<string[]> => {
  const networkNodes: string[] = []
  for (const node of Object.values(nodes)) {
    if (isSubGraphNodeDefinition(node)) {
      await addNetworkNode(node.name, node)
      networkNodes.push(node.name)
    }
    // TODO: add support for network nodes of type "network" with no arguments.
    // In that case, we need to generate arguments, inputs and outputs and then add to networkNodes
  }
  return networkNodes
}

/**
 * Takes nodes from the CORAL network JSON and transforms them into
 * xyflow-compatible node objects with positions and merged data.
 * @param {LeanNodes} nodes - Dictionary of nodes from network protocol
 * @returns {Node[]} Array of nodes formatted for the flow editor
 */
export const nodesFromProtocolToFlow = (nodes: LeanNodes): Node[] => {
  console.log('nodesFromProtocolToFlow', nodes)
  const arrNodeIds = Object.keys(nodes)
  const xyFlowNodes = arrNodeIds.map((id, index) => {
    const node = nodes[id]

    // Get snapshot from store and merge with instance-specific data
    const nodeData = mergeNodeData(node)

    return {
      id: id,
      type: nodeData.node_type,
      position: {
        x: node.position?.x ?? index * 100,
        y: node.position?.y ?? index * 100,
      },
      data: nodeData,
    }
  })
  return xyFlowNodes
}

/**
 * Gets snapshot from store and merges it with instance-specific data.
 * @param {LeanNodes[string]} protocolNode - Node data from network protocol
 * @returns Merged node data for xyflow
 */
const mergeNodeData = (protocolNode: LeanNodes[string]) => {
  if (protocolNode.type === TypeField.CORAL_NETWORK) {
    // Network nodes: fetch by name, remove value, copy position
    const storeNodeData = getNetworkNodeDefinition(
      (protocolNode as SubGraphNodeDefinition).name
    )
    const { value, ...storeNodeDataWithoutValue } = storeNodeData
    return {
      ...storeNodeDataWithoutValue,
      position: protocolNode.position,
    }
  } else {
    // Regular nodes: fetch by type, copy position/name/value (instance-specific)
    const storeNodeData = getNodeData(protocolNode.type)
    return {
      ...storeNodeData,
      position: protocolNode.position,
      ...(protocolNode.name && { name: protocolNode.name }),
      ...(protocolNode.value !== undefined && { value: protocolNode.value }),
    }
  }
}

/**
 * Transforms CORAL network edges into xyflow-compatible edge objects
 * with proper source/target handles for node connection points
 * @param {Object.<string, NetworkEdge>} edges - Dictionary of edges keyed by edge ID
 * @returns {Edge[]} Array of edges formatted for the flow editor
 */
export const edgesFromProtocolToFlow = (edges: {
  [id: string]: NetworkEdge
}): Edge[] => {
  return Object.values(edges).map((edge) => ({
    id: `xy-edge__${edge.source}output-${edge.source_output}-${edge.target}input-${edge.target_input}`,
    source: edge.source.toString(),
    target: edge.target.toString(),
    sourceHandle: `output-${edge.source_output}`,
    targetHandle: `input-${edge.target_input}`,
  }))
}

/**
 * Validates workflow data from a graph object and returns valid and invalid edges,
 * where invalid edges are those that connect incompatible output to input types
 * @param {Network} graphData - The graph data object to validate
 * @throws {Error} If graph data is invalid or missing required fields
 * @returns {Array} Tuple containing [validEdges, invalidEdges]
 */
export const validateGraphData = (
  graphData: Network
): [
  { [id: string]: NetworkEdge },
  Array<{ edgeId: string; edge: NetworkEdge; error: string }>,
] => {
  // Validate not defined mandatory graph data
  if (!graphData) {
    throw new Error('No graph data provided')
  }

  const nodes = graphData?.workflow?.nodes
  if (nodes == null) {
    throw new Error('No nodes found in graph')
  }

  const edges = graphData?.workflow?.edges
  if (edges == null) {
    throw new Error('No edges found in graph')
  }

  // Validate edge type compatibility
  const validEdges: { [id: string]: NetworkEdge } = {}
  const invalidEdges: Array<{
    edgeId: string
    edge: NetworkEdge
    error: string
  }> = []

  Object.entries(edges).forEach(([edgeId, edge]) => {
    // Get source and target node from workflow
    const sourceNode = nodes[edge.source]
    if (!sourceNode) {
      throw new Error(`Edge ${edgeId}: Source node ${edge.source} not found`)
    }
    const targetNode = nodes[edge.target]
    if (!targetNode) {
      throw new Error(`Edge ${edgeId}: Target node ${edge.target} not found`)
    }

    // Get source and target node definition (from registry or networkNodes)
    const sourceNodeData = isSubGraphNodeDefinition(sourceNode)
      ? sourceNode
      : getNodeData(sourceNode.type)
    const targetNodeData = isSubGraphNodeDefinition(targetNode)
      ? targetNode
      : getNodeData(targetNode.type)

    // Determine source output type via outputs[] → arguments[] indirection
    const sourceOutputType = resolveOutputType(
      sourceNodeData,
      edge.source_output
    )
    if (sourceOutputType == null) {
      throw new Error(
        `Edge ${edgeId}: Source node ${edge.source} has no output at index ${edge.source_output}`
      )
    }

    // Determine target input type via inputs[] → arguments[] indirection
    const targetInputArg = resolveInputArgument(
      targetNodeData,
      edge.target_input
    )
    if (!targetInputArg) {
      throw new Error(
        `Edge ${edgeId}: Target node ${edge.target} has no argument at index ${edge.target_input}`
      )
    }

    // Check if types match. A target input typed 'any' accepts any source.
    if (
      targetInputArg.type !== Type.ANY &&
      sourceOutputType !== targetInputArg.type
    ) {
      const errorMessage = `Edge id: ${edgeId} - Type mismatch - source output type '${sourceOutputType}' does not match target input '${targetInputArg.type}'`
      console.warn(errorMessage)
      invalidEdges.push({
        edgeId,
        edge,
        error: errorMessage,
      })
    } else {
      validEdges[edgeId] = edge
    }
  })

  return [validEdges, invalidEdges]
}

/**
 * Removes the `qualified_id` field from every node in a Network, including
 * recursively in nested network nodes' `value` fields. Inverse of `addQualifiedIds`.
 * @param network - The network to process (may or may not have qualified_id fields)
 * @returns A new Network with qualified_id removed from all nodes
 */
export const removeQualifiedIds = (
  network: Network | QualifiedNetwork
): Network => {
  const cleanedNodes: LeanNodes = {}

  for (const [nodeId, node] of Object.entries(network.workflow.nodes)) {
    const { qualified_id, ...rest } = node as typeof node & {
      qualified_id?: string
    }

    if (isSubGraphNodeDefinition(rest)) {
      const cleanedValue = removeQualifiedIds(rest.value)
      cleanedNodes[nodeId] = { ...rest, value: cleanedValue }
    } else {
      cleanedNodes[nodeId] = rest
    }
  }

  return {
    ...network,
    workflow: { ...network.workflow, nodes: cleanedNodes },
  }
}

// =================== From Svelte xyflow to CORAL Protocol ======================
/**
 * Parse nodes and edges into the CORAL network JSON format.
 * @param {Node[]} nodes - Array of node objects (must be plain objects/snapshots, not reactive)
 * @param {Edge[]} edges - Array of edge objects (must be plain objects/snapshots, not reactive)
 * @returns {Network} Complete network object in CORAL protocol format
 * @remarks Callers should pass snapshots of reactive data using $state.snapshot() or snapshot()
 */
export const parseGraphToProtocol = (nodes: Node[], edges: Edge[]): Network => {
  const nodesGraph = nodes.reduce<LeanNodes>((acc, obj) => {
    const data = obj.data as LeanStandardNode | SubGraphNodeDefinition

    if (isSubGraphNodeDefinition(data)) {
      // Network nodes: get position, data fields + 'value' from registred node
      const networkNodeData = getNetworkNodeDefinition(data.name)
      acc[obj.id] = {
        type: data.type,
        node_type: data.node_type,
        name: data.name,
        arguments: data.arguments,
        inputs: data.inputs,
        outputs: data.outputs,
        value: networkNodeData.value,
        position: obj.position,
      }
    } else {
      // Regular nodes: only keep relevant fields not already present in the registry
      const node: LeanStandardNode = {
        type: data.type,
        position: obj.position,
      }
      if (data.base) node.base = data.base
      if (data.name) node.name = data.name
      if (data.value !== undefined) node.value = data.value
      acc[obj.id] = node
    }

    return acc
  }, {})

  const edgesGraph = edges.reduce<NetworkEdges>((acc, obj, index) => {
    acc[index] = {
      source: parseInt(obj.source),
      target: parseInt(obj.target),
      source_output: handleIdToIndex(obj.sourceHandle as string),
      target_input: handleIdToIndex(obj.targetHandle as string),
    }
    return acc
  }, {})

  return {
    workflow: {
      nodes: nodesGraph,
      edges: edgesGraph,
    },
    ...buildExportMeta(),
  }
}

/**
 * Adds a `qualified_id` field to every node in a Network. The qualified_id
 * encodes the node's position in the nesting hierarchy by concatenating
 * parent ids with underscores (e.g., "12_3" for node "3" inside node "12").
 * @param network - The network to process
 * @param parentQualifiedId - Prefix from parent nodes (used in recursion)
 * @returns A new Network with qualified_id added to all nodes
 */
export const addQualifiedIds = (
  network: Network,
  parentQualifiedId: string = ''
): QualifiedNetwork => {
  const transformedNodes: QualifiedLeanNodes = {}

  for (const [nodeId, node] of Object.entries(network.workflow.nodes)) {
    const qualifiedId = parentQualifiedId
      ? `${parentQualifiedId}_${nodeId}`
      : nodeId

    if (isSubGraphNodeDefinition(node)) {
      const transformedValue = addQualifiedIds(node.value, qualifiedId)
      transformedNodes[nodeId] = {
        ...node,
        qualified_id: qualifiedId,
        value: transformedValue,
      }
    } else {
      transformedNodes[nodeId] = { ...node, qualified_id: qualifiedId }
    }
  }

  return {
    ...network,
    workflow: { ...network.workflow, nodes: transformedNodes },
  }
}

/**
 * Parse nodes and edges into the CORAL network JSON format with qualified IDs.
 * Use this for all export paths (save, download, execute) where qualified IDs are needed.
 * @param {Node[]} nodes - Array of node objects (must be plain objects/snapshots, not reactive)
 * @param {Edge[]} edges - Array of edge objects (must be plain objects/snapshots, not reactive)
 * @returns {QualifiedNetwork} Complete network object with qualified_id on all nodes
 */
export const parseGraphWithQualifiedIds = (
  nodes: Node[],
  edges: Edge[]
): QualifiedNetwork => {
  return addQualifiedIds(parseGraphToProtocol(nodes, edges))
}
