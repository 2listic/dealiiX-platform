import { getNodes, getEdges } from '../stores/nodes.svelte'
import { SELF, Type } from '../types/nodeTypes'

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
  const isHandleAlreadyConnected = edges.some(
    (edge) =>
      edge?.target === connection.target &&
      edge?.targetHandle === connection.targetHandle
  )
  if (isHandleAlreadyConnected) {
    console.error(
      `Handle ${connection.targetHandle} on node ${connection.target} already connected`
    )
    connectionCache.set(cacheKey, false) // Cache the result
    return false
  }

  // Check if the source node value is valid
  const sourceNode = nodes.find((node) => node.id === connection.source)
  if (!sourceNode.data.is_valid) {
    console.error(`Source node ${connection.source} is not valid`)
    connectionCache.set(cacheKey, false)
    return false
  }

  // If the expected input type is 'any', allow any connection
  const targetNode = nodes.find((node) => node.id === connection.target)
  const handleIndexInput = parseInt(connection.targetHandle.split('-')[1])
  const expectedInputType = targetNode.data.arguments[handleIndexInput].type
  if (expectedInputType === Type.ANY) {
    console.log(`Handle ${connection.targetHandle} accepts any type`)
    connectionCache.set(cacheKey, true)
    return true
  }

  // Check if the source type matches the target handle type
  const handleIndexOutput = parseInt(connection.sourceHandle.split('-')[1])
  const sourceIndexOutput = sourceNode.data.outputs[handleIndexOutput]
  let sourceType
  if (sourceIndexOutput === SELF) {
    // Check if node is derived by an abstract class to pick the right output type
    const baseClassType = sourceNode.data?.base ?? false
    sourceType = baseClassType ? baseClassType : sourceNode.data.type
  } else {
    sourceType = sourceNode.data.arguments[sourceIndexOutput].type
  }

  console.log(
    `Handle ${
      connection.targetHandle
    } expects ${expectedInputType.toString()}, source provides ${sourceType.toString()}`
  )
  const isValid = expectedInputType === sourceType
  console.log('connection is valid?', isValid)
  connectionCache.set(cacheKey, isValid) // Cache the result
  return isValid
}

const clearConnectionCache = () => connectionCache.clear()

export { isValidConnection, clearConnectionCache }
