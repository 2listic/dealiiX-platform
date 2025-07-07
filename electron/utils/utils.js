export const parseGraph = (nodes, edges) => {
  const nodesGraph = nodes.reduce((acc, obj) => {
    acc[obj.id] = {
      ...obj.data,
      xyFlowObj: obj,
    }
    return acc
  }, {})
  const edgesGraph = edges.reduce((acc, obj, index) => {
    acc[index+1] = {
      source: obj.source,
      target: obj.target,
      sourceOutput: obj.sourceHandle.split('-')[1],
      targetInput: obj.targetHandle.split('-')[1],
      xyFlowObj: obj
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