/**
 * Utilities for creating and connecting nodes on the canvas.
 * Handles the drag-to-connect flow: resolving compatible node types,
 * building new nodes, and wiring edges.
 */

import type { Edge, Node, XYPosition } from '@xyflow/svelte'
import {
  ConnectionType,
  isTypeCompatible,
  NodeType,
  SELF,
  type Argument,
  type NodeDefinitions,
  type StandardNodeDefinition,
} from '../types/nodeTypes'
import { getNextNodeId } from '../stores/nodeIdCounter.svelte'
import {
  parameterExposureForHandle,
  parameterHandlePath,
  parameterPathLabel,
  parameterPortCoralType,
} from './parameterPorts'
import {
  nodeConcreteSignature,
  nodePaletteNodeName,
  nodeSimpleDisplayName,
} from './nodePalette'

/** A candidate node definition that can be placed as a new connected node. */
export type CompatibleNodeOption = {
  nodeDefinition: NodeDefinitions
  /** Handle ID on the new node that will be wired to the originating handle. */
  handleId: string
  argumentName: string | null
}

/** Snapshot of the handle that initiated a connection drag. */
export type ConnectStartParams = {
  nodeId: string
  handleId: string
  handleType: 'source' | 'target'
}

/** Pending state while the user selects a node type to place via the modal. */
export type ConnectedNodeDraft = {
  options: CompatibleNodeOption[]
  sourceType: string
  position: XYPosition
  connectStartParams: ConnectStartParams
}

/**
 * Shallow-clones a node definition so canvas node mutations don't affect the registry.
 * @param nodeDefinition - Node definition to clone.
 * @returns A shallow clone with `arguments`, `inputs`, and `outputs` copied; `value` stripped for network nodes.
 */
const cloneNodeDefinition = (
  nodeDefinition: NodeDefinitions
): NodeDefinitions => {
  const cloned = {
    ...nodeDefinition,
    arguments: nodeDefinition.arguments.map((argument) => ({ ...argument })),
    inputs: [...nodeDefinition.inputs],
    outputs: [...nodeDefinition.outputs],
    ...('parameter_file' in nodeDefinition &&
      nodeDefinition.parameter_file && {
        parameter_file: {
          exposures: nodeDefinition.parameter_file.exposures.map(
            (exposure) => ({
              ...exposure,
              path: [...exposure.path],
            })
          ),
        },
      }),
    ...('working_file' in nodeDefinition &&
      nodeDefinition.working_file && {
        working_file: { ...nodeDefinition.working_file },
      }),
  } as NodeDefinitions

  if ('value' in cloned && cloned.type === 'coral::Network') {
    // Stored network nodes keep an embedded graph that is not needed on-canvas.
    // eslint-disable-next-line no-unused-vars
    const { value, ...dataWithoutValue } = cloned
    return dataWithoutValue as NodeDefinitions
  }

  return cloned
}

/**
 * Creates a new @xyflow `Node` from a node definition.
 * The node ID is generated automatically from the store counter.
 * @param nodeDefinition - Source node definition from the registry or network nodes store.
 * @param position - Canvas position for the new node.
 * @param options - Optional `name` override for the new node.
 * @returns A new XYFlow `Node` ready to be placed on the canvas.
 */
export const createCanvasNode = (
  nodeDefinition: NodeDefinitions,
  position: XYPosition,
  options?: { name?: string }
): Node => {
  const data = cloneNodeDefinition(nodeDefinition)

  if (options?.name) {
    data.name = options.name
  }

  return {
    id: getNextNodeId().toString(),
    type: data.node_type,
    data,
    position,
    origin: [0.5, 0.0],
  }
}

/**
 * Builds an edge object with a deterministic ID from its endpoint handles.
 * @param params - Source/target node and handle IDs.
 * @returns An `Edge` with a deterministic ID derived from the endpoint handles.
 */
export const createCustomEdge = (params: {
  source: string
  sourceHandle: string
  target: string
  targetHandle: string
}): Edge => ({
  id: `xy-edge__${params.source}${params.sourceHandle}-${params.target}${params.targetHandle}`,
  source: params.source,
  sourceHandle: params.sourceHandle,
  target: params.target,
  targetHandle: params.targetHandle,
})

/**
 * Returns the output type and label for a given source handle.
 * For `SELF` outputs the type is `base ?? type` (the node's own class).
 * @param sourceNode - The node the connection was dragged from.
 * @param sourceHandle - Handle ID in the form `"output-<index>"`.
 * @returns The `connectionType` and `connectionName` for the handle, or `null` if the handle is invalid.
 */
export const getOutputTypeAndName = (
  sourceNode: Node,
  sourceHandle: string
): { connectionType: string; connectionName: string } | null => {
  const data = sourceNode.data as StandardNodeDefinition
  const parameterExposure = parameterExposureForHandle(
    data,
    sourceHandle,
    'output'
  )
  if (parameterExposure) {
    return {
      connectionType: parameterPortCoralType(parameterExposure.type),
      connectionName: parameterPathLabel(parameterExposure.path),
    }
  }
  const handleIndex = handleIdToIndex(sourceHandle)
  if (Number.isNaN(handleIndex)) {
    console.warn('getOutputTypeAndName: invalid handle id', sourceHandle)
    return null
  }

  const outputIndex = data.outputs?.[handleIndex]
  if (outputIndex == null) {
    console.warn(
      'getOutputTypeAndName: no output at index',
      handleIndex,
      'for node',
      sourceNode.id
    )
    return null
  }

  const defaultNodeName = data.name?.trim() || data.type

  if (outputIndex === SELF) {
    return {
      connectionType: data.output_type ?? data.base ?? data.type,
      connectionName: defaultNodeName,
    }
  }

  const argument = data.arguments?.[outputIndex]
  if (!argument) {
    console.warn(
      'getOutputTypeAndName: no argument at index',
      outputIndex,
      'for node',
      sourceNode.id
    )
    return null
  }

  return {
    connectionType: argument.type,
    connectionName: argument.name,
  }
}

/**
 * Finds all available nodes that accept `sourceType` on any input handle.
 * @param availableNodes - All available node definitions to search.
 * @param sourceType - Output type to match against.
 * @param excludedNodeType - Node type to skip (usually the source node itself).
 * @returns List of `CompatibleNodeOption` entries, one per matching input handle across all available nodes.
 */
export const findCompatibleTargetNodesAsOptions = (
  availableNodes: NodeDefinitions[],
  sourceType: string,
  excludedNodeType?: string
): CompatibleNodeOption[] => {
  const options: CompatibleNodeOption[] = []
  for (const nodeDefinition of availableNodes) {
    if (nodeDefinition.node_type === NodeType.ABSTRACT) continue
    if (nodeDefinition.type === excludedNodeType) continue
    for (
      let handleIndex = 0;
      handleIndex < nodeDefinition.inputs.length;
      handleIndex++
    ) {
      const argument = resolveInputArgument(nodeDefinition, handleIndex)
      if (!argument) continue
      if (!isTypeCompatible(sourceType, argument.type)) continue
      options.push({
        nodeDefinition,
        handleId: `input-${handleIndex}`,
        argumentName: argument.name,
      })
    }
  }
  return options
}

/**
 * Returns the expected input type and label for a given target handle.
 * @param targetNode - The node the connection was dropped onto.
 * @param targetHandle - Handle ID in the form `"input-<index>"`.
 * @returns The `connectionType` and `connectionName` for the handle, or `null` if the handle is invalid.
 */
export const getInputTypeAndName = (
  targetNode: Node,
  targetHandle: string
): { connectionType: string; connectionName: string } | null => {
  const data = targetNode.data as StandardNodeDefinition
  const parameterExposure = parameterExposureForHandle(
    data,
    targetHandle,
    'input'
  )
  if (parameterExposure) {
    return {
      connectionType: parameterPortCoralType(parameterExposure.type),
      connectionName: parameterPathLabel(parameterExposure.path),
    }
  }
  const handleIndex = handleIdToIndex(targetHandle)
  if (Number.isNaN(handleIndex)) {
    console.warn('getInputTypeAndName: invalid handle id', targetHandle)
    return null
  }

  const argument = resolveInputArgument(data, handleIndex)
  if (!argument) {
    console.warn(
      'getInputTypeAndName: no argument for input handle',
      handleIndex,
      'for node',
      targetNode.id
    )
    return null
  }

  return {
    connectionType: argument.type,
    connectionName: argument.name,
  }
}

/**
 * Converts a snake_case or raw identifier into a title-cased display name.
 * @param name - Raw name string (e.g. `"my_node_name"`).
 * @returns Display name (e.g. `"My node name"`), or `""` if input is blank.
 */
export const formatSuggestedNodeName = (name: string): string => {
  const normalized = name.replaceAll('_', ' ').trim()
  if (!normalized) {
    return ''
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

/**
 * Returns the canonical persisted instance name for a node.
 *
 * The old UI stored `variant_name` as the default instance name. Migrate that
 * generated value to the logical `display_name`, while preserving genuinely
 * custom names and network-node identifiers.
 *
 * @param node - Node whose persisted instance name should be canonicalized.
 * @returns Canonical instance name, or `undefined` when no name is stored.
 */
export const canonicalNodeName = (
  node: NodeDefinitions
): string | undefined => {
  if (!node.name) return undefined

  if (node.node_type !== NodeType.NETWORK) {
    const registryNode = node as StandardNodeDefinition
    if (
      registryNode.display_name?.trim() &&
      registryNode.variant_name?.trim() === node.name.trim()
    ) {
      return registryNode.display_name.trim()
    }
  }

  return node.name
}

/**
 * Returns the display name for a node definition.
 *
 * A persisted `name` is an instance label, except when it is the old
 * automatically generated variant label. In that case use the logical
 * `display_name` so loading an older graph also repairs its canvas label.
 *
 * @param node - Registry node or stored subgraph node.
 * @returns Display name, or `""` if all available labels are blank.
 */
export const returnNodeName = (node: NodeDefinitions): string => {
  const canonicalName = canonicalNodeName(node)
  if (canonicalName) return formatSuggestedNodeName(canonicalName)

  if (node.node_type !== NodeType.NETWORK) {
    const registryNode = node as StandardNodeDefinition
    return formatSuggestedNodeName(nodePaletteNodeName(registryNode))
  }

  return formatSuggestedNodeName(nodeSimpleDisplayName(node.type))
}

/** Returns the concrete registry identifier for a picker/connection option. */
export const returnNodeSignature = (node: NodeDefinitions): string =>
  nodeConcreteSignature(node as StandardNodeDefinition)

/**
 * Finds all available nodes that produce `expectedInputType` on any output handle.
 * Mirror of {@link findCompatibleTargetNodesAsOptions} for the reverse drag direction (from a target handle).
 * @param availableNodes - All available node definitions to search.
 * @param expectedInputType - Input type to match against.
 * @param excludedNodeType - Node type to skip (usually the target node itself).
 * @returns List of `CompatibleNodeOption` entries, one per matching output handle across all available nodes.
 */
export const findCompatibleSourceNodesAsOptions = (
  availableNodes: NodeDefinitions[],
  expectedInputType: string,
  excludedNodeType?: string,
  frontendScalarOnly = false
): CompatibleNodeOption[] => {
  const options: CompatibleNodeOption[] = []
  for (const nodeDefinition of availableNodes) {
    if (nodeDefinition.node_type === NodeType.ABSTRACT) continue
    if (
      frontendScalarOnly &&
      ![NodeType.ELEMENTARY_CONSTRUCTOR, NodeType.PRIMITIVE].includes(
        nodeDefinition.node_type
      )
    ) {
      continue
    }
    if (nodeDefinition.type === excludedNodeType) continue
    for (
      let handleIndex = 0;
      handleIndex < nodeDefinition.outputs.length;
      handleIndex++
    ) {
      const outputType = resolveOutputType(nodeDefinition, handleIndex)
      if (!outputType) continue
      if (!isTypeCompatible(outputType, expectedInputType)) continue
      options.push({
        nodeDefinition,
        handleId: `output-${handleIndex}`,
        argumentName: resolveOutputName(nodeDefinition, handleIndex),
      })
    }
  }
  return options
}

/**
 * Resolves handle metadata and compatible node definitions for a drag-to-connect drop.
 * @param connectStartParams - The handle that initiated the connection drag.
 * @param node - The node that owns the originating handle.
 * @param availableNodes - All available node definitions to search for compatible matches.
 * @returns `{ connectionType, connectionName, compatibleOptions }`, or `null` if the handle
 *   metadata cannot be resolved (e.g. invalid handle id).
 */
export const resolveConnectionAndCompatibleNodes = (
  connectStartParams: ConnectStartParams,
  node: Node,
  availableNodes: NodeDefinitions[]
): {
  connectionType: string
  connectionName: string
  compatibleOptions: CompatibleNodeOption[]
} | null => {
  const connectionInfo =
    connectStartParams.handleType === 'source'
      ? getOutputTypeAndName(node, connectStartParams.handleId) // 'source'
      : getInputTypeAndName(node, connectStartParams.handleId) // 'target'
  if (!connectionInfo) return null

  const { connectionType, connectionName } = connectionInfo
  const nodeType = (node.data as StandardNodeDefinition).type
  const targetIsParameterInput =
    connectStartParams.handleType === 'target' &&
    parameterHandlePath(connectStartParams.handleId)?.direction === 'input'
  const compatibleOptions =
    connectStartParams.handleType === 'source'
      ? findCompatibleTargetNodesAsOptions(
          availableNodes,
          connectionType,
          nodeType
        ) // 'source'
      : findCompatibleSourceNodesAsOptions(
          availableNodes,
          connectionType,
          targetIsParameterInput ? undefined : nodeType,
          targetIsParameterInput
        ) // 'target'

  return { connectionType, connectionName, compatibleOptions }
}

/**
 * Builds the edge that wires a newly created node back to the originating handle.
 * Source/target order is swapped depending on which direction the drag started.
 * @param connectStartParams - Params from the XYFlow OnConnectStart callback function.
 * @param newNodeId - ID of the newly created canvas node.
 * @param newNodeHandleId - Handle ID on the new node to connect to.
 * @returns An `Edge` connecting the originating handle to the new node.
 */
export const buildEdgeForNewNode = (
  connectStartParams: ConnectStartParams,
  newNodeId: string,
  newNodeHandleId: string
): Edge => {
  if (connectStartParams.handleType === 'source') {
    return createCustomEdge({
      source: connectStartParams.nodeId,
      sourceHandle: connectStartParams.handleId,
      target: newNodeId,
      targetHandle: newNodeHandleId,
    })
  } else {
    return createCustomEdge({
      source: newNodeId,
      sourceHandle: newNodeHandleId,
      target: connectStartParams.nodeId,
      targetHandle: connectStartParams.handleId,
    })
  }
}

/**
 * Parses a handle ID string to its numeric index.
 * @param {string} handleId - XYFlow handle ID in the form `"input-<n>"` or `"output-<n>"`
 *   (as found in `sourceHandle` / `targetHandle` of XYFlow edges and connection events).
 * @returns The numeric index, or NaN if the string is malformed.
 */
export const handleIdToIndex = (handleId: string): number =>
  Number.parseInt(handleId.split('-')[1], 10)

/**
 * Resolves the argument corresponding to an input handle index on a node.
 * Follows the indirection: `inputs[handleIndex]` → `arguments[argumentIndex]`.
 * @param {NodeDefinitions} data - The node data containing `inputs` and `arguments` arrays.
 * @param {number} handleIndex - Zero-based index into the node's `inputs` array,
 *   typically obtained by parsing a handle ID with {@link handleIdToIndex}.
 * @returns The argument, or null if the index is out of range.
 */
export const resolveInputArgument = (
  data: NodeDefinitions,
  handleIndex: number
): Argument | null => {
  const argumentIndex = data.inputs?.[handleIndex]
  if (argumentIndex == null) return null
  return data.arguments?.[argumentIndex] ?? null
}

/**
 * Resolves the output type string for an output handle index on a node.
 * Handles the SELF case (`outputs[-1]`) by returning
 * `output_type ?? base ?? type`.
 * @param {NodeDefinitions} data - The node data containing `outputs`, `arguments`, `type`, and optional `output_type`/`base`.
 * @param {number} handleIndex - Zero-based index into the node's `outputs` array,
 *   typically obtained by parsing a handle ID with {@link handleIdToIndex}.
 * @returns The type string, or null if the index is out of range.
 */
export const resolveOutputType = (
  data: NodeDefinitions,
  handleIndex: number
): string | null => {
  const outputIndex = data.outputs?.[handleIndex]
  if (outputIndex == null) return null
  if (outputIndex === SELF)
    return (
      (data as StandardNodeDefinition).output_type ??
      (data as StandardNodeDefinition).base ??
      data.type
    )
  return data.arguments?.[outputIndex]?.type ?? null
}

/**
 * Resolves every type that may be observed at an output handle.
 *
 * A derived self-output is externally usable both as its registered base and
 * as the concrete derived type. A pass-through output additionally preserves
 * the concrete types resolved from its upstream input.
 *
 * @param data - The node definition containing the output metadata.
 * @param handleIndex - Zero-based index into the node's `outputs` array.
 * @param upstreamTypes - Concrete types propagated through a pass-through input.
 * @returns Unique output types, or an empty array for an invalid handle.
 */
export const resolveOutputTypeCandidates = (
  data: NodeDefinitions,
  handleIndex: number,
  upstreamTypes: string[] = []
): string[] => {
  const outputIndex = data.outputs?.[handleIndex]
  if (outputIndex == null) return []

  const candidates: string[] = []
  if (outputIndex === SELF) {
    const standardData = data as StandardNodeDefinition
    if (standardData.output_type) {
      candidates.push(standardData.output_type)
    } else if (standardData.base) {
      candidates.push(standardData.base, data.type)
    } else {
      candidates.push(data.type)
    }
  } else {
    const argument = data.arguments?.[outputIndex]
    if (!argument) return []
    candidates.push(argument.type)
    if (argument.connection_type === ConnectionType.PASSTHROUGH) {
      candidates.push(...upstreamTypes)
    }
  }

  return [...new Set(candidates)]
}

/**
 * Resolves the display name for an output handle index on a node.
 * For the SELF case (`outputs[-1]`) no real argument exists, so the name is built
 * from `node.name` falling back to `node.type`.
 * @param {NodeDefinitions} data - The node data containing `outputs`, `arguments`, `type`, and optional `name`.
 * @param {number} handleIndex - Zero-based index into the node's `outputs` array,
 *   typically obtained by parsing a handle ID with {@link handleIdToIndex}.
 * @returns The display name, or null if the index is out of range.
 */
export const resolveOutputName = (
  data: NodeDefinitions,
  handleIndex: number
): string | null => {
  const outputIndex = data.outputs?.[handleIndex]
  if (outputIndex == null) return null
  if (outputIndex === SELF) return data.name?.trim() || data.type
  return data.arguments?.[outputIndex]?.name ?? null
}
