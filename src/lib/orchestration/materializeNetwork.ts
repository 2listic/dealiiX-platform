/**
 * Parameter-file materialization at submit. A graph saved by the editor binds
 * values to entries of parameter files through virtual ports; Coral only reads
 * files. Each parameter-file node gets a copy of its file in the run directory,
 * with its bound inputs written in, and the graph is rewritten into what Coral
 * reads: no virtual edges, no `parameter_file`, used parameter outputs turned
 * into literals, and subnetwork interfaces recomputed.
 */

import type { Edge, Node } from '@xyflow/svelte'
import {
  isSubGraphNodeDefinition,
  NodeType,
  SELF,
  type LeanNodes,
  type LeanStandardNode,
  type Network,
  type NetworkEdge,
  type ParameterExposure,
  type ParameterPortType,
  type QualifiedNetwork,
  type StandardNodeDefinition,
  type SubGraphNodeDefinition,
} from '../types/nodeTypes'
import type { ParameterTree } from '../types/parameterTypes'
import type { ExecutionLocation } from '../types/settingsTypes'
import {
  addQualifiedIds,
  edgesFromProtocolToFlow,
  removeQualifiedIds,
} from '../utils/graphParser'
import {
  analyzeNetworkBoundary,
  type BoundaryAnalysis,
} from '../utils/networkNode'
import { handleIdToIndex } from '../utils/canvasNodeUtils'
import {
  parseParametersFileWithFormat,
  serializeParametersAs,
} from '../utils/parameterFileFormat'
import {
  findParameterExposure,
  parameterAtPath,
  parameterHandle,
  parameterHandlePath,
  parameterInputExposures,
  parameterOutputExposures,
  parameterPortCoralType,
} from '../utils/parameterPorts'
import {
  normalizeRelativeParameterPath,
  parameterFileTarget,
  readParameterFile,
  writeParameterFile,
} from '../utils/parameterFileAccess'
import { resolveParameterFileReferences } from '../utils/fileReferences'

/** Returns the registry definition of a standard node type. */
export type NodeDefinitionLookup = (type: string) => StandardNodeDefinition

/**
 * Writes each parameter-file node's file, with its bound inputs applied, into
 * the run directory, and returns the graph Coral runs. A graph without
 * parameter files is returned as is.
 * @param graph - The submitted graph in the saved form, with or without qualified ids.
 * @param options.location - Execution location holding the source files and the run directory.
 * @param options.copyDirectory - Directory the copies are written to (the run folder); nodes get their absolute paths.
 * @param options.definitionOf - Registry lookup for the ports of standard nodes, which saved graphs keep lean.
 * @returns The graph for Coral, with qualified ids.
 * @throws {Error} If a binding is invalid (see {@link validateParameterBindings}), a file or entry is missing, a value does not fit its type, or two nodes bind the same file differently.
 */
export const materializeNetwork = async (
  graph: object,
  options: {
    location: ExecutionLocation
    copyDirectory: string
    definitionOf: NodeDefinitionLookup
  }
): Promise<object> => {
  if (!hasParameterFile(graph)) return graph
  const { location, copyDirectory, definitionOf } = options
  const bindings = parameterBindings(asNetwork(graph), definitionOf)
  bindings.validate()

  const trees = new Map<string, ParameterTree>()
  const copies = new Map<string, { content: string; nodeKey: string }>()

  // Validation has rejected cycles, so the recursion through bindings ends.
  const materialize = async (port: NodePort): Promise<ParameterTree> => {
    const key = nodeKey(port)
    const cached = trees.get(key)
    if (cached) return cached

    const node = standardNode(port)
    const source = parameterFileTarget(location, String(node.value))
    const file = await readParameterFile(source)
    const { data, format } = parseParametersFileWithFormat(
      file.content,
      source.fileName
    )
    for (const exposure of parameterInputExposures(node)) {
      const binding = bindings.inputBinding(port, exposure)
      const raw =
        binding.kind === 'literal'
          ? binding.value
          : outputValue(await materialize(binding), binding.exposure)
      entryAt(data, exposure.path, source.fileName).value = convertValue(
        raw,
        exposure.type,
        exposure.path
      )
    }
    const tree = await resolveParameterFileReferences(
      data,
      location,
      source.workingDirectory
    )

    // One copy per file, so nodes sharing a file must agree on its content.
    const fileName = normalizeRelativeParameterPath(source.fileName)
    const content = serializeParametersAs(tree, format)
    const copy = copies.get(fileName)
    if (copy && copy.content !== content) {
      throw new Error(
        `${fileName} is bound differently by nodes ${copy.nodeKey} and ${key}; use a separate file for each`
      )
    }
    if (!copy) {
      await writeParameterFile(
        {
          location,
          workingDirectory: copyDirectory,
          fileName: source.fileName,
        },
        content
      )
      copies.set(fileName, { content, nodeKey: key })
    }
    trees.set(key, tree)
    return tree
  }

  for (const port of bindings.parameterNodes()) await materialize(port)

  const { network } = rewriteForCoral(bindings.root, {
    bindings,
    definitionOf,
    runCopyOf: (port) =>
      `${withoutTrailingSlash(copyDirectory)}/${normalizeRelativeParameterPath(String(standardNode(port).value))}`,
    valueOf: (source) =>
      outputValue(trees.get(nodeKey(source)) as ParameterTree, source.exposure),
  })
  return addQualifiedIds(network)
}

/**
 * Checks that every exposed parameter input has exactly one source whose value
 * is known before the run: a literal, or a parameter output of another file,
 * possibly through subnetwork boundaries. Reads no files.
 * @param graph - A graph in the saved form, with or without qualified ids.
 * @param definitionOf - Registry lookup for the ports of standard nodes.
 * @returns Nothing; the bindings are valid when it returns.
 * @throws {Error} Naming the first invalid binding, or a cycle between parameter files.
 */
export const validateParameterBindings = (
  graph: object,
  definitionOf: NodeDefinitionLookup
): void => {
  if (!hasParameterFile(graph)) return
  parameterBindings(asNetwork(graph), definitionOf).validate()
}

/**
 * Checks whether an output of a subnetwork stands for a parameter output
 * exposed by a node inside it, at any depth, so that it may feed an exposed
 * parameter input like the parameter output itself.
 * @param subnetwork - The subnetwork node, with its content in `value`.
 * @param handle - The subnetwork's output handle (`output-<n>`).
 * @param definitionOf - Registry lookup for the ports of standard nodes.
 * @returns Whether the output leads to an exposed parameter output.
 */
export const isSubnetworkParameterOutput = (
  subnetwork: SubGraphNodeDefinition,
  handle: string,
  definitionOf: NodeDefinitionLookup
): boolean => {
  if (!hasParameterFile(subnetwork.value)) return false
  const bindings = parameterBindings(
    asNetwork({ workflow: { nodes: { '0': subnetwork }, edges: {} } }),
    definitionOf
  )
  try {
    const source = bindings.outputPort({
      level: bindings.root,
      nodeId: '0',
      handle,
    })
    return bindings.parameterSource(source) !== null
  } catch {
    // An output the subnetwork does not have, or an exposure it lost.
    return false
  }
}

// ── Private helpers ──

/** One graph level: the top-level network or a subnetwork's content. */
type Level = {
  network: Network
  /** Qualified-id prefix of the level's nodes: `''` at the top, `'12_'` inside node 12. */
  prefix: string
  edges: Edge[]
  parent?: { level: Level; nodeId: string }
}

type NodePort = { level: Level; nodeId: string; handle: string }

type ParameterSource = NodePort & { exposure: ParameterExposure }

type Binding =
  | { kind: 'literal'; value: string }
  | ({ kind: 'parameter' } & ParameterSource)

type ParameterBindings = ReturnType<typeof parameterBindings>

/** How a subnetwork's editor handles map onto its rewritten interface. */
type SubnetworkRewrite = {
  node: SubGraphNodeDefinition
  /** New input handle, or null when the input was bound into a file. */
  inputHandle: (handle: string) => string | null
  outputHandle: (handle: string) => string
}

/**
 * Resolves the sources of exposed parameter inputs on the saved graph, across
 * subnetwork boundaries. Pure: reads no files.
 */
const parameterBindings = (
  network: Network,
  definitionOf: NodeDefinitionLookup
) => {
  const root = level(network, '')
  const children = new Map<string, Level>()
  const boundaries = new Map<Level, BoundaryAnalysis>()

  /** A subnetwork's content as a level. */
  const child = (parent: Level, nodeId: string): Level => {
    const prefix = `${parent.prefix}${nodeId}_`
    let found = children.get(prefix)
    if (!found) {
      const node = parent.network.workflow.nodes[
        nodeId
      ] as SubGraphNodeDefinition
      found = level(node.value, prefix, { level: parent, nodeId })
      children.set(prefix, found)
    }
    return found
  }

  /** A level's interface as the editor computes it, parameter ports included. */
  const boundary = (current: Level): BoundaryAnalysis => {
    let found = boundaries.get(current)
    if (!found) {
      found = analyzeNetworkBoundary(
        boundaryNodes(current.network, definitionOf),
        current.edges
      )
      boundaries.set(current, found)
    }
    return found
  }

  /**
   * The output port feeding an input port, following a free subnetwork input
   * up to the edge that feeds it in the parent. Null when not exactly one edge
   * feeds it.
   */
  const feedingPort = (port: NodePort): NodePort | null => {
    const incoming = port.level.edges.filter(
      (edge) => edge.target === port.nodeId && edge.targetHandle === port.handle
    )
    if (incoming.length === 1) {
      const [edge] = incoming
      return {
        level: port.level,
        nodeId: edge.source,
        handle: edge.sourceHandle as string,
      }
    }
    const parent = port.level.parent
    if (incoming.length > 1 || !parent) return null
    const index = boundary(port.level).internalHandleToNetworkInput[
      `${port.nodeId}::${port.handle}`
    ]
    if (index === undefined) return null
    return feedingPort({ ...parent, handle: `input-${index}` })
  }

  /** Follows an output of a subnetwork with parameter files down to the internal port producing it. */
  const outputPort = (port: NodePort): NodePort => {
    const node = port.level.network.workflow.nodes[port.nodeId]
    if (!isSubGraphNodeDefinition(node) || !hasParameterFile(node.value)) {
      return port
    }
    const content = child(port.level, port.nodeId)
    const internal =
      boundary(content).networkOutputToInternalHandle[
        handleIdToIndex(port.handle)
      ]
    if (!internal) {
      throw new Error(`Subnetwork ${node.name} has no output ${port.handle}`)
    }
    return outputPort({
      level: content,
      nodeId: internal.nodeId,
      handle: internal.handleId,
    })
  }

  /** The exposure behind a parameter output port, or null for any other port. */
  const parameterSource = (port: NodePort): ParameterSource | null => {
    const parsed = parameterHandlePath(port.handle)
    if (parsed?.direction !== 'output') return null
    const exposure = findParameterExposure(
      parameterOutputExposures(standardNode(port)),
      parsed.path
    )
    if (!exposure) {
      throw new Error(
        `Parameter ${parsed.path.join(' / ')} is not exposed on node ${nodeKey(port)}`
      )
    }
    return { ...port, exposure }
  }

  /** The value of a literal's output, or null for any other port. */
  const literalValue = (port: NodePort): string | null => {
    const node = port.level.network.workflow.nodes[port.nodeId]
    if (isSubGraphNodeDefinition(node) || port.handle !== 'output-0') {
      return null
    }
    const definition = definitionOf(node.type)
    if (
      (definition.node_type !== NodeType.ELEMENTARY_CONSTRUCTOR &&
        definition.node_type !== NodeType.PRIMITIVE) ||
      definition.outputs[0] !== SELF
    ) {
      return null
    }
    return String(node.value ?? definition.value ?? '')
  }

  /** The source of one exposed input of a parameter-file node. */
  const inputBinding = (
    port: NodePort,
    exposure: ParameterExposure
  ): Binding => {
    const feeding = feedingPort({
      ...port,
      handle: parameterHandle('input', exposure.path),
    })
    if (!feeding) {
      throw new Error(
        `Exposed parameter ${exposure.path.join(' / ')} on ${standardNode(port).value} requires exactly one input connection`
      )
    }
    const source = outputPort(feeding)
    const parameter = parameterSource(source)
    if (parameter) return { kind: 'parameter', ...parameter }
    const value = literalValue(source)
    if (value === null) {
      const { type } = source.level.network.workflow.nodes[source.nodeId]
      throw new Error(
        `Parameter inputs may only use frontend-known scalar values; node ${nodeKey(source)} (${type}) is computed at runtime`
      )
    }
    return { kind: 'literal', value }
  }

  /** Every parameter-file node, at every level. */
  const parameterNodes = (): NodePort[] => {
    const found: NodePort[] = []
    const visit = (current: Level) => {
      const { nodes } = current.network.workflow
      for (const [nodeId, node] of Object.entries(nodes)) {
        if (isSubGraphNodeDefinition(node)) {
          if (hasParameterFile(node.value)) visit(child(current, nodeId))
        } else if (node.parameter_file) {
          found.push({ level: current, nodeId, handle: '' })
        }
      }
    }
    visit(root)
    return found
  }

  /** Resolves every binding and rejects cycles between parameter files. */
  const validate = (): void => {
    const done = new Set<string>()
    const visit = (port: NodePort, stack: string[]) => {
      const key = nodeKey(port)
      if (stack.includes(key)) {
        throw new Error(
          `Cyclic parameter-file dependency: ${[...stack, key].join(' -> ')}`
        )
      }
      if (done.has(key)) return
      for (const exposure of parameterInputExposures(standardNode(port))) {
        const binding = inputBinding(port, exposure)
        if (binding.kind === 'parameter') visit(binding, [...stack, key])
      }
      done.add(key)
    }
    for (const port of parameterNodes()) visit(port, [])
  }

  return {
    root,
    child,
    boundary,
    outputPort,
    parameterSource,
    inputBinding,
    parameterNodes,
    validate,
  }
}

/**
 * Rewrites one level of the saved graph into what Coral runs, once every copy
 * is written. Subnetworks with parameter files are rewritten first, since the
 * level's edges into them depend on their new interface.
 */
const rewriteForCoral = (
  current: Level,
  context: {
    bindings: ParameterBindings
    definitionOf: NodeDefinitionLookup
    runCopyOf: (port: NodePort) => string
    valueOf: (source: ParameterSource) => string
  }
): {
  network: Network
  literals: Set<string>
  subnetworks: Map<string, SubnetworkRewrite>
} => {
  const { bindings } = context
  const nodes: LeanNodes = {}
  const subnetworks = new Map<string, SubnetworkRewrite>()
  for (const [nodeId, node] of Object.entries(current.network.workflow.nodes)) {
    if (isSubGraphNodeDefinition(node)) {
      if (hasParameterFile(node.value)) {
        const rewritten = rewriteSubnetwork(
          node,
          bindings.child(current, nodeId),
          context
        )
        subnetworks.set(nodeId, rewritten)
        nodes[nodeId] = rewritten.node
      } else {
        nodes[nodeId] = node
      }
    } else if (node.parameter_file) {
      const { parameter_file: _metadata, ...rest } = node
      nodes[nodeId] = {
        ...rest,
        value: context.runCopyOf({ level: current, nodeId, handle: '' }),
      }
    } else {
      nodes[nodeId] = node
    }
  }

  // A parameter output used by a backend node becomes a literal at this level.
  let nextId = Math.max(-1, ...Object.keys(nodes).map(Number)) + 1
  const literals = new Map<string, string>()
  const literalFor = (source: ParameterSource): string => {
    const key = `${nodeKey(source)}::${source.handle}`
    let id = literals.get(key)
    if (!id) {
      id = String(nextId++)
      literals.set(key, id)
      nodes[id] = {
        type: parameterPortCoralType(source.exposure.type),
        value: context.valueOf(source),
      }
    }
    return id
  }

  const edges: NetworkEdge[] = []
  for (const edge of current.edges) {
    let { source, sourceHandle } = edge as {
      source: string
      sourceHandle: string
    }
    let targetHandle: string | null = edge.targetHandle as string
    // A bound input is written into its file; the edge means nothing to Coral.
    if (parameterHandlePath(targetHandle)) continue
    const targetSubnetwork = subnetworks.get(edge.target)
    if (targetSubnetwork)
      targetHandle = targetSubnetwork.inputHandle(targetHandle)
    if (targetHandle === null) continue

    const parameter = bindings.parameterSource(
      bindings.outputPort({
        level: current,
        nodeId: source,
        handle: sourceHandle,
      })
    )
    if (parameter) {
      source = literalFor(parameter)
      sourceHandle = 'output-0'
    } else {
      const sourceSubnetwork = subnetworks.get(source)
      if (sourceSubnetwork)
        sourceHandle = sourceSubnetwork.outputHandle(sourceHandle)
    }
    edges.push({
      source: Number(source),
      source_output: handleIdToIndex(sourceHandle),
      target: Number(edge.target),
      target_input: handleIdToIndex(targetHandle),
    })
  }

  return {
    network: {
      ...current.network,
      workflow: { nodes, edges: Object.fromEntries(edges.entries()) },
    },
    literals: new Set(literals.values()),
    subnetworks,
  }
}

/**
 * Rewrites a subnetwork's content and recomputes its interface, which Coral
 * matches by position against the content's free ports. A parent handle is
 * remapped through the internal port it stands for, not by name and type.
 */
const rewriteSubnetwork = (
  node: SubGraphNodeDefinition,
  content: Level,
  context: Parameters<typeof rewriteForCoral>[1]
): SubnetworkRewrite => {
  const before = context.bindings.boundary(content)
  const { network, literals, subnetworks } = rewriteForCoral(content, context)
  const after = analyzeNetworkBoundary(
    boundaryNodes(network, context.definitionOf, literals),
    edgesFromProtocolToFlow(network.workflow.edges)
  )
  const newIndex = (map: Record<string, number>, key: string): number => {
    const index = map[key]
    if (index === undefined) {
      throw new Error(`Subnetwork ${node.name} lost its port ${key} at submit`)
    }
    return index
  }
  return {
    node: {
      ...node,
      arguments: after.argumentsArray,
      inputs: after.inputsArray,
      outputs: after.outputsArray,
      value: network,
    },
    inputHandle: (handle) => {
      const internal =
        before.networkInputToInternalHandle[handleIdToIndex(handle)]
      if (!internal || parameterHandlePath(internal.handleId)) return null
      const nested = subnetworks.get(internal.nodeId)
      const handleId = nested
        ? nested.inputHandle(internal.handleId)
        : internal.handleId
      if (handleId === null) return null
      return `input-${newIndex(after.internalHandleToNetworkInput, `${internal.nodeId}::${handleId}`)}`
    },
    // Parameter outputs never reach here: the caller turns them into literals.
    outputHandle: (handle) => {
      const internal =
        before.networkOutputToInternalHandle[handleIdToIndex(handle)]
      const nested = subnetworks.get(internal.nodeId)
      const handleId = nested
        ? nested.outputHandle(internal.handleId)
        : internal.handleId
      return `output-${newIndex(after.internalHandleToNetworkOutput, `${internal.nodeId}::${handleId}`)}`
    },
  }
}

const level = (
  network: Network,
  prefix: string,
  parent?: Level['parent']
): Level => ({
  network,
  prefix,
  edges: edgesFromProtocolToFlow(network.workflow.edges),
  parent,
})

const withoutTrailingSlash = (path: string): string =>
  path.replace(/[\\/]+$/, '')

const asNetwork = (graph: object): Network =>
  removeQualifiedIds(graph as Network | QualifiedNetwork)

const nodeKey = (port: { level: Level; nodeId: string }): string =>
  `${port.level.prefix}${port.nodeId}`

const standardNode = (port: { level: Level; nodeId: string }) =>
  port.level.network.workflow.nodes[port.nodeId] as LeanStandardNode &
    StandardNodeDefinition

/** Whether any node, at any depth, carries `parameter_file`. */
const hasParameterFile = (graph: object): boolean =>
  Object.values((graph as Network).workflow.nodes).some((node) =>
    isSubGraphNodeDefinition(node)
      ? hasParameterFile(node.value)
      : Boolean(node.parameter_file)
  )

/**
 * A level's nodes with their ports, as {@link analyzeNetworkBoundary} reads
 * them: standard nodes from the registry; subnetworks, and the literals added
 * by the rewrite, from the graph itself.
 */
const boundaryNodes = (
  network: Network,
  definitionOf: NodeDefinitionLookup,
  literals: Set<string> = new Set()
): Node[] =>
  Object.entries(network.workflow.nodes).map(([id, node]) => ({
    id,
    position: { x: 0, y: 0 },
    data: isSubGraphNodeDefinition(node)
      ? node
      : literals.has(id)
        ? { ...node, arguments: [], inputs: [], outputs: [SELF] }
        : { ...definitionOf(node.type), ...node },
  }))

const entryAt = (tree: ParameterTree, path: string[], file: string) => {
  const leaf = parameterAtPath(tree, path)
  if (!leaf) {
    throw new Error(`Parameter ${path.join(' / ')} is missing from ${file}`)
  }
  return leaf
}

const outputValue = (
  tree: ParameterTree,
  exposure: ParameterExposure
): string =>
  convertValue(
    entryAt(tree, exposure.path, 'its file').value,
    exposure.type,
    exposure.path
  )

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
