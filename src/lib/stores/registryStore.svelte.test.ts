import { describe, it, expect } from 'vitest'
import {
  setActiveLocation,
  setRegistry,
  mergeRegistry,
  getAvailableNodes,
  getNodeData,
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
  it('resolves compiler spellings without rewriting registered identities', async () => {
    const registered =
      'Initialize parameters::std::function<void(dealii::ParameterAcceptor&,const std::__cxx11::basic_string<char>&)>'
    const imported =
      'Initialize parameters::std::function<void (dealii::ParameterAcceptor &, const std::string &)>'
    await setRegistry({ [registered]: node(registered) }, 'local')
    await setRegistry({ Remote: node('Remote') }, 'remote')
    setActiveLocation('local')
    expect(isNodeInRegistry(imported)).toBe(true)
    expect(getNodeData(imported).type).toBe(registered)
    expect(getAvailableNodes()).toHaveLength(1)
    setActiveLocation('remote')
    expect(isNodeInRegistry(imported)).toBe(false)
    expect(() => getNodeData(imported)).toThrow('not found')
    await mergeRegistry({ [registered]: node(registered) }, 'remote')
    expect(getNodeData(imported).type).toBe(registered)
    await setRegistry({ Replacement: node('Replacement') }, 'remote')
    expect(isNodeInRegistry(imported)).toBe(false)
  })

  it('prefers exact keys when canonical spellings collide', async () => {
    await setRegistry(
      { 'Value<2, 2>': node('Value<2, 2>'), 'Value<2,2>': node('Value<2,2>') },
      'local'
    )
    setActiveLocation('local')
    expect(getNodeData('Value<2,2>').type).toBe('Value<2,2>')
    expect(getNodeData('Value< 2, 2 >').type).toBe('Value<2, 2>')
  })

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
