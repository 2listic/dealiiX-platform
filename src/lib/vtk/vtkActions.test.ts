import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findVtkVisualizerTarget: vi.fn(),
  getLatestRunWorkingDirectory: vi.fn(),
  openNewWindow: vi.fn(),
  addToast: vi.fn(),
}))

vi.mock('../stores/executionSelection.svelte', () => ({
  executionSelectionState: { location: 'remote' },
}))
vi.mock('../stores/jobsStore.svelte', () => ({
  jobIdMapState: {
    getLatestRunWorkingDirectory: mocks.getLatestRunWorkingDirectory,
  },
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
vi.mock('./vtkVisualizer', async () => ({
  ...(await vi.importActual<typeof import('./vtkVisualizerUrl')>(
    './vtkVisualizerUrl'
  )),
  findVtkVisualizerTarget: mocks.findVtkVisualizerTarget,
}))

import { openVtkFile } from './vtkActions'

describe('openVtkFile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getLatestRunWorkingDirectory.mockReturnValue('/work/run-1')
  })

  it('opens the visualizer on the file found at the active location', async () => {
    mocks.findVtkVisualizerTarget.mockResolvedValue({
      location: 'remote',
      workingDirectory: '/work',
      fileName: 'run-1/solution.pvd',
    })

    await openVtkFile('solution.pvd')

    expect(mocks.findVtkVisualizerTarget).toHaveBeenCalledWith(
      'remote',
      'solution.pvd',
      '/work/run-1'
    )
    const url = new URL(mocks.openNewWindow.mock.calls[0][0])
    expect(url.origin + url.pathname).toBe(
      'https://visualizer.example/api/open'
    )
    expect(url.searchParams.get('working_directory')).toBe('/work')
    expect(url.searchParams.get('file')).toBe('run-1/solution.pvd')
    expect(mocks.addToast).not.toHaveBeenCalled()
  })

  it('reports a file found in neither directory in a toast', async () => {
    mocks.findVtkVisualizerTarget.mockResolvedValue(undefined)

    await openVtkFile('missing.pvd')

    expect(mocks.openNewWindow).not.toHaveBeenCalled()
    expect(mocks.addToast).toHaveBeenCalledWith({
      message:
        'VTK file is not available in the working directory or the last run directory',
      type: 'error',
    })
  })
})
