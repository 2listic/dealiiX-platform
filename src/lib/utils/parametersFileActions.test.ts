import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ParameterTree } from '../types/parameterTypes'

const readParameterFile = vi.fn()
vi.mock('./parameterFileAccess', () => ({
  parameterFileTarget: vi.fn(),
  readParameterFile: (...args: unknown[]) => readParameterFile(...args),
  writeParameterFile: vi.fn(),
}))
vi.mock('../stores/settingsStore.svelte', () => ({ settingsState: {} }))

const { mergeWorkingDirectoryParameters } = await import(
  './parametersFileActions'
)

const leaf = (value: string) => ({
  value,
  default_value: '1',
  documentation: 'Number of refinements.',
  pattern: '[0-9]+',
  pattern_description: '[Integer]',
})

const template: ParameterTree = { Mesh: { Refinements: leaf('1') } }

describe('mergeWorkingDirectoryParameters', () => {
  beforeEach(() => readParameterFile.mockReset())

  it('reads the first candidate that exists and keeps template metadata', async () => {
    readParameterFile
      .mockRejectedValueOnce(new Error('Parameter file not found'))
      .mockResolvedValueOnce({
        resolvedPath: '/wd/parameters.prm',
        content: 'subsection Mesh\n  set Refinements = 4\nend\n',
      })

    const result = await mergeWorkingDirectoryParameters(
      'remote',
      '/wd',
      ['parameters.json', 'parameters.prm'],
      template
    )

    expect(readParameterFile).toHaveBeenCalledTimes(2)
    expect(result?.resolvedPath).toBe('/wd/parameters.prm')
    expect(result?.parameters).toEqual({ Mesh: { Refinements: leaf('4') } })
  })

  it('keeps keys missing from the template, flagged as extra', async () => {
    readParameterFile.mockResolvedValueOnce({
      resolvedPath: '/wd/parameters.json',
      content: JSON.stringify({
        Mesh: { Refinements: leaf('2') },
        Output: { Folder: leaf('out') },
      }),
    })

    const result = await mergeWorkingDirectoryParameters(
      'local',
      '/wd',
      ['parameters.json'],
      template
    )

    expect(result?.parameters.Output).toMatchObject({
      __extra: true,
      Folder: { value: 'out', __extra: true },
    })
  })

  it('returns null when no candidate can be read, trying each name once', async () => {
    // Once: a second read of the same name would get undefined and throw.
    readParameterFile.mockRejectedValueOnce(
      new Error('Parameter file not found')
    )

    const result = await mergeWorkingDirectoryParameters(
      'local',
      '/wd',
      ['parameters.json', 'parameters.json', ''],
      template
    )

    expect(result).toBeNull()
    expect(readParameterFile).toHaveBeenCalledTimes(1)
  })
})
