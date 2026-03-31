import type { Edge, Node, XYPosition } from '@xyflow/svelte'
import {
  HIDDEN_SIDEBAR_NODE_TYPES,
  SELF,
  Type,
  type NetworkNodeOfTypeNetwork,
  type NodeData,
} from '../types/nodeTypes'

// TODO: consider to move types to a separate file as already done with nodeTypes.ts
// Consider if CanvasNodeTemplate can be replaced or moved to nodeTypes.ts
// Consider also that NodeData | NetworkNodeOfTypeNetwork signature is already used in other files like:
// Sidebar.svelte and dragAndDrop.svelte
export type CanvasNodeTemplate = NodeData | NetworkNodeOfTypeNetwork

export type CompatibleNodeOption = {
  template: CanvasNodeTemplate
  handleId: string
  argumentName: string
  defaultNodeName: string
}

export type ConnectStartParams = {
  nodeId: string
  handleId: string
  handleType: 'source' | 'target'
}

export type ConnectedNodeDraft = {
  options: CompatibleNodeOption[]
  sourceType: string
  position: XYPosition
  connectStartParams: ConnectStartParams
}

const cloneTemplateData = (
  template: CanvasNodeTemplate
): CanvasNodeTemplate => {
  const cloned = {
    ...template,
    arguments: template.arguments.map((argument) => ({ ...argument })),
    inputs: [...template.inputs],
    outputs: [...template.outputs],
  } as CanvasNodeTemplate

  if ('value' in cloned && cloned.type === 'coral::Network') {
    // Stored network nodes keep an embedded graph that is not needed on-canvas.
    // eslint-disable-next-line no-unused-vars
    const { value, ...dataWithoutValue } = cloned
    return dataWithoutValue as NetworkNodeOfTypeNetwork
  }

  return cloned
}

export const createCanvasNode = (
  template: CanvasNodeTemplate,
  position: XYPosition,
  options: {
    id: string
    name?: string
  }
): Node => {
  const data = cloneTemplateData(template)

  if (options?.name) {
    data.name = options.name
  }

  return {
    id: options.id,
    type: data.node_type,
    data,
    position,
    origin: [0.5, 0.0],
  }
}

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
export const getOutputMetadata = (
  sourceNode: Node,
  sourceHandle: string
): { sourceType: string; connectionName: string } | null => {
  const handleIndex = Number.parseInt(sourceHandle.split('-')[1], 10)
  if (Number.isNaN(handleIndex)) {
    // TODO: add console warnings for every early return
    return null
  }

  const outputIndex = sourceNode.data.outputs?.[handleIndex]
  if (outputIndex == null) {
    return null
  }

  const defaultNodeName = sourceNode.data.name?.trim() || sourceNode.data.type

  if (outputIndex === SELF) {
    return {
      sourceType: sourceNode.data?.base ?? sourceNode.data.type,
      connectionName: defaultNodeName,
    }
  }

  const argument = sourceNode.data.arguments?.[outputIndex]
  if (!argument) {
    return null
  }

  return {
    sourceType: argument.type,
    connectionName: argument.name,
  }
}

export const findCompatibleNodeOptions = (
  templates: CanvasNodeTemplate[],
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
        defaultNodeName: getDefaultTemplateNodeName(template),
      })
    }
  }
  return options
}

export const getInputMetadata = (
  targetNode: Node,
  targetHandle: string
): { expectedInputType: string; connectionName: string } | null => {
  const handleIndex = Number.parseInt(targetHandle.split('-')[1], 10)
  if (Number.isNaN(handleIndex)) {
    return null
  }

  const inputIndex = targetNode.data.inputs?.[handleIndex]
  if (inputIndex == null) {
    return null
  }

  const argument = targetNode.data.arguments?.[inputIndex]
  if (!argument) {
    return null
  }

  return {
    expectedInputType: argument.type,
    connectionName: argument.name,
  }
}

export const formatSuggestedNodeName = (name: string): string => {
  const normalized = name.replaceAll('_', ' ').trim()
  if (!normalized) {
    return ''
  }

  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export const getDefaultTemplateNodeName = (
  template: CanvasNodeTemplate
): string => formatSuggestedNodeName(template.name ?? template.type)

export const findCompatibleSourceNodeOptions = (
  templates: CanvasNodeTemplate[],
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
        defaultNodeName: getDefaultTemplateNodeName(template),
      })
    }
  }
  return options
}

export const resolveConnectionContext = (
  node: Node,
  handleType: 'source' | 'target',
  handleId: string,
  templates: CanvasNodeTemplate[]
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
