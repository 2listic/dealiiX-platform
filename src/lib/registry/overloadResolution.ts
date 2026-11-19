import type { Edge, Node } from '@xyflow/svelte'
import {
  ConnectionType,
  isOverloadNodeDefinition,
  isSubGraphNodeDefinition,
  isTypeCompatible,
  NodeType,
  SELF,
  Type,
  type Argument,
  getBaseTypes,
  type NodeDefinitions,
  type OverloadNodeDefinition,
  type StandardNodeDefinition,
  type SubGraphNodeDefinition,
} from '../types/nodeTypes'
import {
  parameterExposureForHandle,
  parameterPortCoralType,
} from '../utils/parameterPorts'
import {
  nodeClassSection,
  nodeOwnerDisplayName,
  nodePaletteKey,
} from './nodePalette'

export type OverloadStatus =
  | 'unresolved'
  | 'partially_constrained'
  | 'resolved'
  | 'invalid'

export type OverloadEdgeIssue = {
  edge: Edge
  message: string
}

export type OverloadResolution = {
  candidatesByNodeId: Record<string, StandardNodeDefinition[]>
  edgeIssues: OverloadEdgeIssue[]
}

/**
 * A family that does not narrow to exactly one variant, found while lowering
 * the canvas to concrete nodes. `detail` names the family and what to do, so
 * each caller can prefix it with the action that was refused.
 */
export class UnresolvedOverloadError extends Error {
  /**
   * @param detail - Family name, remaining variants and the fix.
   * @param action - The refused action, e.g. "Cannot leave the subnetwork".
   */
  constructor(
    readonly detail: string,
    action = 'Cannot export graph'
  ) {
    super(`${action}: ${detail}`)
    this.name = 'UnresolvedOverloadError'
  }
}

/**
 * Describes a family that has not narrowed to one variant. The variants are
 * listed by their `variant_name` only when all have one: registry types are
 * too long to read in a toast.
 *
 * @param name - The family node's name.
 * @param candidates - Its remaining candidates after graph resolution.
 * @returns The `detail` text of an {@link UnresolvedOverloadError}.
 */
export const unresolvedOverloadDetail = (
  name: string,
  candidates: StandardNodeDefinition[]
): string => {
  if (candidates.length === 0) {
    return `"${name}" has no compatible variant. Change its connections until one variant is left.`
  }
  const variantNames = candidates.map((candidate) =>
    candidate.variant_name?.trim()
  )
  const listed = variantNames.every(Boolean)
    ? ` (${variantNames.join(', ')})`
    : ''
  return `"${name}" has ${candidates.length} variants left${listed}. Connect it until one variant is left.`
}

/**
 * Rewords an {@link UnresolvedOverloadError} for the action that was refused;
 * any other error is returned unchanged.
 *
 * @param error - The caught error.
 * @param action - The refused action, e.g. "Cannot create the subnetwork".
 * @returns The reworded error, or `error` itself.
 */
export const withOverloadAction = (error: unknown, action: string): unknown =>
  error instanceof UnresolvedOverloadError
    ? new UnresolvedOverloadError(error.detail, action)
    : error

/**
 * Returns the concrete input types represented by a canvas node handle.
 * A family returns the union of its candidates; this is presentation and
 * connection-discovery metadata, never a wildcard used for compatibility.
 */
export const overloadInputTypes = (
  node: NodeDefinitions,
  handleIndex: number
): string[] => {
  if (isOverloadNodeDefinition(node)) {
    return unique(
      overloadCandidatesForNode(node).flatMap((candidate) =>
        definitionInputTypes(candidate, `input-${handleIndex}`)
      )
    )
  }
  return definitionInputTypes(node, `input-${handleIndex}`)
}

/** Returns the concrete output types represented by a canvas node handle. */
export const overloadOutputTypes = (
  node: NodeDefinitions,
  handleIndex: number,
  upstreamTypes: string[] = []
): string[] => {
  if (isOverloadNodeDefinition(node)) {
    return unique(
      overloadCandidatesForNode(node).flatMap((candidate) =>
        definitionOutputTypesForHandle(
          candidate,
          `output-${handleIndex}`,
          upstreamTypes
        )
      )
    )
  }
  return definitionOutputTypesForHandle(
    node,
    `output-${handleIndex}`,
    upstreamTypes
  )
}

/**
 * Returns the candidates currently exposed by a family.
 *
 * Finalization is an editor-level lock: it keeps the full candidate list for
 * reopening the family, but exposes only the selected concrete definition to
 * connection discovery, resolution, and subnetwork boundary analysis.
 *
 * @param node - Frontend overload family.
 * @returns The candidates active for the current editor state.
 */
export const overloadCandidatesForNode = (
  node: OverloadNodeDefinition
): StandardNodeDefinition[] => {
  if (!node.finalized || !node.finalized_candidate_type) {
    return node.candidates
  }
  return node.candidates.filter(
    (candidate) => candidate.type === node.finalized_candidate_type
  )
}

export type OverloadNodeInterface = Pick<
  OverloadNodeDefinition,
  'arguments' | 'inputs' | 'outputs'
>

/**
 * Builds the visible socket interface for one or more concrete candidates.
 *
 * @param candidates - Concrete definitions represented by the interface.
 * @returns A cloned concrete interface for one candidate, or the union interface for a family.
 */
export const overloadInterfaceForCandidates = (
  candidates: StandardNodeDefinition[]
): OverloadNodeInterface => {
  if (candidates.length === 1) {
    const candidate = candidates[0]
    return {
      arguments: candidate.arguments.map((argument) => ({ ...argument })),
      inputs: [...candidate.inputs],
      outputs: [...candidate.outputs],
    }
  }

  const maxArguments = Math.max(
    0,
    ...candidates.map((candidate) => candidate.arguments.length)
  )
  const argumentsArray = Array.from({ length: maxArguments }, (_, index) =>
    syntheticArgument(candidates, index)
  )
  return {
    arguments: argumentsArray,
    inputs: interfaceArgumentIndexes(candidates, 'inputs'),
    outputs: interfaceArgumentIndexes(candidates, 'outputs'),
  }
}

/**
 * Builds one frontend-only family from two or more concrete definitions that
 * share a {@link nodePaletteKey}. The family is labelled with its
 * `overload_group` when the registry sets one, else with the first
 * candidate's {@link nodeOwnerDisplayName}, which is also each candidate's
 * own label.
 *
 * @param candidates - The concrete definitions of the family.
 * @returns The family definition.
 * @throws {Error} When fewer than two candidates are given.
 */
export const createOverloadNodeDefinition = (
  candidates: StandardNodeDefinition[]
): OverloadNodeDefinition => {
  if (candidates.length < 2) {
    throw new Error('An overload family requires at least two candidates')
  }
  const group = nodePaletteKey(candidates[0])

  return {
    type: `frontend::overload<${group}>`,
    ...overloadInterfaceForCandidates(candidates),
    node_type: NodeType.OVERLOAD,
    overload_group: group,
    display_name:
      candidates[0].overload_group?.trim() ||
      nodeOwnerDisplayName(candidates[0]),
    candidates,
    is_valid: true,
  }
}

/**
 * Replaces the registry entries that share a {@link nodePaletteKey} with one
 * family, keeping the order of first appearance; an entry alone under its key
 * stays concrete. Coral's plain-name copies of signature-keyed free functions
 * are dropped, so new nodes use the signature key.
 *
 * @param nodes - Concrete registry definitions.
 * @returns Families and single concrete entries.
 */
export const createOverloadFamilies = (
  nodes: StandardNodeDefinition[]
): (StandardNodeDefinition | OverloadNodeDefinition)[] => {
  const families = new Map<string, StandardNodeDefinition[]>()
  for (const node of dropLegacyFunctionNames(nodes)) {
    const key = nodePaletteKey(node)
    families.set(key, [...(families.get(key) ?? []), node])
  }
  return [...families.values()].map((candidates) =>
    candidates.length > 1
      ? createOverloadNodeDefinition(candidates)
      : candidates[0]
  )
}

/** One draggable sidebar tile: a concrete registry entry or a family. */
export type NodePaletteTile = {
  label: string
  node: StandardNodeDefinition | OverloadNodeDefinition
}

/** A sidebar entry: a tile on its own, or a class section with its tiles. */
export type NodePaletteItem =
  | { kind: 'tile'; key: string; tile: NodePaletteTile }
  | { kind: 'class'; key: string; label: string; tiles: NodePaletteTile[] }

/**
 * Builds the sidebar from registry entries: the families of
 * {@link createOverloadFamilies}, each listed under the class section of
 * {@link nodeClassSection}, or on its own when it has no class. Sections
 * appear where their first member would.
 *
 * @param nodes - Concrete registry definitions, already filtered.
 * @returns Sidebar entries in registry order.
 */
export const buildNodePalette = (
  nodes: StandardNodeDefinition[]
): NodePaletteItem[] => {
  const items: NodePaletteItem[] = []
  const sections = new Map<string, NodePaletteTile[]>()

  for (const node of createOverloadFamilies(nodes)) {
    const representative = isOverloadNodeDefinition(node)
      ? node.candidates[0]
      : node
    const tile: NodePaletteTile = {
      label: isOverloadNodeDefinition(node)
        ? node.display_name
        : nodeOwnerDisplayName(node),
      node,
    }
    const section = nodeClassSection(representative)
    if (!section) {
      items.push({ kind: 'tile', key: node.type, tile })
      continue
    }
    const tiles = sections.get(section.key)
    if (tiles) {
      tiles.push(tile)
      continue
    }
    sections.set(section.key, [tile])
    items.push({
      kind: 'class',
      key: section.key,
      label: section.label,
      tiles: sections.get(section.key)!,
    })
  }

  return items
}

/**
 * Narrows every family on a canvas graph to the variants its edges allow.
 *
 * Each node starts with its possible definitions: a family's variants (only
 * the chosen one once finalized), or the node itself. Each pass keeps, on
 * every family, the variants that fit some definition on the other end of
 * each of its edges, and repeats until nothing changes; a narrowed family can
 * narrow its neighbours in turn.
 *
 * Every edge is checked against concrete variant pairs, so a family never
 * stands for a wildcard type.
 *
 * @param nodes - Canvas nodes (snapshots, not reactive).
 * @param edges - Canvas edges between them.
 * @returns For each family, its remaining variants (none when its edges fit
 *   no variant); and the edges whose ends have no fitting pair left.
 */
export const resolveOverloadGraph = (
  nodes: Node<NodeDefinitions>[],
  edges: Edge[]
): OverloadResolution => {
  const nodesById = new Map(nodes.map((node) => [node.id, node.data]))
  // Concrete nodes and subnetworks keep their one definition throughout.
  const states = new Map<string, ConcreteNodeDefinition[]>()
  for (const node of nodes) {
    states.set(
      node.id,
      isOverloadNodeDefinition(node.data)
        ? [...overloadCandidatesForNode(node.data)]
        : [node.data]
    )
  }

  // A safety cap: as sets only shrink, the loop stops long before it.
  const maxIterations = Math.max(
    1,
    nodes.length * Math.max(1, edges.length) + 1
  )
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    // Edges read `states` and write `next`, so every edge of a pass sees the
    // same sets, whatever the edge order.
    const next = new Map(
      [...states.entries()].map(([nodeId, candidates]) => [
        nodeId,
        [...candidates],
      ])
    )

    // A family with several edges keeps the intersection of what each allows.
    for (const edge of edges) {
      const pairs = compatibleCandidatePairs(edge, states, nodesById, edges)
      const sourceNode = nodesById.get(edge.source)
      const targetNode = nodesById.get(edge.target)
      if (!sourceNode || !targetNode) continue

      if (isOverloadNodeDefinition(sourceNode)) {
        next.set(
          edge.source,
          intersectCandidates(next.get(edge.source) ?? [], pairs.source)
        )
      }
      if (isOverloadNodeDefinition(targetNode)) {
        next.set(
          edge.target,
          intersectCandidates(next.get(edge.target) ?? [], pairs.target)
        )
      }
    }

    let changed = false
    for (const [nodeId, candidates] of next) {
      if (!sameCandidates(states.get(nodeId) ?? [], candidates)) {
        changed = true
        break
      }
    }
    for (const [nodeId, candidates] of next) states.set(nodeId, candidates)
    if (!changed) break
  }

  // With the sets settled, an edge with no fitting pair is reported, also when
  // both of its ends are concrete.
  const edgeIssues: OverloadEdgeIssue[] = []
  for (const edge of edges) {
    const pairs = compatibleCandidatePairs(edge, states, nodesById, edges)
    if (pairs.source.length === 0 || pairs.target.length === 0) {
      edgeIssues.push({
        edge,
        message: `No compatible overload candidates remain for edge ${edge.id ?? `${edge.source}->${edge.target}`}`,
      })
    }
  }

  // Only families are returned; their variants are never subnetworks.
  const candidatesByNodeId: Record<string, StandardNodeDefinition[]> = {}
  for (const node of nodes) {
    if (isOverloadNodeDefinition(node.data)) {
      candidatesByNodeId[node.id] = (states.get(node.id) ?? []).filter(
        (candidate): candidate is StandardNodeDefinition =>
          candidate.node_type !== NodeType.NETWORK
      )
    }
  }
  return { candidatesByNodeId, edgeIssues }
}

/**
 * Replaces every family on a canvas graph with its one remaining variant, so
 * what follows (serialization, subnetwork boundaries) sees concrete nodes
 * only. The family node keeps its id, position, `name`, `value` and
 * `parameter_file`; its ports, type and output type become the variant's.
 *
 * @param nodes - Canvas nodes (snapshots, not reactive).
 * @param edges - Canvas edges between them.
 * @returns The same nodes, or the input array itself when it holds no family.
 * @throws {UnresolvedOverloadError} If a family has more or fewer than one
 *   variant left, or an edge on a family fits none of its variants.
 */
export const lowerOverloadFamilies = (nodes: Node[], edges: Edge[]): Node[] => {
  if (
    !nodes.some((node) =>
      isOverloadNodeDefinition(node.data as NodeDefinitions)
    )
  )
    return nodes

  const resolution = resolveOverloadGraph(
    nodes as Node<NodeDefinitions>[],
    edges
  )
  const familyIds = new Set(
    nodes
      .filter((node) => isOverloadNodeDefinition(node.data as NodeDefinitions))
      .map((node) => node.id)
  )

  for (const node of nodes) {
    if (!familyIds.has(node.id)) continue
    const family = node.data as OverloadNodeDefinition
    const candidates = resolution.candidatesByNodeId[node.id] ?? []
    if (candidates.length !== 1) {
      throw new UnresolvedOverloadError(
        unresolvedOverloadDetail(family.name ?? family.display_name, candidates)
      )
    }
  }

  const edgeIssue = resolution.edgeIssues.find(
    (issue) =>
      familyIds.has(issue.edge.source) || familyIds.has(issue.edge.target)
  )
  if (edgeIssue) throw new UnresolvedOverloadError(edgeIssue.message)

  return nodes.map((node) =>
    familyIds.has(node.id)
      ? {
          ...node,
          data: concreteFamilyData(
            node.data as OverloadNodeDefinition,
            resolution.candidatesByNodeId[node.id][0]
          ),
        }
      : node
  )
}

/** Returns the current UI state for a family after graph propagation. */
export const overloadStatus = (
  family: OverloadNodeDefinition,
  candidates: StandardNodeDefinition[]
): OverloadStatus => {
  if (candidates.length === 0) return 'invalid'
  if (candidates.length === 1) return 'resolved'
  if (candidates.length < family.candidates.length)
    return 'partially_constrained'
  return 'unresolved'
}

// ── Private helpers ──

type ConcreteNodeDefinition = StandardNodeDefinition | SubGraphNodeDefinition

const unique = (values: string[]): string[] => [...new Set(values)]

/**
 * Removes the plain-name copies Coral adds to its registry for free functions
 * with one signature: the function's key is `<name>::std::function<…>`, and
 * the plain `<name>` only keeps graphs saved before signature keys loading.
 */
const dropLegacyFunctionNames = (
  nodes: StandardNodeDefinition[]
): StandardNodeDefinition[] => {
  const marker = '::std::function<'
  const signatureKeyedNames = new Set(
    nodes.flatMap((node) => {
      const index = node.type.indexOf(marker)
      return index > 0 ? [node.type.slice(0, index)] : []
    })
  )
  return nodes.filter((node) => !signatureKeyedNames.has(node.type))
}

const definitionInputArgument = (
  definition: ConcreteNodeDefinition,
  handleIndex: number
): Argument | null => {
  const argumentIndex = definition.inputs?.[handleIndex]
  return argumentIndex == null
    ? null
    : (definition.arguments?.[argumentIndex] ?? null)
}

const definitionOutputIndex = (
  definition: ConcreteNodeDefinition,
  handleIndex: number
): number | null => definition.outputs?.[handleIndex] ?? null

const definitionOutputTypes = (
  definition: ConcreteNodeDefinition,
  handleIndex: number,
  upstreamTypes: string[] = []
): string[] => {
  const outputIndex = definitionOutputIndex(definition, handleIndex)
  if (outputIndex == null) return []

  if (outputIndex === SELF) {
    if (isSubGraphNodeDefinition(definition)) return [definition.type]
    if (definition.output_type)
      return unique([...getBaseTypes(definition), definition.output_type])
    return unique([...getBaseTypes(definition), definition.type])
  }

  const argument = definition.arguments?.[outputIndex]
  if (!argument) return []
  return unique(
    argument.connection_type === ConnectionType.PASSTHROUGH
      ? [...getBaseTypes(argument), argument.type, ...upstreamTypes]
      : [...getBaseTypes(argument), argument.type]
  )
}

const definitionInputTypes = (
  definition: ConcreteNodeDefinition,
  handleId: string
): string[] => {
  if (!isSubGraphNodeDefinition(definition)) {
    const parameter = parameterExposureForHandle(definition, handleId, 'input')
    if (parameter) return [parameterPortCoralType(parameter.type)]
  }

  const match = handleId.match(/^input-(\d+)$/)
  if (!match) return []
  const argument = definitionInputArgument(definition, Number(match[1]))
  return argument ? [argument.type] : []
}

const definitionOutputTypesForHandle = (
  definition: ConcreteNodeDefinition,
  handleId: string,
  upstreamTypes: string[] = []
): string[] => {
  if (!isSubGraphNodeDefinition(definition)) {
    const parameter = parameterExposureForHandle(definition, handleId, 'output')
    if (parameter) return [parameterPortCoralType(parameter.type)]
  }

  const match = handleId.match(/^output-(\d+)$/)
  if (!match) return []
  return definitionOutputTypes(definition, Number(match[1]), upstreamTypes)
}

const syntheticArgument = (
  candidates: StandardNodeDefinition[],
  index: number
): Argument => {
  const argumentsAtIndex = candidates
    .map((candidate) => candidate.arguments[index])
    .filter((argument): argument is Argument => Boolean(argument))
  const first = argumentsAtIndex[0]
  const types = unique(argumentsAtIndex.map((argument) => argument.type))
  const names = unique(argumentsAtIndex.map((argument) => argument.name))
  return {
    connection_type: first?.connection_type ?? ConnectionType.OUTPUT,
    name: names.join(' / ') || `port ${index}`,
    type: (types.join(' | ') || 'unavailable') as Type,
  }
}

const maxHandleCount = (
  candidates: StandardNodeDefinition[],
  direction: 'inputs' | 'outputs'
): number =>
  Math.max(0, ...candidates.map((candidate) => candidate[direction].length))

const interfaceArgumentIndexes = (
  candidates: StandardNodeDefinition[],
  direction: 'inputs' | 'outputs'
): number[] => {
  const count = maxHandleCount(candidates, direction)
  return Array.from({ length: count }, (_, handleIndex) => {
    const argumentIndex = candidates
      .map((candidate) => candidate[direction][handleIndex])
      .find((index) => index != null)
    return argumentIndex ?? 0
  })
}

const nodeCandidates = (
  node: NodeDefinitions,
  states: Map<string, ConcreteNodeDefinition[]>,
  nodeId: string
): ConcreteNodeDefinition[] =>
  states.get(nodeId) ??
  (isOverloadNodeDefinition(node) ? overloadCandidatesForNode(node) : [node])

/**
 * Returns the handle id an edge uses at one of its ends: `output-<n>` or a
 * parameter output at the source, `input-<n>` or a parameter input at the
 * target.
 *
 * @param edge - Canvas edge.
 * @param direction - The end to read: `'source'` or `'target'`.
 * @returns The edge's handle id at that end, or the node's first handle
 *   (`output-0` / `input-0`) when the edge has none.
 */
const nodeHandle = (edge: Edge, direction: 'source' | 'target'): string => {
  const handle = direction === 'source' ? edge.sourceHandle : edge.targetHandle
  return handle || `${direction === 'source' ? 'output' : 'input'}-0`
}

/**
 * Output types of one variant's handle; for a passthrough output, also the
 * types of what arrives at the matching input, followed upstream. `resolving`
 * holds the handles already on the path, so a cycle stops there.
 */
const outputTypesForNodeCandidate = (
  nodeId: string,
  candidate: ConcreteNodeDefinition,
  handleId: string,
  states: Map<string, ConcreteNodeDefinition[]>,
  nodesById: Map<string, NodeDefinitions>,
  edges: Edge[],
  resolving: Set<string>
): string[] => {
  const key = `${nodeId}:${candidate.type}:${handleId}`
  if (resolving.has(key)) {
    return definitionOutputTypesForHandle(candidate, handleId)
  }

  const outputIndexMatch = handleId.match(/^output-(\d+)$/)
  if (!outputIndexMatch)
    return definitionOutputTypesForHandle(candidate, handleId)
  const outputIndex = Number(outputIndexMatch[1])
  const argumentIndex = candidate.outputs?.[outputIndex]
  let upstreamTypes: string[] = []
  if (argumentIndex != null && argumentIndex !== SELF) {
    const argument = candidate.arguments?.[argumentIndex]
    if (argument?.connection_type === ConnectionType.PASSTHROUGH) {
      const inputIndex = candidate.inputs?.indexOf(argumentIndex) ?? -1
      const incoming = edges.find(
        (edge) =>
          edge.target === nodeId &&
          nodeHandle(edge, 'target') === `input-${inputIndex}`
      )
      if (incoming) {
        const upstreamNode = nodesById.get(incoming.source)
        if (upstreamNode) {
          upstreamTypes = nodeCandidates(
            upstreamNode,
            states,
            incoming.source
          ).flatMap((upstreamCandidate) =>
            outputTypesForNodeCandidate(
              incoming.source,
              upstreamCandidate,
              nodeHandle(incoming, 'source'),
              states,
              nodesById,
              edges,
              new Set(resolving).add(key)
            )
          )
        }
      }
    }
  }
  return definitionOutputTypes(candidate, outputIndex, upstreamTypes)
}

/**
 * The definitions on each end of an edge that fit at least one definition on
 * the other end, from the sets in `states`.
 */
const compatibleCandidatePairs = (
  edge: Edge,
  states: Map<string, ConcreteNodeDefinition[]>,
  nodesById: Map<string, NodeDefinitions>,
  edges: Edge[]
): { source: ConcreteNodeDefinition[]; target: ConcreteNodeDefinition[] } => {
  const sourceNode = nodesById.get(edge.source)
  const targetNode = nodesById.get(edge.target)
  if (!sourceNode || !targetNode) return { source: [], target: [] }

  const sourceCandidates = nodeCandidates(sourceNode, states, edge.source)
  const targetCandidates = nodeCandidates(targetNode, states, edge.target)
  const sourceHandle = nodeHandle(edge, 'source')
  const targetHandle = nodeHandle(edge, 'target')
  const source = new Set<ConcreteNodeDefinition>()
  const target = new Set<ConcreteNodeDefinition>()

  for (const sourceCandidate of sourceCandidates) {
    const sourceTypes = outputTypesForNodeCandidate(
      edge.source,
      sourceCandidate,
      sourceHandle,
      states,
      nodesById,
      edges,
      new Set()
    )
    for (const targetCandidate of targetCandidates) {
      const targetTypes = definitionInputTypes(targetCandidate, targetHandle)
      if (
        sourceTypes.some((sourceType) =>
          targetTypes.some((targetType) =>
            isTypeCompatible(sourceType, targetType)
          )
        )
      ) {
        source.add(sourceCandidate)
        target.add(targetCandidate)
      }
    }
  }

  return { source: [...source], target: [...target] }
}

const sameCandidates = (
  left: ConcreteNodeDefinition[],
  right: ConcreteNodeDefinition[]
): boolean =>
  left.length === right.length &&
  left.every((candidate, index) => candidate.type === right[index]?.type)

const intersectCandidates = (
  current: ConcreteNodeDefinition[],
  allowed: ConcreteNodeDefinition[]
): ConcreteNodeDefinition[] => {
  const allowedTypes = new Set(allowed.map((candidate) => candidate.type))
  return current.filter((candidate) => allowedTypes.has(candidate.type))
}

/**
 * A family's resolved variant, carrying the per-node fields the family holds.
 * @param family - The family node's data.
 * @param candidate - Its one remaining variant.
 * @returns Concrete node data.
 */
const concreteFamilyData = (
  family: OverloadNodeDefinition,
  candidate: StandardNodeDefinition
): StandardNodeDefinition => {
  // Literal and parameter-file fields are set on the canvas node, outside the family type.
  const own = family as OverloadNodeDefinition &
    Pick<StandardNodeDefinition, 'value' | 'parameter_file'>
  return {
    ...candidate,
    ...(own.name !== undefined && { name: own.name }),
    ...(own.value !== undefined && { value: own.value }),
    ...(own.parameter_file && { parameter_file: own.parameter_file }),
  }
}
