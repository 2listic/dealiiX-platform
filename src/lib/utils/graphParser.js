/**
 * Convert nodes from protocol format to flow editor format
 */
export const nodesFromProtocolToFlow = (nodes) => {
  const arrNodeIds = Object.keys(nodes)
  return arrNodeIds.map((id, index) => {
    const node = nodes[id]
    return {
      id: id,
      type: node.node_type,
      position: {
        x: node.position?.x ?? index * 100,
        y: node.position?.y ?? index * 100,
      },
      data: { ...node },
    }
  })
}

/**
 * Convert edges from protocol format to flow editor format
 */
export const edgesFromProtocolToFlow = (edges) => {
  return Object.values(edges).map((edge) => ({
    id: `xy-edge__${edge.source}output-${edge.source_output}-${edge.target}input-${edge.target_input}`,
    source: edge.source.toString(),
    target: edge.target.toString(),
    sourceHandle: `output-${edge.source_output}`,
    targetHandle: `input-${edge.target_input}`,
  }))
}

/**
 * Parse nodes and edges into the graph protocol format
 * @param {Array} nodes - Array of node objects from the flow editor
 * @param {Array} edges - Array of edge objects from the flow editor
 * @returns {Object} Parsed graph in protocol format
 */
export const parseGraph = (nodes, edges) => {
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

/**
 * Validate and extract workflow data from a graph object
 * @param {Object} graphData - The graph data object
 * @returns {{ nodes: Object, edges: Object } | { error: string }}
 */
export const validateGraphData = (graphData) => {
  if (!graphData) {
    return { error: 'No graph data provided' }
  }

  const nodes = graphData?.workflow?.nodes
  if (nodes == null) {
    return { error: 'No nodes found in graph' }
  }

  const edges = graphData?.workflow?.edges
  if (edges == null) {
    return { error: 'No edges found in graph' }
  }

  return { nodes, edges }
}
