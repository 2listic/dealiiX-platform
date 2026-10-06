import { describe, expect, it } from 'vitest'
import { NodeType, type StandardNodeDefinition } from '../types/nodeTypes'
import {
  groupNodesByClass,
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

    expect(groups).toHaveLength(5)
    expect(groups.map((group) => group.displayName)).toEqual([
      'double',
      'int',
      'unsigned int',
      'std::string',
      'bool',
    ])
  })

  it('derives a readable label for legacy registries', () => {
    expect(nodeVariantName(node('legacy::operation<2>'))).toBe(
      'legacy::operation'
    )
  })

  it('derives family, class name, and dimension tag from simple node types', () => {
    const type = 'ImmersX::ElasticStatic<1, 2>'

    expect(nodeNamespace(type)).toBe('ImmersX')
    expect(nodeClassName(type)).toBe('ElasticStatic')
    expect(nodeDimensionTag(type)).toBe('· 1D in 2D')
    expect(nodeSimpleDisplayName(type)).toBe('ElasticStatic · 1D in 2D')
    expect(nodeSimpleDisplayName('ImmersX::Poisson<2, 2>')).toBe('Poisson · 2D')
  })

  it('groups class specializations without their dimensions', () => {
    const groups = groupNodesByOperation([
      node('ImmersX::Poisson<1,2>', { node_type: NodeType.EMPTY_CONSTRUCTOR }),
      node('ImmersX::Poisson<2,2>', { node_type: NodeType.EMPTY_CONSTRUCTOR }),
      node('dealii::Triangulation<2, 2>', {
        node_type: NodeType.EMPTY_CONSTRUCTOR,
      }),
    ])

    expect(groups.map((group) => group.displayName)).toEqual([
      'Poisson',
      'Triangulation',
    ])
    expect(groups[0].nodes).toHaveLength(2)
  })

  it('keeps operations as flat palette entries', () => {
    const addProblem = node('Add problem to linear execution', {
      operation: 'Add problem to linear execution',
      display_name: 'Add problem',
    })
    const addConstraint = node('Add constraint to linear execution', {
      operation: 'Add constraint to linear execution',
      display_name: 'Add constraint',
    })

    const groups = groupNodesByOperation([addProblem, addConstraint])

    expect(groups).toHaveLength(2)
    expect(groups.map((group) => group.displayName)).toEqual([
      'Add problem',
      'Add constraint',
    ])
  })

  it('labels methods with their class and groups dimensional variants', () => {
    const groups = groupNodesByOperation([
      node('ImmersX::Poisson<2,2>::solve', {
        node_type: NodeType.METHOD,
        operation: 'Poisson::solve',
        class_name: 'Poisson',
      }),
      node('ImmersX::Poisson<2,2>::make_grid', {
        node_type: NodeType.METHOD,
        operation: 'Poisson::make_grid',
        class_name: 'Poisson',
      }),
      node('ImmersX::Poisson<1,2>::solve', {
        node_type: NodeType.METHOD,
        operation: 'Poisson::solve',
        class_name: 'Poisson',
      }),
    ])

    expect(groups.map((group) => group.displayName)).toEqual([
      'Poisson::solve',
      'Poisson::make_grid',
    ])
    expect(groups[0].nodes).toHaveLength(2)
    expect(nodePaletteChildName(groups[0].nodes[0])).toBe('Poisson::solve')
  })

  it('groups method-like operations under an owning class', () => {
    const scalar = node('Add scalar field<1,2>', {
      node_type: NodeType.VOID_FUNCTION,
      operation: 'Add scalar field',
      display_name: 'Add scalar field',
      class_name: 'ImmersX::OutputHandler',
    })
    const vector = node('Add vector field<2,2>', {
      node_type: NodeType.VOID_FUNCTION,
      operation: 'Add vector field',
      display_name: 'Add vector field',
      class_name: 'ImmersX::OutputHandler',
    })
    const constructor = node('ImmersX::OutputHandler<2,2>', {
      node_type: NodeType.EMPTY_CONSTRUCTOR,
    })

    const items = groupNodesByClass([scalar, vector, constructor])

    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      kind: 'class',
      displayName: 'Output handler',
    })
    if (items[0].kind !== 'class') throw new Error('Expected a class group')
    expect(items[0].groups.map((group) => group.methodName)).toEqual([
      'Add scalar field',
      'Add vector field',
    ])
    expect(items[1]).toMatchObject({ kind: 'node' })
  })

  it('extracts the owner and operation from registry suffixes', () => {
    const definition = node('ImmersX::CoupledPoisson<2>::residual_norm', {
      node_type: NodeType.METHOD,
      operation: 'CoupledPoisson::residual_norm',
      class_name: 'CoupledPoisson',
    })
    const groups = groupNodesByOperation([definition])

    expect(nodeNamespace(definition.type)).toBe('ImmersX')
    expect(groups[0].displayName).toBe('CoupledPoisson::residual_norm')
    expect(nodePaletteChildName(definition)).toBe(
      'CoupledPoisson::residual_norm'
    )
    expect(nodePaletteNodeName(definition)).toBe(
      'CoupledPoisson::residual_norm'
    )
  })

  it('keeps std::function wrappers readable', () => {
    const definition = node(
      'Finite element space::std::function<Space(const Problem &)>',
      { output_type: 'ImmersX::FiniteElementSpaceView<2, 2>' }
    )
    const groups = groupNodesByOperation([definition])

    expect(groups[0].displayName).toBe('Finite element space::std::function')
    expect(nodePaletteChildName(definition)).toBe(
      'Finite element space::std::function'
    )
  })

  it('hides a generated function alias when its concrete registration exists', () => {
    const method = node('ImmersX::Poisson<2,2>::solve', {
      node_type: NodeType.VOID_METHOD,
      operation: 'Poisson::solve',
      class_name: 'Poisson',
    })
    const wrapper = node(
      'ImmersX::Poisson<2,2>::solve::std::function<void (ImmersX::PoissonSolver<2, 2> &)>',
      { node_type: NodeType.VOID_FUNCTION }
    )

    const groups = groupNodesByOperation([method, wrapper])

    expect(groups).toHaveLength(1)
    expect(groups[0].displayName).toBe('Poisson::solve')
    expect(groups[0].nodes.map((item) => item.type)).toEqual([method.type])
  })
})
