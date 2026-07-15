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
    await setRegistry({ Local: node('Local') }, 'local')
    await setRegistry({ Remote: node('Remote') }, 'remote')

    setActiveLocation('remote')
    expect(isNodeInRegistry('Remote')).toBe(true)
    expect(isNodeInRegistry('Local')).toBe(false)

    setActiveLocation('local')
    expect(isNodeInRegistry('Local')).toBe(true)
    expect(isNodeInRegistry('Remote')).toBe(false)
  })

  it('writes target an explicit location without moving the active cursor', async () => {
    await setRegistry({ RemoteOnly: node('RemoteOnly') }, 'remote')
    setActiveLocation('remote')
    // Writing 'local' must not change what the active ('remote') reads resolve to.
    await setRegistry({ LocalOnly: node('LocalOnly') }, 'local')
    expect(isNodeInRegistry('RemoteOnly')).toBe(true)
    expect(isNodeInRegistry('LocalOnly')).toBe(false)
  })

  it('merges into the given location without dropping existing nodes', async () => {
    await setRegistry({ A: node('A') }, 'local')
    await mergeRegistry({ B: node('B') }, 'local')

    setActiveLocation('local')
    const types = getAvailableNodes().map((n) => n.type)
    expect(types).toContain('A')
    expect(types).toContain('B')
  })
})
