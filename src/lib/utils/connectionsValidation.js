import { getNodes, getEdges } from '../states/store.svelte'
import { Outputs } from '../types/nodeTypes'

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
  // console.log('nodes', nodes)
  // console.log('edges', edges)

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

  
  // Check if the source node value is valid
  const sourceNode = nodes.find(node => node.id === connection.source)
  if (!sourceNode.data.isValid) {
    console.error(`Source node ${connection.source} is not valid`)
    // connectionCache.set(cacheKey, false)   // Cache the result
    return false
  }
  
  // Check if the source type matches the target handle type 
  const targetNode = nodes.find(node => node.id === connection.target)
  const handleIndexOutput = parseInt(connection.sourceHandle.split('-')[1])
  const outputsSourceType = sourceNode.data.outputs[handleIndexOutput]
  const sourceType = outputsSourceType === Outputs.SELF ? sourceNode.data.type : outputsSourceType
  const handleIndexInput = parseInt(connection.targetHandle.split('-')[1])
  const expectedInputType = targetNode.data.arguments[handleIndexInput].type
  
  console.log(`Handle ${connection.targetHandle} expects ${expectedInputType.toString()}, source provides ${sourceType.toString()}`)
  const isValid = expectedInputType === sourceType
  console.log('connection is valid?', isValid)
  connectionCache.set(cacheKey, isValid)   // Cache the result
  return isValid
  // return true
}

export { isValidConnection }