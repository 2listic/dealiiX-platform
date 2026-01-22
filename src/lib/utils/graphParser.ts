import {
  addNetworkNode,
  getNetworkNodeData,
  getNodeData,
  setEdges,
  setNodes,
  updateLastNodeId,
} from '../stores/nodes.svelte'
import {
  hasNodeDataFields,
  Outputs,
  TypeField,
  type Network,
  type NetworkEdge,
  type NetworkEdges,
  type NetworkNodes,
} from '../types/nodeTypes'
import type { Node, Edge } from '@xyflow/svelte'

// ==================== From Coral protocol to Svelte xyflow =========================
/**
 * Load a graph into the flow editor. Converts protocol format to flow format
 * and updates both nodes and edges in the editor
 * @param {NetworkNodes} nodes - The nodes to load
 * @param {NetworkEdges} edges - The edges to load
 * @returns {string[]} Network node names that were registered or updated
 */
export const loadGraph = (
  nodes: NetworkNodes,
  edges: NetworkEdges
): string[] => {
  const networkNodes = addNetworkNodesFromGraph(nodes)

  // Reset then load (ensures UI updates correctly)
  setNodes([])
  setEdges([])

  const xyflowNodes = nodesFromProtocolToFlow(nodes)
  setNodes(xyflowNodes)
  const xyFlowEdges = edgesFromProtocolToFlow(edges)
  setEdges(xyFlowEdges)
  updateLastNodeId()

  return networkNodes
}

/**
 * Register or update network nodes from a graph in protocol format into the internal store.
 * Each network node is added or updated only if it has the required fields.
 * TODO: generate network node arguments, inputs and ouptuts if not already present
 * @param {NetworkNodes} nodes - The nodes to check and register
 * @returns {string[]} Network node names that were registered or updated
 */
const addNetworkNodesFromGraph = (nodes: NetworkNodes): string[] => {
  const networkNodes: string[] = []
  Object.values(nodes).forEach((node) => {
    if (node.type === TypeField.CORAL_NETWORK) {
      // Register only if not already done and use type narrowing to check for the required NodeData fields
      if (!networkNodes.includes(node.name) && hasNodeDataFields(node)) {
        addNetworkNode(node.name, node)
        networkNodes.push(node.name)
      }
      // TODO: generate arguments, inputs and outputs fields and only then add to networkNodes
    }
  })
  return networkNodes
}

/**
 * Takes nodes from the CORAL network JSON and transforms them into
 * xyflow-compatible node objects with positions and merged data
 * @param {NetworkNodes} nodes - Dictionary of nodes from network protocol
 * @returns {Node[]} Array of nodes formatted for the flow editor
 */
export const nodesFromProtocolToFlow = (nodes: NetworkNodes): Node[] => {
  console.log('nodesFromProtocolToFlow', nodes)
  const arrNodeIds = Object.keys(nodes)
  const xyFlowNodes = arrNodeIds.map((id, index) => {
    const node = nodes[id]
    const nodeData =
      node.type === TypeField.CORAL_NETWORK
        ? getNetworkNodeData(node.name)
        : getNodeData(node.type)
    const concatData = { ...nodeData, ...node } // concat data from registry and network
    return {
      id: id,
      type: nodeData.node_type,
      position: {
        x: node.position?.x ?? index * 100,
        y: node.position?.y ?? index * 100,
      },
      data: concatData,
    }
  })
  return xyFlowNodes
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
    const sourceNodeData =
      sourceNode.type === TypeField.CORAL_NETWORK
        ? getNetworkNodeData(sourceNode.name!)
        : getNodeData(sourceNode.type)
    const targetNodeData =
      targetNode.type === TypeField.CORAL_NETWORK
        ? getNetworkNodeData(targetNode.name!)
        : getNodeData(targetNode.type)

    // Determine source output type
    let sourceOutputType: string

    // Check if the output is SELF (e.g., constructor or method returning this)
    if (sourceNodeData.outputs?.[edge.source_output] === Outputs.SELF) {
      // For SELF outputs, use the base type if defined, otherwise use the node's type
      sourceOutputType = sourceNodeData.base ?? sourceNodeData.type
    } else {
      // Regular output - get from arguments array
      const sourceOutputArg = sourceNodeData.arguments?.[edge.source_output]
      if (!sourceOutputArg) {
        throw new Error(
          `Edge ${edgeId}: Source node ${edge.source} has no argument at index ${edge.source_output}`
        )
      }
      sourceOutputType = sourceOutputArg.type
    }

    // Determine target input type from arguments array
    const targetInputArg = targetNodeData.arguments?.[edge.target_input]
    if (!targetInputArg) {
      throw new Error(
        `Edge ${edgeId}: Target node ${edge.target} has no argument at index ${edge.target_input}`
      )
    }

    // Check if types match
    if (sourceOutputType !== targetInputArg.type) {
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

// =================== From Svelte xyflow to CORAL Protocol ======================
/**
 * Parse nodes and edges into the CORAL network JSON format
 * @param {Node[]} nodes - Array of node objects from the flow editor
 * @param {Edge[]} edges - Array of edge objects from the flow editor
 * @returns {Network} Complete network object in CORAL protocol format
 */
export const parseGraph = (nodes: Node[], edges: Edge[]): Network => {
  const nodesGraph = nodes.reduce((acc, obj) => {
    acc[obj.id] = {
      ...obj.data,
      position: obj.position,
    }
    return acc
  }, {})

  const edgesGraph = edges.reduce((acc, obj, index) => {
    acc[index] = {
      source: parseInt(obj.source),
      target: parseInt(obj.target),
      source_output: parseInt(obj.sourceHandle.split('-')[1]),
      target_input: parseInt(obj.targetHandle.split('-')[1]),
    }
    return acc
  }, {})

  return {
    workflow: {
      nodes: nodesGraph,
      edges: edgesGraph,
    },
    version: 1,
    author: 'dealiix-platform',
    date_time_utc: new Date().toISOString(),
  }
}
