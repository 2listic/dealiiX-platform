import { describe, expect, it } from 'vitest'
import { Type } from '../types/nodeTypes'
import {
  groupExposuresBySection,
  parameterPortCoralType,
  parameterPortType,
} from './parameterPorts'

describe('parameter port type detection', () => {
  it('recognises non-negative integer ranges as unsigned int', () => {
    expect(
      parameterPortType('[Integer range 1...2147483647 (inclusive)]')
    ).toBe('unsigned int')
    expect(parameterPortCoralType('unsigned int')).toBe(Type.UNSIGNED_INT)
  })

  it('keeps unconstrained and signed integer parameters as int', () => {
    expect(parameterPortType('[Integer]')).toBe('int')
    expect(
      parameterPortType('[Integer range -2147483648...2147483647 (inclusive)]')
    ).toBe('int')
  })
})

describe('groupExposuresBySection', () => {
  const exposure = (...path: string[]) => ({
    path,
    type: 'int' as const,
    input: true,
    output: false,
  })

  it('groups by section in order of first appearance', () => {
    const refinement = exposure('Mesh', 'Refinement')
    const tolerance = exposure('Solver', 'Tolerance')
    const cells = exposure('Mesh', 'Cells')
    const dimension = exposure('Dimension')

    expect(
      groupExposuresBySection([refinement, tolerance, cells, dimension])
    ).toEqual([
      { section: ['Mesh'], exposures: [refinement, cells] },
      { section: ['Solver'], exposures: [tolerance] },
      { section: [], exposures: [dimension] },
    ])
  })
})
