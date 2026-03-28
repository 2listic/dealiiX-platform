import type { Edge, Node, XYPosition } from '@xyflow/svelte'
import {
  HIDDEN_SIDEBAR_NODE_TYPES,
  NodeType,
  SELF,
  Type,
  type NetworkNodeOfTypeNetwork,
  type NodeData,
} from '../types/nodeTypes'

export type CanvasNodeTemplate = NodeData | NetworkNodeOfTypeNetwork

export type CompatibleNodeOption = {
  template: CanvasNodeTemplate
  handleId: string
  argumentName: string
  defaultNodeName: string
}

const cloneTemplateData = (template: CanvasNodeTemplate): CanvasNodeTemplate => {
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

export const getOutputMetadata = (
  sourceNode: Node,
  sourceHandle: string
): { sourceType: string; connectionName: string } | null => {
  const handleIndex = Number.parseInt(sourceHandle.split('-')[1], 10)
  if (Number.isNaN(handleIndex)) {
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
): CompatibleNodeOption[] =>
  templates
    .filter(
      (template) =>
        !HIDDEN_SIDEBAR_NODE_TYPES.includes(template.node_type) &&
        template.type !== excludedTemplateType
    )
    .flatMap((template) =>
      template.inputs.flatMap((argumentIndex, handleIndex) => {
        const argument = template.arguments?.[argumentIndex]
        if (!argument) {
          return []
        }

        if (argument.type !== Type.ANY && argument.type !== sourceType) {
          return []
        }

        return [
          {
            template,
            handleId: `input-${handleIndex}`,
            argumentName: argument.name,
            defaultNodeName: getDefaultTemplateNodeName(template),
          },
        ]
      })
    )

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

export const getSuggestedCreatedNodeName = (params: {
  connectionName: string
  startHandleType: 'source' | 'target'
  startNodeType: string
  firstCompatibleDefaultName?: string
}): string => {
  const formattedConnectionName = formatSuggestedNodeName(params.connectionName)

  if (
    params.startHandleType === 'source' &&
    params.startNodeType === NodeType.ELEMENTARY_CONSTRUCTOR
  ) {
    return params.firstCompatibleDefaultName ?? formattedConnectionName
  }

  return formattedConnectionName
}

export const findCompatibleSourceNodeOptions = (
  templates: CanvasNodeTemplate[],
  expectedInputType: string,
  excludedTemplateType?: string
): CompatibleNodeOption[] =>
  templates
    .filter(
      (template) =>
        !HIDDEN_SIDEBAR_NODE_TYPES.includes(template.node_type) &&
        template.type !== excludedTemplateType
    )
    .flatMap((template) =>
      template.outputs.flatMap((argumentIndex, handleIndex) => {
        const outputType =
          argumentIndex === SELF
            ? template.base ?? template.type
            : template.arguments?.[argumentIndex]?.type

        if (!outputType) {
          return []
        }

        if (expectedInputType !== Type.ANY && outputType !== expectedInputType) {
          return []
        }

        return [
          {
            template,
            handleId: `output-${handleIndex}`,
            argumentName:
              argumentIndex === SELF
                ? template.name ?? template.type
                : template.arguments?.[argumentIndex]?.name ?? template.type,
            defaultNodeName: getDefaultTemplateNodeName(template),
          },
        ]
      })
    )
