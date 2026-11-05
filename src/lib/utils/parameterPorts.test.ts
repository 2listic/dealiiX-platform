import { describe, expect, it } from 'vitest'
import { Type } from '../types/nodeTypes'
import {
  groupExposuresBySection,
  normalizeParameterFile,
  parameterPortCoralType,
  parameterPortType,
} from './parameterPorts'

describe('normalizeParameterFile', () => {
  const exposure = {
    path: ['Mesh', 'Refinements'],
    type: 'int' as const,
    input: true,
    output: false,
  }

  it('keeps the exposures and create_if_missing', () => {
    const marker = { exposures: [exposure], create_if_missing: true }
    const normalized = normalizeParameterFile(marker)

    expect(normalized).toEqual(marker)
    expect(normalized.exposures[0].path).not.toBe(exposure.path)
  })

  it('omits create_if_missing when it is false', () => {
    expect(
      normalizeParameterFile({ exposures: [], create_if_missing: false })
    ).toEqual({ exposures: [] })
  })
})

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
