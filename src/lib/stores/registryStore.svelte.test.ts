import { describe, it, expect } from 'vitest'
import {
  setActiveLocation,
  setRegistry,
  mergeRegistry,
  getAvailableNodes,
  isNodeInRegistry,
} from './registryStore.svelte'

const node = (type: string) => ({
  type,
  node_type: 'constructor',
  arguments: [],
  inputs: [],
  outputs: [-1],
})

describe('registryStore per-location isolation', () => {
  it('keeps each location registry independent', async () => {
    setActiveLocation('local')
    await setRegistry({ Local: node('Local') })

    setActiveLocation('remote')
    await setRegistry({ Remote: node('Remote') })

    expect(isNodeInRegistry('Remote')).toBe(true)
    expect(isNodeInRegistry('Local')).toBe(false)

    setActiveLocation('local')
    expect(isNodeInRegistry('Local')).toBe(true)
    expect(isNodeInRegistry('Remote')).toBe(false)
  })

  it('merges into the active location without dropping existing nodes', async () => {
    setActiveLocation('local')
    await setRegistry({ A: node('A') })
    await mergeRegistry({ B: node('B') })

    const types = getAvailableNodes().map((n) => n.type)
    expect(types).toContain('A')
    expect(types).toContain('B')
  })
})
