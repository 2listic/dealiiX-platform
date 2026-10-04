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
  type NodeDefinitions,
  type OverloadNodeDefinition,
  type StandardNodeDefinition,
  type SubGraphNodeDefinition,
} from '../types/nodeTypes'
import {
  parameterExposureForHandle,
  parameterPortCoralType,
} from './parameterPorts'

type ConcreteNodeDefinition = StandardNodeDefinition | SubGraphNodeDefinition

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

/** Returns the explicit metadata key used to form an overload family. */
export const overloadGroupKey = (
  node: Pick<StandardNodeDefinition, 'overload_group' | 'operation'>
): string | undefined =>
  node.overload_group?.trim() || node.operation?.trim() || undefined

const unique = (values: string[]): string[] => [...new Set(values)]

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
    if (definition.output_type) return [definition.output_type]
    if (definition.base) return unique([definition.base, definition.type])
    return [definition.type]
  }

  const argument = definition.arguments?.[outputIndex]
  if (!argument) return []
  return unique(
    argument.connection_type === ConnectionType.PASSTHROUGH
      ? [argument.type, ...upstreamTypes]
      : [argument.type]
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
      node.candidates.flatMap((candidate) =>
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
      node.candidates.flatMap((candidate) =>
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

/** Builds one frontend-only family from two or more concrete definitions. */
export const createOverloadNodeDefinition = (
  candidates: StandardNodeDefinition[]
): OverloadNodeDefinition => {
  if (candidates.length < 2) {
    throw new Error('An overload family requires at least two candidates')
  }
  const group = overloadGroupKey(candidates[0])
  if (!group) throw new Error('An overload family requires explicit metadata')

  const maxArguments = Math.max(
    0,
    ...candidates.map((candidate) => candidate.arguments.length)
  )
  const argumentsArray = Array.from({ length: maxArguments }, (_, index) =>
    syntheticArgument(candidates, index)
  )
  const inputs = interfaceArgumentIndexes(candidates, 'inputs')
  const outputs = interfaceArgumentIndexes(candidates, 'outputs')
  const explicitGroup = candidates[0].overload_group?.trim()

  return {
    type: `frontend::overload<${group}>`,
    arguments: argumentsArray,
    inputs,
    outputs,
    node_type: NodeType.OVERLOAD,
    overload_group: group,
    display_name:
      explicitGroup ||
      candidates[0].display_name?.trim() ||
      candidates[0].operation?.trim() ||
      group,
    candidates,
    is_valid: true,
  }
}

/** Replaces explicitly grouped registry entries with one family tile. */
export const createOverloadFamilies = (
  nodes: StandardNodeDefinition[]
): NodeDefinitions[] => {
  const grouped = new Map<string, StandardNodeDefinition[]>()
  for (const node of nodes) {
    const key = overloadGroupKey(node)
    if (!key) continue
    grouped.set(key, [...(grouped.get(key) ?? []), node])
  }

  const emitted = new Set<string>()
  const result: NodeDefinitions[] = []
  for (const node of nodes) {
    const key = overloadGroupKey(node)
    const candidates = key ? grouped.get(key) : undefined
    if (!key || !candidates || candidates.length < 2) {
      result.push(node)
      continue
    }
    if (!emitted.has(key)) {
      result.push(createOverloadNodeDefinition(candidates))
      emitted.add(key)
    }
  }
  return result
}

const nodeCandidates = (
  node: NodeDefinitions,
  states: Map<string, ConcreteNodeDefinition[]>,
  nodeId: string
): ConcreteNodeDefinition[] =>
  states.get(nodeId) ??
  (isOverloadNodeDefinition(node) ? node.candidates : [node])

const nodeHandle = (edge: Edge, direction: 'source' | 'target'): string => {
  const handle = direction === 'source' ? edge.sourceHandle : edge.targetHandle
  if (handle) return handle
  const index = direction === 'source' ? edge.sourceHandle : edge.targetHandle
  return `${direction === 'source' ? 'output' : 'input'}-${index ?? 0}`
}

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
 * Propagates all edge constraints until no overload candidate set changes.
 * Every edge is checked against concrete candidate pairs, so no wildcard type
 * is introduced to represent a family.
 */
export const resolveOverloadGraph = (
  nodes: Node<NodeDefinitions>[],
  edges: Edge[]
): OverloadResolution => {
  const nodesById = new Map(nodes.map((node) => [node.id, node.data]))
  const states = new Map<string, ConcreteNodeDefinition[]>()
  for (const node of nodes) {
    states.set(
      node.id,
      isOverloadNodeDefinition(node.data)
        ? [...node.data.candidates]
        : [node.data]
    )
  }

  const maxIterations = Math.max(
    1,
    nodes.length * Math.max(1, edges.length) + 1
  )
  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const next = new Map(
      [...states.entries()].map(([nodeId, candidates]) => [
        nodeId,
        [...candidates],
      ])
    )

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

export const overloadCandidateSignatures = (
  candidates: StandardNodeDefinition[]
): string[] => candidates.map((candidate) => candidate.type)
