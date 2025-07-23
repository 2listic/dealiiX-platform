export const parseGraph = (nodes, edges) => {
  const nodesGraph = nodes.reduce((acc, obj) => {
    acc[obj.id] = {
      ...obj.data,
      // xy_flow_obj: obj,
    }
    return acc
  }, {})
  const edgesGraph = edges.reduce((acc, obj, index) => {
    acc[index] = {
      source: parseInt(obj.source),
      target: parseInt(obj.target),
      source_output: parseInt(obj.sourceHandle.split('-')[1]),
      target_input: parseInt(obj.targetHandle.split('-')[1]),
      // xy_flow_obj: obj
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
