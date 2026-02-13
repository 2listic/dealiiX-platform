import { describe, it, expect } from 'vitest'
import defaultRegistry from '../data/defaultNodes.json'
import { filterValidNodes } from './registryValidator'

describe('filterValidNodes', () => {
  it('accepts all entries from a valid registry', () => {
    const [filtered, skipped] = filterValidNodes(
      defaultRegistry as Record<string, unknown>
    )

    expect(skipped).toHaveLength(0)
    expect(Object.keys(filtered)).toHaveLength(
      Object.keys(defaultRegistry).length
    )
  })

  it('skips a string entry like __backend_name', () => {
    const data = {
      ...defaultRegistry,
      __backend_name: 'dealii',
    }

    const [filtered, skipped] = filterValidNodes(
      data as Record<string, unknown>
    )

    expect(skipped).toEqual(['__backend_name'])
    expect(filtered).not.toHaveProperty('__backend_name')
    expect(Object.keys(filtered)).toHaveLength(
      Object.keys(defaultRegistry).length
    )
  })

  it('skips null entries', () => {
    const data = {
      ...defaultRegistry,
      null_entry: null,
    }

    const [, skipped] = filterValidNodes(data as Record<string, unknown>)

    expect(skipped).toEqual(['null_entry'])
  })

  it('skips an entry missing node_type', () => {
    const data = {
      ...defaultRegistry,
      broken_node: {
        arguments: [],
        inputs: [],
        outputs: [-1],
        type: 'broken_node',
      },
    }

    const [, skipped] = filterValidNodes(data as Record<string, unknown>)

    expect(skipped).toEqual(['broken_node'])
  })

  it('skips an entry missing arguments', () => {
    const data = {
      ...defaultRegistry,
      broken_node: {
        node_type: 'constructor',
        inputs: [],
        outputs: [-1],
        type: 'broken_node',
      },
    }

    const [, skipped] = filterValidNodes(data as Record<string, unknown>)

    expect(skipped).toEqual(['broken_node'])
  })

  it('skips an entry missing inputs', () => {
    const data = {
      ...defaultRegistry,
      broken_node: {
        node_type: 'constructor',
        arguments: [],
        outputs: [-1],
        type: 'broken_node',
      },
    }

    const [, skipped] = filterValidNodes(data as Record<string, unknown>)

    expect(skipped).toEqual(['broken_node'])
  })

  it('skips an entry missing outputs', () => {
    const data = {
      ...defaultRegistry,
      broken_node: {
        node_type: 'constructor',
        arguments: [],
        inputs: [],
        type: 'broken_node',
      },
    }

    const [, skipped] = filterValidNodes(data as Record<string, unknown>)

    expect(skipped).toEqual(['broken_node'])
  })

  it('skips multiple non-compliant entries at once', () => {
    const data = {
      ...defaultRegistry,
      __backend_name: 'dealii',
      __version: 42,
      missing_fields: { node_type: 'constructor' },
    }

    const [filtered, skipped] = filterValidNodes(
      data as Record<string, unknown>
    )

    expect(skipped).toHaveLength(3)
    expect(skipped).toContain('__backend_name')
    expect(skipped).toContain('__version')
    expect(skipped).toContain('missing_fields')
    expect(Object.keys(filtered)).toHaveLength(
      Object.keys(defaultRegistry).length
    )
  })

  it('returns an empty registry when all entries are invalid', () => {
    const data = {
      __backend_name: 'dealii',
      __version: 42,
    }

    const [filtered, skipped] = filterValidNodes(
      data as Record<string, unknown>
    )

    expect(skipped).toHaveLength(2)
    expect(Object.keys(filtered)).toHaveLength(0)
  })
})
