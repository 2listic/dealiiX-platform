import { describe, expect, it } from 'vitest'
import { isTypeCompatible, Type } from './nodeTypes'

describe('isTypeCompatible', () => {
  it('accepts an exact type match', () => {
    expect(isTypeCompatible(Type.STRING, Type.STRING)).toBe(true)
  })

  it('rejects an unrelated type mismatch', () => {
    expect(isTypeCompatible(Type.STRING, 'dealii::Triangulation<2, 2>')).toBe(
      false
    )
  })

  it('accepts "any" as a wildcard on the source side', () => {
    expect(isTypeCompatible(Type.ANY, Type.FLOAT)).toBe(true)
  })

  it('accepts "any" as a wildcard on the target side', () => {
    expect(isTypeCompatible(Type.FLOAT, Type.ANY)).toBe(true)
  })

  it('accepts "any" into "any"', () => {
    expect(isTypeCompatible(Type.ANY, Type.ANY)).toBe(true)
  })

  it.each([
    [Type.BOOLEAN, Type.INT],
    [Type.BOOLEAN, Type.FLOAT],
    [Type.INT, Type.FLOAT],
  ])('accepts numeric widening %s -> %s', (source, target) => {
    expect(isTypeCompatible(source, target)).toBe(true)
  })

  it.each([
    [Type.FLOAT, Type.INT],
    [Type.INT, Type.BOOLEAN],
    [Type.FLOAT, Type.BOOLEAN],
  ])('rejects numeric narrowing %s -> %s', (source, target) => {
    expect(isTypeCompatible(source, target)).toBe(false)
  })

  it('does not widen C++-only numeric types outside the bool/int/float chain', () => {
    expect(isTypeCompatible(Type.INT, Type.DOUBLE)).toBe(false)
    expect(isTypeCompatible(Type.UNSIGNED, Type.INT)).toBe(false)
  })
})
