import { describe, expect, it } from 'vitest'
import { buildVtkVisualizerUrl } from './vtkVisualizerUrl'

describe('VTK visualizer deep links', () => {
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
})
