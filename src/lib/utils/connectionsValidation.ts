/**
 * Connection validation for the flow canvas.
 * Enforces that edges only form when source output type matches target input type.
 * Results are cached per connection key to avoid redundant type lookups during
 * rapid drag events.
 */

import type { Connection, Edge, Node } from '@xyflow/svelte'
import { getNodesSnapshot, getEdgesSnapshot } from '../stores/nodes.svelte'
import {
  handleIdToIndex,
  resolveInputArgument,
  resolveOutputType,
} from './canvasNodeUtils'
import { Type } from '../types/nodeTypes'
import type { NodeDefinitions } from '../types/nodeTypes'

let connectionCache = new Map<string, boolean>()

const isValidConnection = (connection: Connection | Edge): boolean => {
  // Create a cache key from the connection
  const cacheKey = `${connection.source}-${connection.sourceHandle}-${connection.target}-${connection.targetHandle}`
  // Return cached result if available
  if (connectionCache.has(cacheKey)) {
    console.log('cache hit')
    return connectionCache.get(cacheKey) as boolean
  }
  console.log('connection', connection)

  // Get the current nodes and edges
  const nodes = getNodesSnapshot() as Node<NodeDefinitions>[]
  const edges = getEdgesSnapshot() as Edge[]
  console.log('nodes', nodes)
  console.log('edges', edges)

  // Check if the target handle is already connected
  if (
    isTargetHandleConnected(
      edges,
      connection.target,
      connection.targetHandle as string
    )
  ) {
    console.warn(
      `Handle ${connection.targetHandle} on node ${connection.target} already connected`
    )
    connectionCache.set(cacheKey, false) // Cache the result
    return false
  }

  // Check if the source node value is valid
  const sourceNode = nodes.find((node) => node.id === connection.source)
  if (!sourceNode?.data.is_valid) {
    console.warn(`Source node ${connection.source} is not valid`)
    connectionCache.set(cacheKey, false)
    return false
  }

  // If the expected input type is 'any', allow any connection
  const targetNode = nodes.find((node) => node.id === connection.target)
  const handleIndexInput = handleIdToIndex(connection.targetHandle as string)
  const expectedInputType = resolveInputArgument(
    targetNode!.data,
    handleIndexInput
  )?.type
  if (expectedInputType === Type.ANY) {
    console.log(`Handle ${connection.targetHandle} accepts any type`)
    connectionCache.set(cacheKey, true)
    return true
  }

  // Check if the source type matches the target handle type
  const handleIndexOutput = handleIdToIndex(connection.sourceHandle as string)
  const sourceType = resolveOutputType(sourceNode.data, handleIndexOutput)

  console.log(
    `Handle ${
      connection.targetHandle
    } expects ${expectedInputType?.toString()}, source provides ${sourceType?.toString()}`
  )
  const isValid = expectedInputType === sourceType
  console.log('connection is valid?', isValid)
  connectionCache.set(cacheKey, isValid) // Cache the result
  return isValid
}

const clearConnectionCache = () => connectionCache.clear()

const isTargetHandleConnected = (
  edges: Edge[],
  nodeId: string,
  handleId: string
): boolean =>
  edges.some((e) => e.target === nodeId && e.targetHandle === handleId)

export { isValidConnection, clearConnectionCache, isTargetHandleConnected }
