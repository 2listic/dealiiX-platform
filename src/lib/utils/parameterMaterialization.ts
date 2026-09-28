import type { Edge, Node } from '@xyflow/svelte'
import type {
  ParameterPortType,
  StandardNodeDefinition,
} from '../types/nodeTypes'
import type { ParameterTree } from '../types/parameterTypes'
import type { ExecutionLocation } from '../types/settingsTypes'
import {
  parseParametersFileWithFormat,
  serializeParametersFile,
} from './parameterFileFormat'
import {
  parameterAtPath,
  parameterHandle,
  parameterHandlePath,
  parameterInputExposures,
  parameterOutputExposures,
  parameterPortCoralType,
} from './parameterPorts'
import {
  parameterFileTarget,
  readParameterFile,
  writeParameterFile,
} from './parameterFileAccess'
import { NodeType, SELF } from '../types/nodeTypes'

type MaterializedGraph = {
  nodes: Node[]
  edges: Edge[]
}

type LoadedParameterFile = {
  tree: ParameterTree
  format: 'json' | 'prm'
  fileName: string
  dirty: boolean
}

const isParameterNode = (node: Node): node is Node<StandardNodeDefinition> => {
  const data = node.data as StandardNodeDefinition
  return Boolean(
    data?.parameter_file?.exposures?.length && typeof data.value === 'string'
  )
}

const nodeType = (node: Node): string =>
  String((node.data as StandardNodeDefinition).type)

export const scalarValueFromNode = (
  node: Node,
  handle: string
): string | null => {
  const data = node.data as StandardNodeDefinition
  if (
    data.node_type !== NodeType.ELEMENTARY_CONSTRUCTOR &&
    data.node_type !== NodeType.PRIMITIVE
  ) {
    return null
  }
  if (handle !== 'output-0') return null
  if (data.outputs?.[0] !== SELF) return null
  return data.value == null ? '' : String(data.value)
}

const convertValue = (
  raw: string,
  type: ParameterPortType,
  path: string[]
): string => {
  const value = raw.trim()
  switch (type) {
    case 'bool':
      if (value.toLowerCase() === 'true') return 'true'
      if (value.toLowerCase() === 'false') return 'false'
      throw new Error(
        `Parameter ${path.join(' / ')} expects bool, received "${raw}"`
      )
    case 'int':
      if (!/^[+-]?\d+$/.test(value)) {
        throw new Error(
          `Parameter ${path.join(' / ')} expects int, received "${raw}"`
        )
      }
      return value
    case 'unsigned int': {
      const unsigned = Number(value)
      if (
        !/^\d+$/.test(value) ||
        !Number.isSafeInteger(unsigned) ||
        unsigned > 4_294_967_295
      ) {
        throw new Error(
          `Parameter ${path.join(' / ')} expects unsigned int, received "${raw}"`
        )
      }
      return value
    }
    case 'double': {
      if (!value || !Number.isFinite(Number(value))) {
        throw new Error(
          `Parameter ${path.join(' / ')} expects double, received "${raw}"`
        )
      }
      return value
    }
    default:
      return raw
  }
}

const cloneNode = (node: Node): Node => ({
  ...node,
  data: { ...(node.data as Record<string, unknown>) },
})

/**
 * Applies frontend parameter bindings and turns virtual parameter outputs into
 * ordinary literal nodes in an execution-only graph. The returned nodes and
 * edges are never written back to the canvas.
 */
export const materializeParameterGraph = async (
  location: ExecutionLocation,
  inputNodes: Node[],
  inputEdges: Edge[],
  parameterInputOverrides: Record<string, string> = {}
): Promise<MaterializedGraph> => {
  const nodes = inputNodes.map(cloneNode)
  const edges = inputEdges.map((edge) => ({ ...edge }))
  const nodesById = new Map(nodes.map((node) => [node.id, node]))
  const loaded = new Map<string, LoadedParameterFile>()
  const materializing = new Set<string>()

  const load = async (node: Node): Promise<LoadedParameterFile> => {
    const cached = loaded.get(node.id)
    if (cached) return cached
    if (materializing.has(node.id)) {
      throw new Error(`Cyclic parameter-file dependency at node ${node.id}`)
    }
    materializing.add(node.id)
    try {
      const data = node.data as StandardNodeDefinition
      const target = parameterFileTarget(location, String(data.value))
      const file = await readParameterFile(target)
      const parsed = parseParametersFileWithFormat(
        file.content,
        target.fileName
      )
      const result: LoadedParameterFile = {
        tree: parsed.data,
        format: parsed.format,
        fileName: target.fileName,
        dirty: false,
      }
      loaded.set(node.id, result)
      return result
    } finally {
      materializing.delete(node.id)
    }
  }

  const resolveSource = async (
    sourceId: string,
    sourceHandle: string,
    stack: Set<string>
  ): Promise<string> => {
    const source = nodesById.get(sourceId)
    if (!source) throw new Error(`Source node ${sourceId} was not found`)
    const sourceParameter = parameterHandlePath(sourceHandle)
    if (!sourceParameter || sourceParameter.direction !== 'output') {
      const literal = scalarValueFromNode(source, sourceHandle)
      if (literal !== null) return literal
      throw new Error(
        `Parameter inputs may only use frontend-known scalar values; node ${sourceId} (${nodeType(source)}) is computed at runtime`
      )
    }

    if (stack.has(sourceId)) {
      throw new Error(`Cyclic parameter output dependency at node ${sourceId}`)
    }
    const nextStack = new Set(stack).add(sourceId)
    await materializeNode(source, nextStack)
    const file = await load(source)
    const leaf = parameterAtPath(file.tree, sourceParameter.path)
    if (!leaf) {
      throw new Error(
        `Parameter ${sourceParameter.path.join(' / ')} is missing from node ${sourceId}`
      )
    }
    return leaf.value
  }

  const materializeNode = async (
    node: Node,
    stack: Set<string> = new Set([node.id])
  ): Promise<LoadedParameterFile> => {
    const file = await load(node)
    const data = node.data as StandardNodeDefinition
    for (const exposure of parameterInputExposures(data)) {
      const handle = parameterHandle('input', exposure.path)
      const overrideKey = `${node.id}::${handle}`
      const hasOverride = Object.prototype.hasOwnProperty.call(
        parameterInputOverrides,
        overrideKey
      )
      const incoming = edges.filter(
        (edge) => edge.target === node.id && edge.targetHandle === handle
      )
      if (incoming.length !== 1 && !hasOverride) {
        throw new Error(
          `Exposed parameter ${exposure.path.join(' / ')} on ${data.value} requires exactly one input connection`
        )
      }
      const raw = hasOverride
        ? parameterInputOverrides[overrideKey]
        : await resolveSource(
            incoming[0].source,
            incoming[0].sourceHandle as string,
            stack
          )
      const leaf = parameterAtPath(file.tree, exposure.path)
      if (!leaf) {
        throw new Error(
          `Parameter ${exposure.path.join(' / ')} is missing from ${data.value}`
        )
      }
      leaf.value = convertValue(raw, exposure.type, exposure.path)
      file.dirty = true
    }

    if (file.dirty) {
      await writeParameterFile(
        parameterFileTarget(location, file.fileName),
        serializeParametersFile(
          file.tree,
          file.format === 'prm' ? 'parameters.prm' : 'parameters.json'
        )
      )
      file.dirty = false
    }
    return file
  }

  for (const node of nodes) {
    if (isParameterNode(node)) await materializeNode(node)
  }

  let nextId =
    nodes.reduce(
      (max, node) => Math.max(max, Number.parseInt(node.id, 10) || -1),
      -1
    ) + 1
  const syntheticByPort = new Map<string, string>()

  for (const node of nodes.filter(isParameterNode)) {
    const data = node.data as StandardNodeDefinition
    const file = await load(node)
    for (const exposure of parameterOutputExposures(data)) {
      const sourceHandle = parameterHandle('output', exposure.path)
      const outgoing = edges.filter(
        (edge) => edge.source === node.id && edge.sourceHandle === sourceHandle
      )
      if (!outgoing.length) continue
      const leaf = parameterAtPath(file.tree, exposure.path)
      if (!leaf) {
        throw new Error(
          `Parameter ${exposure.path.join(' / ')} is missing from ${data.value}`
        )
      }
      const value = convertValue(leaf.value, exposure.type, exposure.path)
      const portKey = `${node.id}:${sourceHandle}`
      let syntheticId = syntheticByPort.get(portKey)
      if (!syntheticId) {
        syntheticId = String(nextId++)
        syntheticByPort.set(portKey, syntheticId)
        const coralType = parameterPortCoralType(exposure.type)
        nodes.push({
          id: syntheticId,
          type: NodeType.ELEMENTARY_CONSTRUCTOR,
          position: { x: 0, y: 0 },
          data: {
            type: coralType,
            node_type: NodeType.ELEMENTARY_CONSTRUCTOR,
            arguments: [],
            inputs: [],
            outputs: [SELF],
            value,
            is_valid: true,
          },
        })
      }
      for (const edge of outgoing) {
        edge.source = syntheticId
        edge.sourceHandle = 'output-0'
        edge.id = `xy-edge__${edge.source}${edge.sourceHandle}-${edge.target}${edge.targetHandle}`
      }
    }
  }

  const virtualEdges = new Set(
    edges.filter((edge) => {
      const sourceVirtual = parameterHandlePath(edge.sourceHandle as string)
      const targetVirtual = parameterHandlePath(edge.targetHandle as string)
      return Boolean(sourceVirtual || targetVirtual)
    })
  )
  const executionEdges = edges.filter((edge) => {
    const targetVirtual = parameterHandlePath(edge.targetHandle as string)
    const sourceVirtual = parameterHandlePath(edge.sourceHandle as string)
    return !targetVirtual && !sourceVirtual && !virtualEdges.has(edge)
  })

  // Parameter metadata is a frontend concern. Keep the original filename and
  // ordinary backend handles, but never send the exposure block to Coral.
  for (const node of nodes) {
    const data = node.data as Record<string, unknown>
    if ('parameter_file' in data) delete data.parameter_file
  }

  return { nodes, edges: executionEdges }
}
