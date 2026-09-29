/**
 * Connection validation for the flow canvas.
 * Enforces that edges only form when source output type matches target input type.
 * Results are cached per connection key to avoid redundant type lookups during
 * rapid drag events.
 */

import type { Connection, Edge, Node } from '@xyflow/svelte'
import { getNodesSnapshot, getEdgesSnapshot } from '../stores/nodes.svelte'
import {
  getInputTypeAndName,
  getOutputTypeAndName,
  handleIdToIndex,
  resolveOutputTypeCandidates,
} from './canvasNodeUtils'
import { ConnectionType, isTypeCompatible, NodeType } from '../types/nodeTypes'
import type { NodeDefinitions } from '../types/nodeTypes'
import { parameterHandlePath } from './parameterPorts'

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

  // Resolve the expected input type and the source's output type
  const targetNode = nodes.find((node) => node.id === connection.target)
  if (!targetNode) {
    connectionCache.set(cacheKey, false)
    return false
  }

  const targetHandle = connection.targetHandle as string
  const sourceHandle = connection.sourceHandle as string
  const targetParameter = parameterHandlePath(targetHandle)
  const sourceParameter = parameterHandlePath(sourceHandle)

  // Exposed parameter inputs are evaluated before execution. A computed
  // backend/subnetwork output cannot provide their value at that point; only
  // a scalar literal or another parameter-file output is frontend-resolvable.
  if (
    targetParameter?.direction === 'input' &&
    !sourceParameter &&
    sourceNode.data.node_type !== NodeType.ELEMENTARY_CONSTRUCTOR &&
    sourceNode.data.node_type !== NodeType.PRIMITIVE
  ) {
    connectionCache.set(cacheKey, false)
    return false
  }

  const expectedInputType = getInputTypeAndName(
    targetNode,
    targetHandle
  )?.connectionType
  const sourceTypes = canvasOutputTypeCandidates(
    sourceNode.id,
    sourceHandle,
    nodes,
    edges
  )
  const sourceType = sourceTypes[0]

  console.log(
    `Handle ${
      connection.targetHandle
    } expects ${expectedInputType?.toString()}, source provides ${sourceType?.toString()}`
  )
  const isValid = sourceTypes.some((type) =>
    isTypeCompatible(type, expectedInputType)
  )
  console.log('connection is valid?', isValid)
  connectionCache.set(cacheKey, isValid) // Cache the result
  return isValid
}

const clearConnectionCache = () => connectionCache.clear()

/**
 * Resolves the concrete types available at a canvas output, following an
 * already-connected upstream edge for pass-through arguments.
 *
 * @param nodeId - ID of the node owning the output.
 * @param handleId - Output handle ID.
 * @param nodes - Current canvas nodes.
 * @param edges - Current canvas edges.
 * @param resolving - Outputs currently being resolved, used to stop cycles.
 * @returns Unique output types available at the handle.
 */
const canvasOutputTypeCandidates = (
  nodeId: string,
  handleId: string,
  nodes: Node<NodeDefinitions>[],
  edges: Edge[],
  resolving = new Set<string>()
): string[] => {
  const node = nodes.find((candidate) => candidate.id === nodeId)
  if (!node) return []

  const parameter = parameterHandlePath(handleId)
  if (parameter?.direction === 'output') {
    const outputType = getOutputTypeAndName(node, handleId)?.connectionType
    return outputType ? [outputType] : []
  }

  const handleIndex = handleIdToIndex(handleId)
  if (Number.isNaN(handleIndex)) return []

  const outputIndex = node.data.outputs?.[handleIndex]
  if (outputIndex == null) return []

  const key = `${nodeId}:${handleIndex}`
  if (resolving.has(key)) {
    return resolveOutputTypeCandidates(node.data, handleIndex)
  }

  let upstreamTypes: string[] = []
  const argument =
    outputIndex === -1 ? null : node.data.arguments?.[outputIndex]
  if (argument?.connection_type === ConnectionType.PASSTHROUGH) {
    const inputIndex = node.data.inputs?.indexOf(outputIndex) ?? -1
    const upstream = edges.find(
      (edge) =>
        edge.target === nodeId && edge.targetHandle === `input-${inputIndex}`
    )
    if (upstream) {
      const upstreamHandle = upstream.sourceHandle ?? 'output-0'
      upstreamTypes = canvasOutputTypeCandidates(
        upstream.source,
        upstreamHandle,
        nodes,
        edges,
        new Set(resolving).add(key)
      )
    }
  }

  return resolveOutputTypeCandidates(node.data, handleIndex, upstreamTypes)
}

const isTargetHandleConnected = (
  edges: Edge[],
  nodeId: string,
  handleId: string
): boolean =>
  edges.some((e) => e.target === nodeId && e.targetHandle === handleId)

export { isValidConnection, clearConnectionCache, isTargetHandleConnected }
