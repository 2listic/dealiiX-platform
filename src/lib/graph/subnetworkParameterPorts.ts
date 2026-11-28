import { analyzeNetworkBoundary } from './networkNode'
import { edgesFromProtocolToFlow } from './graphParser'
import { handleIdToIndex, parameterHandlePath } from './handleIds'
import { findParameterExposure, parameterOutputExposures } from '../parameters/parameterPorts'
import { isSubGraphNodeDefinition, type StandardNodeDefinition, type SubGraphNodeDefinition } from '../types/nodeTypes'

/** Check whether a subnetwork output presents an inner configuration or parameter output.
 * @param subnetwork - The subnetwork definition and its saved graph.
 * @param handle - The visible output handle.
 * @param definitionOf - Lookup for a concrete registry definition.
 * @returns Whether the graph boundary leads to an exposed parameter output.
 */
export function isSubnetworkParameterOutput(
  subnetwork: SubGraphNodeDefinition,
  handle: string,
  definitionOf: (type: string) => StandardNodeDefinition
): boolean {
  const { nodes, edges } = subnetwork.value.workflow
  const definitions = Object.entries(nodes).map(([id, node]) => ({
    id,
    position: { x: 0, y: 0 },
    data: isSubGraphNodeDefinition(node) ? node : { ...definitionOf(node.type), ...node },
  }))
  const boundary = analyzeNetworkBoundary(definitions, edgesFromProtocolToFlow(edges))
  const endpoint = boundary.networkOutputToInternalHandle[handleIdToIndex(handle)]
  if (!endpoint) return false
  const inner = definitions.find((node) => node.id === endpoint.nodeId)?.data
  if (!inner) return false
  if (isSubGraphNodeDefinition(inner)) {
    return isSubnetworkParameterOutput(inner, endpoint.handleId, definitionOf)
  }
  const parsed = parameterHandlePath(endpoint.handleId)
  return parsed?.direction === 'output' &&
    Boolean(findParameterExposure(parameterOutputExposures(inner), parsed.path))
}
