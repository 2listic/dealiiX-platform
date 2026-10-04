import { describe, expect, it } from 'vitest'
import type { Edge, Node } from '@xyflow/svelte'
import {
  ConnectionType,
  isOverloadNodeDefinition,
  NodeType,
  Type,
  type NodeDefinitions,
  type StandardNodeDefinition,
} from '../types/nodeTypes'
import {
  createOverloadFamilies,
  createOverloadNodeDefinition,
  overloadInputTypes,
  overloadInterfaceForCandidates,
  overloadStatus,
  resolveOverloadGraph,
} from './overloadResolution'
import { parseGraphToProtocol } from './graphParser'

const definition = (
  type: string,
  inputTypes: string[],
  outputType: string,
  operation: string,
  overloadGroup?: string
): StandardNodeDefinition => ({
  type,
  operation,
  ...(overloadGroup ? { overload_group: overloadGroup } : {}),
  display_name: operation,
  arguments: inputTypes.map((inputType, index) => ({
    connection_type: ConnectionType.INPUT,
    name: `input ${index}`,
    type: inputType as Type,
  })),
  inputs: inputTypes.map((_, index) => index),
  outputs: [-1],
  output_type: outputType,
  node_type: NodeType.FUNCTION,
})

const node = (id: string, data: NodeDefinitions): Node<NodeDefinitions> => ({
  id,
  type: data.node_type,
  data,
  position: { x: 0, y: 0 },
})

const edge = (
  id: string,
  source: string,
  target: string,
  targetHandle = 'input-0',
  sourceHandle = 'output-0'
): Edge => ({ id, source, target, sourceHandle, targetHandle })

describe('overload families', () => {
  const scalarGradient = definition(
    'gradient<scalar>',
    ['ScalarField'],
    'ScalarGradient',
    'gradient'
  )
  const vectorGradient = definition(
    'gradient<vector>',
    ['VectorField'],
    'VectorGradient',
    'gradient'
  )

  it('builds one family from explicit registry metadata and keeps concrete entries', () => {
    const fieldGradient = definition(
      'gradient<field>',
      ['ScalarField'],
      'ScalarGradient',
      'Field gradient',
      'Gradient'
    )
    const testGradient = definition(
      'gradient<test>',
      ['TestScalarField'],
      'TestScalarGradient',
      'Test gradient',
      'Gradient'
    )
    const entries = createOverloadFamilies([
      fieldGradient,
      testGradient,
      definition('standalone', [], 'Standalone', 'standalone'),
    ])

    expect(entries).toHaveLength(2)
    expect(entries[0].node_type).toBe(NodeType.OVERLOAD)
    if (!isOverloadNodeDefinition(entries[0])) return
    expect(entries[0].candidates.map((candidate) => candidate.type)).toEqual([
      'gradient<field>',
      'gradient<test>',
    ])
    expect(entries[0].display_name).toBe('Gradient')
  })

  it('filters candidates from an input connection', () => {
    const family = createOverloadNodeDefinition([
      scalarGradient,
      vectorGradient,
    ])
    const graph = [
      node('field', definition('field', [], 'ScalarField', 'field')),
      node('gradient', family),
    ]
    const result = resolveOverloadGraph(graph, [edge('e', 'field', 'gradient')])

    expect(
      result.candidatesByNodeId.gradient.map((candidate) => candidate.type)
    ).toEqual(['gradient<scalar>'])
    expect(overloadStatus(family, result.candidatesByNodeId.gradient)).toBe(
      'resolved'
    )
  })

  it('filters candidates from an output connection', () => {
    const family = createOverloadNodeDefinition([
      scalarGradient,
      vectorGradient,
    ])
    const graph = [
      node('gradient', family),
      node(
        'consumer',
        definition('consumer', ['VectorGradient'], 'Done', 'consumer')
      ),
    ]
    const result = resolveOverloadGraph(graph, [
      edge('e', 'gradient', 'consumer'),
    ])

    expect(
      result.candidatesByNodeId.gradient.map((candidate) => candidate.type)
    ).toEqual(['gradient<vector>'])
  })

  it('propagates constraints through a chain of overload nodes', () => {
    const testFamily = createOverloadNodeDefinition([
      definition('test<scalar>', ['ScalarField'], 'TestScalarField', 'test'),
      definition('test<vector>', ['VectorField'], 'TestVectorField', 'test'),
    ])
    const gradientFamily = createOverloadNodeDefinition([
      definition(
        'gradient<field-scalar>',
        ['ScalarField'],
        'ScalarGradient',
        'gradient'
      ),
      definition(
        'gradient<test-scalar>',
        ['TestScalarField'],
        'TestScalarGradient',
        'gradient'
      ),
      definition(
        'gradient<vector>',
        ['VectorField'],
        'VectorGradient',
        'gradient'
      ),
      definition(
        'gradient<test-vector>',
        ['TestVectorField'],
        'TestVectorGradient',
        'gradient'
      ),
    ])
    const weakFamily = createOverloadNodeDefinition([
      definition(
        'weak<scalar>',
        ['ScalarGradient', 'TestScalarGradient'],
        'ScalarWeakTerm',
        'weak'
      ),
      definition(
        'weak<vector>',
        ['VectorGradient', 'TestVectorGradient'],
        'VectorWeakTerm',
        'weak'
      ),
    ])
    const graph = [
      node('field', definition('field', [], 'ScalarField', 'field')),
      node('test', testFamily),
      node('gradient-field', gradientFamily),
      node('gradient-test', gradientFamily),
      node('weak', weakFamily),
    ]
    const result = resolveOverloadGraph(graph, [
      edge('field-test', 'field', 'test'),
      edge('test-gradient', 'test', 'gradient-test'),
      edge('field-gradient', 'field', 'gradient-field'),
      edge('gradient-field-weak', 'gradient-field', 'weak', 'input-0'),
      edge('gradient-test-weak', 'gradient-test', 'weak', 'input-1'),
    ])

    expect(
      result.candidatesByNodeId.test.map((candidate) => candidate.type)
    ).toEqual(['test<scalar>'])
    expect(
      result.candidatesByNodeId['gradient-test'].map(
        (candidate) => candidate.type
      )
    ).toEqual(['gradient<test-scalar>'])
    expect(
      result.candidatesByNodeId['gradient-field'].map(
        (candidate) => candidate.type
      )
    ).toEqual(['gradient<field-scalar>'])
    expect(
      result.candidatesByNodeId.weak.map((candidate) => candidate.type)
    ).toEqual(['weak<scalar>'])
  })

  it('reports an incompatible connection as an empty family', () => {
    const family = createOverloadNodeDefinition([
      scalarGradient,
      vectorGradient,
    ])
    const graph = [
      node('field', definition('field', [], 'TensorField', 'field')),
      node('gradient', family),
    ]
    const result = resolveOverloadGraph(graph, [edge('e', 'field', 'gradient')])

    expect(result.candidatesByNodeId.gradient).toEqual([])
    expect(result.edgeIssues).toHaveLength(1)
  })

  it('re-expands the family after its constraining edge is disconnected', () => {
    const family = createOverloadNodeDefinition([
      scalarGradient,
      vectorGradient,
    ])
    const graph = [
      node('field', definition('field', [], 'ScalarField', 'field')),
      node('gradient', family),
    ]
    const connected = resolveOverloadGraph(graph, [
      edge('e', 'field', 'gradient'),
    ])
    const disconnected = resolveOverloadGraph(graph, [])

    expect(connected.candidatesByNodeId.gradient).toHaveLength(1)
    expect(disconnected.candidatesByNodeId.gradient).toHaveLength(2)
    expect(
      overloadStatus(family, disconnected.candidatesByNodeId.gradient)
    ).toBe('unresolved')
  })

  it('finalizes one candidate and hides its alternate socket interface', () => {
    const twoArgumentGradient = definition(
      'gradient<with-label>',
      ['ScalarField', 'std::string'],
      'ScalarGradient',
      'gradient'
    )
    const family = createOverloadNodeDefinition([
      scalarGradient,
      twoArgumentGradient,
    ])
    const finalized = {
      ...family,
      ...overloadInterfaceForCandidates([scalarGradient]),
      finalized: true,
      finalized_candidate_type: scalarGradient.type,
    }
    const result = resolveOverloadGraph([node('gradient', finalized)], [])

    expect(
      result.candidatesByNodeId.gradient.map((candidate) => candidate.type)
    ).toEqual([scalarGradient.type])
    expect(finalized.inputs).toEqual(scalarGradient.inputs)
    expect(overloadInputTypes(finalized, 1)).toEqual([])
  })

  it('lowers a resolved family to its concrete Coral type', () => {
    const family = createOverloadNodeDefinition([
      scalarGradient,
      vectorGradient,
    ])
    const graph = [
      node('field', definition('field', [], 'ScalarField', 'field')),
      node('gradient', family),
    ]
    const protocol = parseGraphToProtocol(graph, [
      edge('e', 'field', 'gradient'),
    ])

    expect(protocol.workflow.nodes.gradient).toMatchObject({
      type: 'gradient<scalar>',
    })
    expect(JSON.stringify(protocol)).not.toContain('frontend::overload')
  })

  it('rejects an unresolved family during export with remaining signatures', () => {
    const family = createOverloadNodeDefinition([
      scalarGradient,
      vectorGradient,
    ])
    expect(() => parseGraphToProtocol([node('gradient', family)], [])).toThrow(
      'gradient<scalar>, gradient<vector>'
    )
  })
})
