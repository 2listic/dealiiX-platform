import { describe, it, expect } from 'vitest'
import {
  setRegistry,
  setServiceRegistry,
  mergeRegistry,
  getAvailableNodes,
  getNodeData,
  getRegistryBackend,
  isNodeInRegistry,
} from './registryStore.svelte'

const node = (type: string) => ({
  type,
  node_type: 'constructor',
  arguments: [],
  inputs: [],
  outputs: [-1],
})

describe('the current graph registry', () => {
  it('resolves compiler spellings without rewriting registered identities', async () => {
    const registered =
      'Initialize parameters::std::function<void(dealii::ParameterAcceptor&,const std::__cxx11::basic_string<char>&)>'
    const imported =
      'Initialize parameters::std::function<void (dealii::ParameterAcceptor &, const std::string &)>'
    await setRegistry({ [registered]: node(registered) })
    expect(isNodeInRegistry(imported)).toBe(true)
    expect(getNodeData(imported).type).toBe(registered)
    expect(getAvailableNodes()).toHaveLength(1)
    await setRegistry({ Replacement: node('Replacement') })
    expect(isNodeInRegistry(imported)).toBe(false)
    expect(() => getNodeData(imported)).toThrow('not found')
  })

  it('prefers exact keys when canonical spellings collide', async () => {
    await setRegistry({
      'Value<2, 2>': node('Value<2, 2>'),
      'Value<2,2>': node('Value<2,2>'),
    })
    expect(getNodeData('Value<2,2>').type).toBe('Value<2,2>')
    expect(getNodeData('Value< 2, 2 >').type).toBe('Value<2, 2>')
  })

  it('merges imported standalone definitions with existing ones', async () => {
    await setRegistry({ A: node('A') })
    await mergeRegistry({ B: node('B') })
    const types = getAvailableNodes().map((n) => n.type)
    expect(types).toEqual(['A', 'B'])
  })

  it('uses the service response as the only root backend registry', async () => {
    await setRegistry({ Standalone: node('Standalone') })
    const identity = { id: 'root', plugin: 'plugin' }
    setServiceRegistry({ __backend: identity, Root: node('Root') })

    expect(getRegistryBackend()).toEqual(identity)
    expect(getAvailableNodes().map(({ type }) => type)).toEqual(['Root'])

    await mergeRegistry({ Standalone2: node('Standalone2') })
    expect(getAvailableNodes().map(({ type }) => type)).toEqual(['Root'])

    setServiceRegistry({ __backend: identity, Refreshed: node('Refreshed') })
    expect(getAvailableNodes().map(({ type }) => type)).toEqual(['Refreshed'])
  })
})
