import { getNodes, getEdges } from '../states/store.svelte'

let connectionCache = new Map()

const isValidConnection = (connection) => {
  
  // Create a cache key from the connection
  const cacheKey = `${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`
  // Return cached result if available
  if (connectionCache.has(cacheKey)) {
    console.log('cache hit')
    return connectionCache.get(cacheKey)
  }
  console.log('connection', connection)
  
  // Get the current nodes and edges
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
    connectionCache.set(cacheKey, false)   // Cache the result
    return false
  }

  // Check if the source type matches the target handle type
  const targetNode = nodes.find(node => node.id === connection.target)
  const sourceNode = nodes.find(node => node.id === connection.source)

  const handleIndexOutput = parseInt(connection.sourceHandle.split('-')[1])
  const sourceType = sourceNode.data.outputs[handleIndexOutput]
  const handleIndexInput = parseInt(connection.targetHandle.split('-')[1])
  const expectedInputType = targetNode.data.inputs[handleIndexInput]
  
  console.log(`Handle ${connection.targetHandle} expects ${expectedInputType}, source provides ${sourceType}`)
  const isValid = expectedInputType === sourceType
  console.log('connection is valid?', isValid)
  connectionCache.set(cacheKey, isValid)   // Cache the result
  return isValid
}

export { isValidConnection }