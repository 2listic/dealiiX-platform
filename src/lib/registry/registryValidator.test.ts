import { protocolErrors } from '../testing/protocolSchemas'
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

  it('ignores metadata keys without reporting them', () => {
    const data = {
      ...defaultRegistry,
      __backend_name: 'dealii',
      __backend: { id: 'coral', version: '1' },
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

  it('skips multiple non-compliant entries at once', () => {
    const data = {
      ...defaultRegistry,
      backend_name: 'dealii',
      version: 42,
      missing_fields: { node_type: 'constructor' },
    }

    const [filtered, skipped] = filterValidNodes(
      data as Record<string, unknown>
    )

    expect(skipped).toHaveLength(3)
    expect(skipped).toContain('backend_name')
    expect(skipped).toContain('version')
    expect(skipped).toContain('missing_fields')
    expect(Object.keys(filtered)).toHaveLength(
      Object.keys(defaultRegistry).length
    )
  })

  it('returns an empty registry when all entries are invalid', () => {
    const data = {
      backend_name: 'dealii',
      version: 42,
    }

    const [filtered, skipped] = filterValidNodes(
      data as Record<string, unknown>
    )

    expect(skipped).toHaveLength(2)
    expect(Object.keys(filtered)).toHaveLength(0)
  })
})

describe('registryBackend', () => {
  it('returns the __backend header', () => {
    const header = {
      id: 'dealiix.mock',
      version: '1',
      registry_digest: `sha256:${'0'.repeat(64)}`,
      operations: ['register', 'validate', 'run'],
    }

    expect(registryBackend({ ...defaultRegistry, __backend: header })).toEqual(
      header
    )
  })

  it('keeps the logical identity while excluding backend configuration and capabilities', () => {
    const registry = {
      __backend: {
        id: 'coral',
        plugin: 'dealii',
        configuration: {},
        capabilities: { actions: ['configure'] },
      },
    }
    expect(registryBackend(registry)).toEqual({ id: 'coral', plugin: 'dealii' })
    expect(protocolErrors('registry', registry)).toEqual([])
    expect(
      filterValidNodes({ __backend: { id: '/path/to/coral' } })[1]
    ).toEqual(['__backend'])
  })

  it('returns undefined without a header or without an id', () => {
    expect(registryBackend(defaultRegistry)).toBeUndefined()
    expect(registryBackend({ __backend: { version: '1' } })).toBeUndefined()
    expect(registryBackend({ __backend: 'coral' })).toBeUndefined()
  })
})
