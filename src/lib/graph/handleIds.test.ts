import { describe, expect, it } from 'vitest'

import {
  edgeHandle,
  handleIdToIndex,
  isParameterHandle,
  parameterHandle,
  parameterHandlePath,
  protocolEdgeHandles,
} from './handleIds'

describe('handleIdToIndex', () => {
  it('parses ordinary input and output handles', () => {
    expect(handleIdToIndex('input-0')).toBe(0)
    expect(handleIdToIndex('output-12')).toBe(12)
  })

  it('rejects parameter and malformed handles', () => {
    expect(
      handleIdToIndex(parameterHandle('input', ['Mesh', 'Size']))
    ).toBeNaN()
    expect(handleIdToIndex('input-')).toBeNaN()
    expect(handleIdToIndex('input-1-extra')).toBeNaN()
    expect(handleIdToIndex('self-1')).toBeNaN()
  })
})

describe('edgeHandle', () => {
  it('returns the handle at the requested end', () => {
    const edge = { sourceHandle: 'output-2', targetHandle: 'input-3' }
    expect(edgeHandle(edge, 'source')).toBe('output-2')
    expect(edgeHandle(edge, 'target')).toBe('input-3')
  })

  it('falls back to the first handle on both ends', () => {
    expect(edgeHandle({ sourceHandle: null }, 'source')).toBe('output-0')
    expect(edgeHandle({ targetHandle: undefined }, 'target')).toBe('input-0')
    expect(edgeHandle({ targetHandle: '' }, 'target')).toBe('input-0')
  })
})

describe('protocolEdgeHandles', () => {
  it('builds handles from port indexes', () => {
    expect(
      protocolEdgeHandles({
        source: 1,
        source_output: 2,
        target: 3,
        target_input: 4,
      })
    ).toEqual({ sourceHandle: 'output-2', targetHandle: 'input-4' })
  })

  it('prefers explicit handles', () => {
    const handle = parameterHandle('input', ['Mesh', 'Size'])
    expect(
      protocolEdgeHandles({
        source: 1,
        source_output: 0,
        target: 3,
        target_input: 0,
        target_handle: handle,
      })
    ).toEqual({ sourceHandle: 'output-0', targetHandle: handle })
  })
})

describe('parameter handles', () => {
  it('round-trips a parameter path', () => {
    const handle = parameterHandle('output', ['Mesh', 'Refinements'])
    expect(parameterHandlePath(handle)).toEqual({
      direction: 'output',
      path: ['Mesh', 'Refinements'],
    })
    expect(isParameterHandle(handle)).toBe(true)
  })

  it('returns null for ordinary handles', () => {
    expect(parameterHandlePath('input-0')).toBeNull()
    expect(isParameterHandle('output-1')).toBe(false)
  })
})
