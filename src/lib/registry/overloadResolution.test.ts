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
  buildNodePalette,
  createOverloadFamilies,
  createOverloadNodeDefinition,
  overloadInputTypes,
  overloadInterfaceForCandidates,
  overloadStatus,
  resolveOverloadGraph,
} from './overloadResolution'
import { parseGraphToProtocol } from '../graph/graphParser'
import defaultRegistry from '../data/defaultNodes.json'

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

describe('buildNodePalette', () => {
  const entry = (
    type: string,
    overrides: Partial<StandardNodeDefinition> = {}
  ): StandardNodeDefinition => ({
    type,
    arguments: [],
    inputs: [],
    outputs: [],
    node_type: NodeType.FUNCTION,
    ...overrides,
  })

  it('lists class members under their class and the rest on their own', () => {
    const scalar = entry('Add scalar field<1,2>', {
      node_type: NodeType.VOID_FUNCTION,
      operation: 'Add scalar field',
      display_name: 'Add scalar field',
      class_name: 'ImmersX::OutputHandler',
    })
    const vector = entry('Add vector field<2,2>', {
      node_type: NodeType.VOID_FUNCTION,
      operation: 'Add vector field',
      display_name: 'Add vector field',
      class_name: 'ImmersX::OutputHandler',
    })
    const constructor = entry('ImmersX::OutputHandler<2,2>', {
      node_type: NodeType.EMPTY_CONSTRUCTOR,
    })

    const items = buildNodePalette([scalar, vector, constructor])

    expect(items).toHaveLength(2)
    const [section, single] = items
    if (section.kind !== 'class') throw new Error('Expected a class section')
    expect(section.label).toBe('Output handler')
    expect(section.tiles.map((tile) => tile.label)).toEqual([
      'Output handler -> Add scalar field',
      'Output handler -> Add vector field',
    ])
    if (single.kind !== 'tile') throw new Error('Expected a tile')
    expect(single.tile).toEqual({ label: 'OutputHandler', node: constructor })
  })

  it('makes one family tile for dimensional variants', () => {
    const items = buildNodePalette([
      entry('ImmersX::Poisson<1,2>', { node_type: NodeType.EMPTY_CONSTRUCTOR }),
      entry('ImmersX::Poisson<2,2>', { node_type: NodeType.EMPTY_CONSTRUCTOR }),
      entry('dealii::Triangulation<2, 2>', {
        node_type: NodeType.EMPTY_CONSTRUCTOR,
      }),
    ])

    const tiles = items.map((item) => {
      if (item.kind !== 'tile') throw new Error('Expected a tile')
      return item.tile
    })
    expect(tiles.map((tile) => tile.label)).toEqual([
      'Poisson',
      'Triangulation',
    ])
    if (!isOverloadNodeDefinition(tiles[0].node)) {
      throw new Error('Expected a family')
    }
    expect(tiles[0].node.candidates).toHaveLength(2)
  })

  it('keeps signature-keyed overloads of a free function as one family', () => {
    const overload = (dim: number) =>
      entry(
        `Add problem to linear execution::std::function<void(const ImmersX::PoissonSolver<${dim}, 2>&)>`,
        {
          operation: 'Add problem to linear execution',
          display_name: 'Add problem',
          class_name: 'LinearExecution',
          method_name: 'add_problem',
        }
      )

    const items = buildNodePalette([overload(1), overload(2)])

    expect(items).toHaveLength(1)
    if (items[0].kind !== 'class') throw new Error('Expected a class section')
    const [tile] = items[0].tiles
    expect(tile.label).toBe('Linear execution -> Add problem')
    if (!isOverloadNodeDefinition(tile.node)) {
      throw new Error('Expected a family')
    }
    expect(tile.node.candidates).toEqual([overload(1), overload(2)])
  })

  it('makes one family tile per deal.II method of the bundled registry', () => {
    const items = buildNodePalette(
      Object.values(defaultRegistry) as StandardNodeDefinition[]
    )
    const gridGenerator = items.find(
      (item) => item.kind === 'class' && item.label === 'Grid generator'
    )
    if (gridGenerator?.kind !== 'class') {
      throw new Error('Expected a Grid generator section')
    }

    expect(gridGenerator.tiles).toHaveLength(1)
    const [tile] = gridGenerator.tiles
    expect(tile.label).toBe(
      'Grid generator -> Generate from name and arguments'
    )
    if (!isOverloadNodeDefinition(tile.node)) {
      throw new Error('Expected a family')
    }
    expect(tile.node.candidates).toHaveLength(6)
  })
})

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

  it('groups class methods into one family even when operations differ', () => {
    const scalarKnownTerm = {
      ...definition(
        'known_term<scalar>',
        ['KnownSourceScalar', 'TestScalar'],
        'KnownTermScalar',
        'Known term'
      ),
      display_name: 'Known term',
      class_name: 'KnownTerm',
      method_name: 'create',
    }
    const vectorKnownTerm = {
      ...definition(
        'known_term<vector>',
        ['KnownSourceVector', 'TestVector'],
        'KnownTermVector',
        'Vector Known term'
      ),
      display_name: 'Known term',
      class_name: 'KnownTerm',
      method_name: 'create',
    }

    const entries = createOverloadFamilies([scalarKnownTerm, vectorKnownTerm])

    expect(entries).toHaveLength(1)
    expect(entries[0].node_type).toBe(NodeType.OVERLOAD)
    if (!isOverloadNodeDefinition(entries[0])) return
    expect(entries[0].candidates).toEqual([scalarKnownTerm, vectorKnownTerm])
  })

  it('groups dimensional constructor variants into one family', () => {
    const variant = (type: string): StandardNodeDefinition => ({
      ...definition(type, [], 'dealii::ParameterAcceptor', ''),
      display_name: 'DomainParameters',
      node_type: NodeType.CONSTRUCTOR,
    })

    const entries = createOverloadFamilies([
      variant('ImmersX::DomainParameters<1,2>'),
      variant('ImmersX::DomainParameters<2,2>'),
    ])

    expect(entries).toHaveLength(1)
    expect(entries[0].node_type).toBe(NodeType.OVERLOAD)
    if (!isOverloadNodeDefinition(entries[0])) return
    expect(entries[0].display_name).toBe('DomainParameters')
    expect(entries[0].candidates.map((candidate) => candidate.type)).toEqual([
      'ImmersX::DomainParameters<1,2>',
      'ImmersX::DomainParameters<2,2>',
    ])
  })

  it('builds one family from signature keys of differently named functions', () => {
    const knownTerm = (type: string, input: string, output: string) => ({
      ...definition(type, [input, 'TestScalar'], output, 'Known term'),
      display_name: 'Known term',
      class_name: 'KnownTerm',
      method_name: 'create',
    })
    const scalar = knownTerm(
      'Known term scalar::std::function<KnownTermScalar(const KnownSourceScalar&)>',
      'KnownSourceScalar',
      'KnownTermScalar'
    )
    const vector = knownTerm(
      'Known term::std::function<KnownTermVector(const KnownSourceVector&)>',
      'KnownSourceVector',
      'KnownTermVector'
    )

    const entries = createOverloadFamilies([scalar, vector])

    expect(entries).toHaveLength(1)
    if (!isOverloadNodeDefinition(entries[0])) return
    expect(entries[0].candidates.map((candidate) => candidate.type)).toEqual([
      scalar.type,
      vector.type,
    ])
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

  it('rejects an unresolved family during export with the number of variants left', () => {
    const family = createOverloadNodeDefinition([
      scalarGradient,
      vectorGradient,
    ])
    expect(() => parseGraphToProtocol([node('gradient', family)], [])).toThrow(
      `Cannot export graph: "${family.display_name}" has 2 variants left. Connect it until one variant is left.`
    )
  })
})
