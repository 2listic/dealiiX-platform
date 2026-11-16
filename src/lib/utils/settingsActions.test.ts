import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ExecutionSettings } from '../types/settingsTypes'
import { probeAndSaveExecution } from './settingsActions'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  saveExecutionPaths: vi.fn(),
  recordProbe: vi.fn(),
  setRegistry: vi.fn(),
  addToast: vi.fn(),
}))

vi.mock('../stores/parametersStore.svelte', () => ({
  setValueFor: vi.fn(),
}))
vi.mock('../stores/registryStore.svelte', () => ({
  setRegistry: mocks.setRegistry,
}))
vi.mock('../stores/settingsStore.svelte', () => ({
  settingsState: {
    saveExecutionPaths: mocks.saveExecutionPaths,
    recordProbe: mocks.recordProbe,
  },
}))
vi.mock('../stores/toastsStore.svelte', () => ({
  toastState: { add: mocks.addToast },
}))
vi.mock('./parametersFileActions', () => ({
  mergeWorkingDirectoryParameters: vi.fn(),
}))

describe('probeAndSaveExecution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.invoke.mockResolvedValue({
      status: { outcome: 'success', message: 'Configuration synced.' },
      metadata: { kind: 'nodeRegistry', data: {} },
    })
    mocks.saveExecutionPaths.mockResolvedValue(undefined)
    mocks.recordProbe.mockResolvedValue(undefined)
    mocks.setRegistry.mockResolvedValue(['invalid_one', 'invalid_two'])
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { electron: { invoke: mocks.invoke, store: {} } },
    })
  })

  it('reports skipped registry nodes in one aggregate notification', async () => {
    await probeAndSaveExecution(
      'remote',
      'coral',
      {} as ExecutionSettings
    )

    expect(mocks.setRegistry).toHaveBeenCalledWith({}, 'remote')
    expect(mocks.addToast).toHaveBeenCalledTimes(1)
    expect(mocks.addToast).toHaveBeenCalledWith({
      message: 'Skipped 2 invalid registry nodes during Validate & Sync.',
      type: 'error',
    })
  })

  it('does not report when every registry node is valid', async () => {
    mocks.setRegistry.mockResolvedValue([])

    await probeAndSaveExecution(
      'remote',
      'coral',
      {} as ExecutionSettings
    )

    expect(mocks.addToast).not.toHaveBeenCalled()
  })
})
