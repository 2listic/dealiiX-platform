import { describe, it, expect } from 'vitest'
import type { ParameterTree } from '../types/parameterTypes'
import { parametersState, setActiveLocation } from './parametersStore.svelte'

const tree = (value: string): ParameterTree =>
  ({ Section: { field: { value } } }) as unknown as ParameterTree

describe('parametersStore per-location isolation', () => {
  it('resolves value/snapshot against the active location', () => {
    setActiveLocation('local')
    parametersState.value = tree('local-val')

    setActiveLocation('remote')
    expect(parametersState.value).toBeNull()
    parametersState.value = tree('remote-val')

    setActiveLocation('local')
    expect(parametersState.snapshot).toEqual(tree('local-val'))

    setActiveLocation('remote')
    expect(parametersState.snapshot).toEqual(tree('remote-val'))
  })
})
