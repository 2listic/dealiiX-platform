/**
 * Utilities for creating and connecting nodes on the canvas.
 * Handles the drag-to-connect flow: resolving compatible node types,
 * building new nodes, and wiring edges.
 */

import type { Edge, Node, XYPosition } from '@xyflow/svelte'
import {
  HIDDEN_SIDEBAR_NODE_TYPES,
  SELF,
  Type,
  returnNodeName,
  type CanvasNode,
  type NodeData,
} from '../types/nodeTypes'
import { getNextNodeId } from '../stores/nodeIdCounter.svelte'

/** A template match that can be placed as a new connected node. */
export type CompatibleNodeOption = {
  template: CanvasNode
  /** Handle ID on the new node that will be wired to the originating handle. */
  handleId: string
  argumentName: string
  defaultNodeName: string
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
 * Shallow-clones a template so canvas node mutations don't affect the registry.
 * @param template - Registry template to clone.
 */
const cloneTemplateData = (template: CanvasNode): CanvasNode => {
  const cloned = {
    ...template,
    arguments: template.arguments.map((argument) => ({ ...argument })),
    inputs: [...template.inputs],
    outputs: [...template.outputs],
  } as CanvasNode

  if ('value' in cloned && cloned.type === 'coral::Network') {
    // Stored network nodes keep an embedded graph that is not needed on-canvas.
    // eslint-disable-next-line no-unused-vars
    const { value, ...dataWithoutValue } = cloned
    return dataWithoutValue as CanvasNode
  }

  return cloned
}

/**
 * Creates a new @xyflow `Node` from a registry template.
 * The node ID is generated automatically from the store counter.
 * @param template - Source template from the sidebar registry.
 * @param position - Canvas position for the new node.
 * @param options - Optional `name` override for the new node.
 */
export const createCanvasNode = (
  template: CanvasNode,
  position: XYPosition,
  options?: { name?: string }
): Node => {
  const data = cloneTemplateData(template)

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

// TODO: centralize all the features relative to nodes' data so that we have a unique source of truth.
// For example here we are providing node's handlers type having input/output index.
// We have similar logics providing data of a node starting from some other data in files UnifiedNode.svelte,
// connectionsValidation.js. graphParser.ts, networkNodes.ts
// Perhaps this new logic may be placed in nodes.svelte.ts file and reused in all the places
/**
 * Returns the output type and label for a given source handle.
 * For `SELF` outputs the type is `base ?? type` (the node's own class).
 * @param sourceNode - The node the connection was dragged from.
 * @param sourceHandle - Handle ID in the form `"output-<index>"`.
 */
export const getOutputMetadata = (
  sourceNode: Node,
  sourceHandle: string
): { sourceType: string; connectionName: string } | null => {
  const data = sourceNode.data as NodeData
  const handleIndex = Number.parseInt(sourceHandle.split('-')[1], 10)
  if (Number.isNaN(handleIndex)) {
    // TODO: add console warnings for every early return
    return null
  }

  const outputIndex = data.outputs?.[handleIndex]
  if (outputIndex == null) {
    return null
  }

  const defaultNodeName = data.name?.trim() || data.type

  if (outputIndex === SELF) {
    return {
      sourceType: data?.base ?? data.type,
      connectionName: defaultNodeName,
    }
  }

  const argument = data.arguments?.[outputIndex]
  if (!argument) {
    return null
  }

  return {
    sourceType: argument.type,
    connectionName: argument.name,
  }
}

/**
 * Finds all templates that accept `sourceType` on any input handle.
 * @param templates - Registry templates to search.
 * @param sourceType - Output type to match against.
 * @param excludedTemplateType - Template type to skip (usually the source node itself).
 */
export const findCompatibleNodeOptions = (
  templates: CanvasNode[],
  sourceType: string,
  excludedTemplateType?: string
): CompatibleNodeOption[] => {
  const options: CompatibleNodeOption[] = []
  for (const template of templates) {
    // TODO: consider to include nodes of type NodeType.NETWORK
    if (HIDDEN_SIDEBAR_NODE_TYPES.includes(template.node_type)) continue
    if (template.type === excludedTemplateType) continue
    for (
      let handleIndex = 0;
      handleIndex < template.inputs.length;
      handleIndex++
    ) {
      // TODO: consider to centralize this: from handler index, we get the corresponding argument
      const argumentIndex = template.inputs[handleIndex]
      const argument = template.arguments?.[argumentIndex]
      if (!argument) continue
      if (argument.type !== Type.ANY && argument.type !== sourceType) continue
      options.push({
        template,
        handleId: `input-${handleIndex}`,
        argumentName: argument.name,
        defaultNodeName: returnNodeName(template),
      })
    }
  }
  return options
}

/**
 * Returns the expected input type and label for a given target handle.
 * @param targetNode - The node the connection was dropped onto.
 * @param targetHandle - Handle ID in the form `"input-<index>"`.
 */
export const getInputMetadata = (
  targetNode: Node,
  targetHandle: string
): { expectedInputType: string; connectionName: string } | null => {
  const data = targetNode.data as NodeData
  // TODO: centralize this too
  const handleIndex = Number.parseInt(targetHandle.split('-')[1], 10)
  // TODO: centralize this too
  if (Number.isNaN(handleIndex)) {
    return null
  }

  const inputIndex = data.inputs?.[handleIndex]
  if (inputIndex == null) {
    return null
  }

  const argument = data.arguments?.[inputIndex]
  if (!argument) {
    return null
  }

  return {
    expectedInputType: argument.type,
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
 * Finds all templates that produce `expectedInputType` on any output handle.
 * Mirror of {@link findCompatibleNodeOptions} for the reverse drag direction (from a target handle).
 * @param templates - Registry templates to search.
 * @param expectedInputType - Input type to match against.
 * @param excludedTemplateType - Template type to skip (usually the target node itself).
 */
export const findCompatibleSourceNodeOptions = (
  templates: CanvasNode[],
  expectedInputType: string,
  excludedTemplateType?: string
): CompatibleNodeOption[] => {
  const options: CompatibleNodeOption[] = []
  for (const template of templates) {
    // TODO: consider to include nodes of type NodeType.NETWORK
    if (HIDDEN_SIDEBAR_NODE_TYPES.includes(template.node_type)) continue
    if (template.type === excludedTemplateType) continue
    for (
      let handleIndex = 0;
      handleIndex < template.outputs.length;
      handleIndex++
    ) {
      // TODO: consider to centralize this too: get node output type
      const argumentIndex = template.outputs[handleIndex]
      const outputType =
        argumentIndex === SELF
          ? (('base' in template ? template.base : undefined) ?? template.type)
          : template.arguments?.[argumentIndex]?.type
      if (!outputType) continue
      if (expectedInputType !== Type.ANY && outputType !== expectedInputType)
        continue
      options.push({
        template,
        handleId: `output-${handleIndex}`,
        argumentName:
          argumentIndex === SELF
            ? (template.name ?? template.type)
            : (template.arguments?.[argumentIndex]?.name ?? template.type),
        defaultNodeName: returnNodeName(template),
      })
    }
  }
  return options
}

/**
 * Entry point for the drag-to-connect flow.
 * Reads the originating handle metadata and returns compatible template options
 * along with the connection label and type string.
 * @param node - Node the drag started from.
 * @param handleType - Whether the drag originated from a source or target handle.
 * @param handleId - Handle ID in the form `"output-<n>"` or `"input-<n>"`.
 * @param templates - All available registry templates.
 */
export const resolveConnectionContext = (
  node: Node,
  handleType: 'source' | 'target',
  handleId: string,
  templates: CanvasNode[]
): {
  compatibleOptions: CompatibleNodeOption[]
  connectionName: string
  connectionType: string
} | null => {
  if (handleType === 'source') {
    const metadata = getOutputMetadata(node, handleId)
    if (!metadata) return null
    return {
      compatibleOptions: findCompatibleNodeOptions(
        templates,
        metadata.sourceType,
        (node.data as NodeData).type
      ),
      connectionName: metadata.connectionName,
      connectionType: metadata.sourceType,
    }
  } else {
    const metadata = getInputMetadata(node, handleId)
    if (!metadata) return null
    return {
      compatibleOptions: findCompatibleSourceNodeOptions(
        templates,
        metadata.expectedInputType,
        (node.data as NodeData).type
      ),
      connectionName: metadata.connectionName,
      connectionType: metadata.expectedInputType,
    }
  }
}

/**
 * Builds the edge that wires a newly created node back to the originating handle.
 * Source/target order is swapped depending on which direction the drag started.
 * @param connectStartParams - Params from the XYFlow OnConnectStart callback function.
 * @param newNodeId - ID of the newly created canvas node.
 * @param newNodeHandleId - Handle ID on the new node to connect to.
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
