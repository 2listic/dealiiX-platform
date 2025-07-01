export const parseGraph = (nodes, edges) => {
  const nodesGraph = nodes.reduce((acc, obj) => {
    acc[obj.id] = {
      id: obj.id,
      type: obj.type,
      data: obj.data,
    }
    return acc
  }, {})
  const edgesGraph = edges.reduce((acc, obj) => {
    acc[obj.id] = {
      id: obj.id,
      source: obj.source,
      target: obj.target,
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
    dateTimeUtc: new Date().toISOString(),
  }
}