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