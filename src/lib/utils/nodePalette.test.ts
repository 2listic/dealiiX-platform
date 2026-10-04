import { describe, expect, it } from 'vitest'
import { NodeType, type StandardNodeDefinition } from '../types/nodeTypes'
import {
  groupNodesByFamily,
  groupNodesByOperation,
  nodeClassName,
  nodeDimensionTag,
  nodeNamespace,
  nodePaletteChildName,
  nodePaletteNodeName,
  nodeSimpleDisplayName,
  nodeVariantName,
} from './nodePalette'

const node = (
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

describe('node palette metadata', () => {
  it('uses an optional variant label for operation specializations', () => {
    const poisson = node('poisson<2>', {
      operation: 'finite_element_space',
      display_name: 'Finite element space',
      variant_name: 'Poisson · 2D',
    })
    const elastic = node('elastic<2>', {
      operation: 'finite_element_space',
      display_name: 'Finite element space',
      variant_name: 'Elastic static · 2D',
    })

    const groups = groupNodesByOperation([poisson, elastic])

    expect(groups).toHaveLength(1)
    expect(groups[0].displayName).toBe('Finite element space')
    expect(nodeVariantName(groups[0].nodes[0])).toBe('Poisson · 2D')
    expect(nodeVariantName(groups[0].nodes[1])).toBe('Elastic static · 2D')
    expect(nodePaletteNodeName(groups[0].nodes[0])).toBe('Finite element space')
    expect(nodePaletteNodeName(groups[0].nodes[0], true)).toBe('Poisson · 2D')
  })

  it('groups all elementary constructors under one palette group', () => {
    const groups = groupNodesByOperation([
      node('double', { node_type: NodeType.ELEMENTARY_CONSTRUCTOR }),
      node('int', { node_type: NodeType.ELEMENTARY_CONSTRUCTOR }),
      node('unsigned int', { node_type: NodeType.ELEMENTARY_CONSTRUCTOR }),
      node('std::string', { node_type: NodeType.ELEMENTARY_CONSTRUCTOR }),
      node('bool', { node_type: NodeType.ELEMENTARY_CONSTRUCTOR }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].displayName).toBe('Elementary')
    expect(groups[0].nodes.map((item) => item.type)).toEqual([
      'double',
      'int',
      'unsigned int',
      'std::string',
      'bool',
    ])
  })

  it('derives a readable label for legacy registries', () => {
    expect(nodeVariantName(node('legacy::operation<2>'))).toBe('Operation · 2D')
  })

  it('derives family, class name, and dimension tag from simple node types', () => {
    const type = 'ImmersX::ElasticStatic<1, 2>'

    expect(nodeNamespace(type)).toBe('ImmersX')
    expect(nodeClassName(type)).toBe('ElasticStatic')
    expect(nodeDimensionTag(type)).toBe('· 1D in 2D')
    expect(nodeSimpleDisplayName(type)).toBe('ElasticStatic · 1D in 2D')
    expect(nodeSimpleDisplayName('ImmersX::Poisson<2, 2>')).toBe('Poisson · 2D')
  })

  it('groups legacy simple nodes by namespace', () => {
    const groups = groupNodesByOperation([
      node('ImmersX::Poisson<2>'),
      node('ImmersX::ElasticStatic<2>'),
      node('dealii::Triangulation<2, 2>'),
    ])

    expect(groups.map((group) => group.displayName)).toEqual([
      'ImmersX',
      'dealii',
    ])
    expect(groups[0].nodes.map((item) => nodeVariantName(item))).toEqual([
      'Poisson · 2D',
      'ElasticStatic · 2D',
    ])
  })

  it('creates hierarchical legacy family groups by class specialization', () => {
    const groups = groupNodesByOperation([
      node('ImmersX::Poisson<2>::solve', { node_type: NodeType.METHOD }),
      node('ImmersX::Poisson<2>::make_grid', { node_type: NodeType.METHOD }),
      node('ImmersX::Poisson<1,2>::solve', { node_type: NodeType.METHOD }),
    ])

    const familyGroups = groupNodesByFamily(groups[0].nodes)

    expect(familyGroups.map((group) => group.displayName)).toEqual(['Poisson'])
    expect(familyGroups[0].subgroups.map((group) => group.displayName)).toEqual(
      ['2D', '1D in 2D']
    )
    expect(
      familyGroups[0].subgroups[0].nodes.map(nodePaletteChildName)
    ).toEqual(['Solve', 'Make grid'])
    expect(
      familyGroups[0].subgroups[1].nodes.map(nodePaletteChildName)
    ).toEqual(['Solve'])
  })

  it('extracts the owner and operation from registry suffixes', () => {
    const definition = node('ImmersX::CoupledPoisson<2>::residual_norm::std', {
      name: 'ImmersX::CoupledPoisson<2>::residual_norm::std',
    })
    const groups = groupNodesByOperation([definition])
    const familyGroups = groupNodesByFamily(groups[0].nodes)

    expect(nodeNamespace(definition.type)).toBe('ImmersX')
    expect(familyGroups[0].displayName).toBe('CoupledPoisson')
    expect(familyGroups[0].subgroups[0].displayName).toBe('2D')
    expect(nodePaletteChildName(definition)).toBe('Residual norm')
    expect(nodePaletteNodeName(definition)).toBe('Residual norm')
  })

  it('keeps std::function wrappers readable', () => {
    const definition = node(
      'Finite element space::std::function<Space(const Problem &)>',
      { output_type: 'ImmersX::FiniteElementSpaceView<2, 2>' }
    )
    const groups = groupNodesByOperation([definition])
    const familyGroups = groupNodesByFamily(groups[0].nodes)

    expect(groups[0].displayName).toBe('Finite element space')
    expect(familyGroups[0].displayName).toBe('Function')
    expect(familyGroups[0].subgroups[0].displayName).toBe('')
    expect(nodePaletteChildName(definition)).toBe('FiniteElementSpaceView · 2D')
  })

  it('hides a generated function alias when its concrete registration exists', () => {
    const method = node('ImmersX::Poisson<2,2>::solve', {
      node_type: NodeType.VOID_METHOD,
    })
    const wrapper = node(
      'ImmersX::Poisson<2,2>::solve::std::function<void (ImmersX::PoissonSolver<2, 2> &)>',
      { node_type: NodeType.VOID_FUNCTION }
    )

    const groups = groupNodesByOperation([method, wrapper])

    expect(groups).toHaveLength(1)
    expect(groups[0].nodes.map((item) => item.type)).toEqual([method.type])
  })
})
