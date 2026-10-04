import { describe, expect, it } from 'vitest'
import {
  ConnectionType,
  DEFAULT_WORKING_FILE_REFERENCE,
  isStagedWorkingFileArgument,
  isWorkingFileReference,
  isTypeCompatible,
  Type,
} from './nodeTypes'

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

describe('isStagedWorkingFileArgument', () => {
  it('recognises explicit working-file staging metadata', () => {
    expect(
      isStagedWorkingFileArgument({
        connection_type: ConnectionType.INPUT,
        name: 'parameters',
        type: Type.STRING,
        file_scope: 'working',
        staging: 'copy',
        create_if_missing: true,
      })
    ).toBe(true)
  })

  it('does not infer staging from incomplete metadata', () => {
    expect(
      isStagedWorkingFileArgument({
        connection_type: ConnectionType.INPUT,
        name: 'file',
        type: Type.STRING,
        file_scope: 'working',
      })
    ).toBe(false)
  })
})

describe('working-file metadata', () => {
  it('provides working/copy/create-if-missing as the UI default', () => {
    expect(DEFAULT_WORKING_FILE_REFERENCE).toEqual({
      file_scope: 'working',
      staging: 'copy',
      create_if_missing: true,
    })
  })

  it('recognises metadata persisted on a graph value', () => {
    expect(
      isWorkingFileReference({
        file_scope: 'working',
        staging: 'copy',
        create_if_missing: true,
      })
    ).toBe(true)
    expect(isWorkingFileReference({ file_scope: 'working' })).toBe(false)
  })
})
