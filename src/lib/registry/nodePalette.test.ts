import { describe, expect, it } from 'vitest'
import { NodeType, type StandardNodeDefinition } from '../types/nodeTypes'
import {
  formatSuggestedNodeName,
  nodeClassSection,
  nodeOwnerDisplayName,
  nodePaletteChildName,
  nodePaletteDisplayName,
  nodePaletteKey,
  nodePaletteNodeName,
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
  it('formats suggested names for display', () => {
    expect(formatSuggestedNodeName('my_connection_name')).toBe(
      'My connection name'
    )
    expect(formatSuggestedNodeName('ImmersX::LinearExecution')).toBe(
      'LinearExecution'
    )
  })

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

    expect(nodePaletteKey(poisson)).toBe(nodePaletteKey(elastic))
    expect(nodePaletteDisplayName(poisson)).toBe('Finite element space')
    expect(nodeVariantName(poisson)).toBe('Poisson · 2D')
    expect(nodeVariantName(elastic)).toBe('Elastic static · 2D')
    expect(nodePaletteNodeName(poisson)).toBe('Finite element space')
    expect(nodePaletteNodeName(poisson, true)).toBe('Poisson · 2D')
  })

  it('keys and labels every literal on its own', () => {
    const literals = [
      'double',
      'int',
      'unsigned int',
      'std::string',
      'bool',
    ].map((type) => node(type, { node_type: NodeType.ELEMENTARY_CONSTRUCTOR }))

    expect(new Set(literals.map(nodePaletteKey)).size).toBe(5)
    expect(literals.map(nodePaletteDisplayName)).toEqual([
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

  it('keys class specializations without their dimensions', () => {
    const poisson12 = node('ImmersX::Poisson<1,2>', {
      node_type: NodeType.EMPTY_CONSTRUCTOR,
    })
    const poisson22 = node('ImmersX::Poisson<2,2>', {
      node_type: NodeType.EMPTY_CONSTRUCTOR,
    })
    const triangulation = node('dealii::Triangulation<2, 2>', {
      node_type: NodeType.EMPTY_CONSTRUCTOR,
    })

    expect(nodePaletteKey(poisson12)).toBe(nodePaletteKey(poisson22))
    expect(nodePaletteKey(poisson12)).not.toBe(nodePaletteKey(triangulation))
    expect(nodePaletteDisplayName(poisson12)).toBe('Poisson')
    expect(nodePaletteDisplayName(triangulation)).toBe('Triangulation')
  })

  it('labels a constructor with its display name when it has one', () => {
    const definition = node('ImmersX::Poisson<2,2>', {
      node_type: NodeType.EMPTY_CONSTRUCTOR,
      display_name: 'Poisson problem',
    })

    expect(nodePaletteDisplayName(definition)).toBe('Poisson problem')
    expect(
      nodePaletteDisplayName({ ...definition, display_name: undefined })
    ).toBe('Poisson')
  })

  it('keys and labels distinct operations apart', () => {
    const addProblem = node('Add problem to linear execution', {
      operation: 'Add problem to linear execution',
      display_name: 'Add problem',
    })
    const addConstraint = node('Add constraint to linear execution', {
      operation: 'Add constraint to linear execution',
      display_name: 'Add constraint',
    })

    expect(nodePaletteKey(addProblem)).not.toBe(nodePaletteKey(addConstraint))
    expect(nodePaletteDisplayName(addProblem)).toBe('Add problem')
    expect(nodePaletteDisplayName(addConstraint)).toBe('Add constraint')
  })

  it('labels methods with their class and keys dimensional variants together', () => {
    const solve22 = node('ImmersX::Poisson<2,2>::solve', {
      node_type: NodeType.METHOD,
      operation: 'Poisson::solve',
      class_name: 'Poisson',
    })
    const solve12 = node('ImmersX::Poisson<1,2>::solve', {
      node_type: NodeType.METHOD,
      operation: 'Poisson::solve',
      class_name: 'Poisson',
    })
    const makeGrid = node('ImmersX::Poisson<2,2>::make_grid', {
      node_type: NodeType.METHOD,
      operation: 'Poisson::make_grid',
      class_name: 'Poisson',
    })

    expect(nodePaletteKey(solve22)).toBe(nodePaletteKey(solve12))
    expect(nodePaletteKey(solve22)).not.toBe(nodePaletteKey(makeGrid))
    expect(nodePaletteDisplayName(solve22)).toBe('Poisson::solve')
    expect(nodePaletteDisplayName(makeGrid)).toBe('Poisson::make_grid')
    expect(nodePaletteChildName(solve22)).toBe('Poisson::solve')
  })

  it('keys an explicit overload group together', () => {
    const field = node('gradient<field>', {
      operation: 'Field gradient',
      overload_group: 'Gradient',
    })
    const test = node('gradient<test>', {
      operation: 'Test gradient',
      overload_group: 'Gradient',
    })

    expect(nodePaletteKey(field)).toBe(nodePaletteKey(test))
  })

  it('removes the ImmersX namespace from user-facing labels', () => {
    const definition = node('ImmersX::LinearExecution<2>', {
      operation: 'ImmersX::LinearExecution::solve',
      display_name: 'ImmersX::Solve',
      class_name: 'ImmersX::LinearExecution',
      method_name: 'solve',
    })

    expect(nodeOwnerDisplayName(definition)).toBe('Linear execution -> Solve')
  })

  it('removes template specializations from class owners', () => {
    const definition = node('ImmersX::FiberEmbeddedProblem<2>::prepare', {
      display_name: 'Prepare',
      class_name: 'ImmersX::FiberEmbeddedProblem<2>',
      method_name: 'prepare',
    })

    expect(nodeOwnerDisplayName(definition)).toBe(
      'Fiber embedded problem -> Prepare'
    )
    expect(nodeClassSection(definition)).toEqual({
      key: 'class:fiberembeddedproblem',
      label: 'Fiber embedded problem',
    })
  })

  it('does not prefix constructors with their owning class', () => {
    const definition = node('Boundary conditions<2,2>', {
      display_name: 'Boundary conditions',
      class_name: 'BoundaryConditions',
      method_name: 'create',
    })

    expect(nodeOwnerDisplayName(definition)).toBe('Boundary conditions')
  })

  it('keys class methods by class and method instead of operation', () => {
    const scalar = node('Known term<Scalar>', {
      operation: 'Known term',
      display_name: 'Known term',
      class_name: 'KnownTerm',
      method_name: 'create',
    })
    const vector = node('Known term<Vector>', {
      operation: 'Vector Known term',
      display_name: 'Known term',
      class_name: 'KnownTerm',
      method_name: 'create',
    })

    expect(nodePaletteKey(scalar)).toBe(nodePaletteKey(vector))
    expect(nodePaletteDisplayName(scalar)).toBe('Known term')
  })

  it('extracts the owner and operation from registry suffixes', () => {
    const definition = node('ImmersX::CoupledPoisson<2>::residual_norm', {
      node_type: NodeType.METHOD,
      operation: 'CoupledPoisson::residual_norm',
      class_name: 'CoupledPoisson',
    })

    expect(nodePaletteDisplayName(definition)).toBe(
      'CoupledPoisson::residual_norm'
    )
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

    expect(nodePaletteDisplayName(definition)).toBe(
      'Finite element space::std::function'
    )
    expect(nodePaletteChildName(definition)).toBe(
      'Finite element space::std::function'
    )
  })

  it('lists an entry without class_name on its own', () => {
    expect(nodeClassSection(node('make_grid'))).toBeUndefined()
  })
})
