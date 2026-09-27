import { describe, expect, it } from 'vitest'
import { Type } from '../types/nodeTypes'
import { parameterPortCoralType, parameterPortType } from './parameterPorts'

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
