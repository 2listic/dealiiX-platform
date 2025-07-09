export const parseGraph = (nodes, edges) => {
  const nodesGraph = nodes.reduce((acc, obj) => {
    acc[obj.id] = {
      ...obj.data,
      xy_flow_obj: obj,
    }
    return acc
  }, {})
  const edgesGraph = edges.reduce((acc, obj, index) => {
    acc[index+1] = {
      source: obj.source,
      target: obj.target,
      source_output: obj.sourceHandle.split('-')[1],
      target_input: obj.targetHandle.split('-')[1],
      xy_flow_obj: obj
    }
    return acc
  }, {})
  return {
    workflow: {
      nodes: nodesGraph,
      edges: edgesGraph
    },
    version: 1,
    author: 'name',
    date_time_utc: new Date().toISOString(),
  }
}