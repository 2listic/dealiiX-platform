import { describe, it, expect } from 'vitest'
import { executionSelectionState } from './executionSelection.svelte'

describe('executionSelectionState', () => {
  it('defaults to remote/coral and derives the mode flags', () => {
    expect(executionSelectionState.location).toBe('remote')
    expect(executionSelectionState.backendKind).toBe('coral')
    expect(executionSelectionState.isCoralMode).toBe(true)
    expect(executionSelectionState.isExecutableMode).toBe(false)
  })

  it('updates location and backend kind independently', async () => {
    await executionSelectionState.setLocation('local')
    await executionSelectionState.setBackendKind('executable')

    expect(executionSelectionState.location).toBe('local')
    expect(executionSelectionState.backendKind).toBe('executable')
    expect(executionSelectionState.isExecutableMode).toBe(true)
    expect(executionSelectionState.isCoralMode).toBe(false)
  })
})
