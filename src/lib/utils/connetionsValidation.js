import { getNodes, getEdges } from '../states/store.svelte'

const isValidConnection = (connection) => {
  console.log('connection', connection)
  console.log(connection.source, connection.target, connection.targetHandle)
  const nodes = getNodes()
  const edges = getEdges()
  console.log('nodes', nodes)
  console.log('edges', edges)

  // Check if the target handle is already connected
  const isHandleAlreadyConnected = edges.some(edge => 
    edge?.target === connection.target && 
    edge?.targetHandle === connection.targetHandle
  )
  if (isHandleAlreadyConnected) {
    console.error(`Handle ${connection.targetHandle} on node ${connection.target} is already connected`)
    return false
  }

  // Check if the source type matches the target handle type
  const targetNode = nodes.find(node => node.id === connection.target)
  const sourceNode = nodes.find(node => node.id === connection.source)
  console.log('targetNode', targetNode)
  console.log('sourceNode', sourceNode)

  const handleIndex = parseInt(connection.targetHandle.split('-')[1])
  console.log('handleIndex', handleIndex)
  const expectedInputType = targetNode.data.inputs[handleIndex]
  const sourceType = sourceNode.data.type
  
  if (expectedInputType != sourceType) {
    console.error(`Handle ${connection.targetHandle} expects ${expectedInputType}, source provides ${sourceType}`)
  } else {
    console.log(`Handle ${connection.targetHandle} expects ${expectedInputType}, source provides ${sourceType}`)
  }

  return expectedInputType === sourceType
}

export { isValidConnection }