import { beforeEach, describe, expect, it, vi } from 'vitest'

const access = vi.hoisted(() => ({
  parameterFileExists: vi.fn(),
  parameterFileTarget: vi.fn((location: string, fileName: string) => ({
    location,
    workingDirectory: '/configured/workspace',
    fileName,
  })),
}))

vi.mock('./parameterFileAccess', () => access)

import { findVtkVisualizerTarget } from './vtkVisualizer'
import { buildVtkVisualizerUrl } from './vtkVisualizerUrl'

describe('VTK visualizer deep links', () => {
  beforeEach(() => {
    access.parameterFileExists.mockReset()
  })

  it('passes the working directory and relative file to the visualizer', () => {
    const target = {
      workingDirectory: '/remote/workspace',
      fileName: 'results/solution.pvd',
    }
    const url = new URL(
      buildVtkVisualizerUrl('https://visualizer.example/my-app', target)
    )

    expect(url.pathname).toBe('/my-app/api/open')
    expect(url.searchParams.get('working_directory')).toBe(
      target.workingDirectory
    )
    expect(url.searchParams.get('file')).toBe('results/solution.pvd')
  })

  it('rejects absolute and escaping file names', () => {
    const target = {
      location: 'local' as const,
      workingDirectory: '/tmp/work',
      fileName: '../solution.vtu',
    }
    expect(() =>
      buildVtkVisualizerUrl('http://localhost:8008', target)
    ).toThrow(/remain inside/)
  })

  it('maps a file in the latest nested run directory to the visualizer root', async () => {
    access.parameterFileExists.mockImplementation(
      async (target: { workingDirectory: string }) =>
        target.workingDirectory === '/configured/workspace/run-2'
    )

    const target = await findVtkVisualizerTarget(
      'remote',
      'results/solution.pvd',
      '/configured/workspace/run-2'
    )

    expect(access.parameterFileExists).toHaveBeenCalledTimes(2)
    expect(target).toEqual({
      location: 'remote',
      workingDirectory: '/configured/workspace',
      fileName: 'run-2/results/solution.pvd',
    })
  })

  it('does not create a visualizer link for a run outside the configured root', async () => {
    access.parameterFileExists.mockImplementation(
      async (target: { workingDirectory: string }) =>
        target.workingDirectory === '/other/run-2'
    )

    const target = await findVtkVisualizerTarget(
      'remote',
      'results/solution.pvd',
      '/other/run-2'
    )

    expect(target).toBeUndefined()
  })
})
