import { describe, it, expect } from 'vitest'
import defaultRegistry from '../data/defaultNodes.json'
import { filterValidNodes, registryBackend } from './registryValidator'

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

  it('keeps usable metadata keys out of the nodes without reporting them', () => {
    const data = {
      ...defaultRegistry,
      __backend_name: 'dealii',
      __backend: { id: 'coral', plugin: 'dealii' },
    }

    const [filtered, skipped] = filterValidNodes(
      data as Record<string, unknown>
    )

    expect(skipped).toEqual([])
    expect(filtered).not.toHaveProperty('__backend_name')
    expect(filtered).not.toHaveProperty('__backend')
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

  it('reports unusable metadata keys as skipped', () => {
    const data = {
      ...defaultRegistry,
      __backend_name: 42,
      __backend: { id: '/opt/coral' },
    }

    const [, skipped] = filterValidNodes(data as Record<string, unknown>)

    expect(skipped).toEqual(['__backend_name', '__backend'])
  })

  it('skips multiple non-compliant entries at once', () => {
    const data = {
      ...defaultRegistry,
      __backend_name: 42,
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
      __version: 42,
      broken: 'x',
    }

    const [filtered, skipped] = filterValidNodes(
      data as Record<string, unknown>
    )

    expect(skipped).toHaveLength(2)
    expect(Object.keys(filtered)).toHaveLength(0)
  })
})

describe('registryBackend', () => {
  it('reads id and plugin and ignores later fields', () => {
    expect(
      registryBackend({
        __backend: { id: 'coral', plugin: 'dealii', version: '2' },
      })
    ).toEqual({ id: 'coral', plugin: 'dealii' })
  })

  it('rejects a path or a malformed plugin', () => {
    expect(registryBackend({ __backend: { id: '/opt/coral' } })).toBeUndefined()
    expect(
      registryBackend({ __backend: { id: 'coral', plugin: 3 } })
    ).toBeUndefined()
    expect(registryBackend({})).toBeUndefined()
  })
})
