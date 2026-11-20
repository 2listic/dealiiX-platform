import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  parameterFileExists: vi.fn(),
  parameterFileTarget: vi.fn((location: string, fileName: string) => ({
    location,
    workingDirectory: '/work',
    fileName,
  })),
  openNewWindow: vi.fn(),
  addToast: vi.fn(),
}))

vi.mock('../stores/executionSelection.svelte', () => ({
  executionSelectionState: { location: 'remote' },
}))
vi.mock('../stores/settingsStore.svelte', () => ({
  settingsState: { urlVisualizer: 'https://visualizer.example' },
}))
vi.mock('../stores/toastsStore.svelte', () => ({
  toastState: { add: mocks.addToast },
}))
vi.mock('../execution/sshMessages', () => ({
  openNewWindow: mocks.openNewWindow,
}))
vi.mock('../parameters/parameterFileAccess', () => ({
  parameterFileExists: mocks.parameterFileExists,
  parameterFileTarget: mocks.parameterFileTarget,
}))

import { openVtkFile } from './vtkActions'

describe('openVtkFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('opens the visualizer on the file of the working directory', async () => {
    mocks.parameterFileExists.mockResolvedValue(true)

    await openVtkFile('run-1/solution.pvd')

    expect(mocks.parameterFileTarget).toHaveBeenCalledWith(
      'remote',
      'run-1/solution.pvd'
    )
    expect(mocks.parameterFileExists).toHaveBeenCalledTimes(1)
    const url = new URL(mocks.openNewWindow.mock.calls[0][0])
    expect(url.origin + url.pathname).toBe(
      'https://visualizer.example/api/open'
    )
    expect(url.searchParams.get('working_directory')).toBe('/work')
    expect(url.searchParams.get('file')).toBe('run-1/solution.pvd')
    expect(mocks.addToast).not.toHaveBeenCalled()
  })

  it('reports a file missing from the working directory in a toast', async () => {
    mocks.parameterFileExists.mockResolvedValue(false)

    await openVtkFile('missing.pvd')

    expect(mocks.openNewWindow).not.toHaveBeenCalled()
    expect(mocks.addToast).toHaveBeenCalledWith({
      message: 'VTK file is not available in the working directory',
      type: 'error',
    })
  })
})
