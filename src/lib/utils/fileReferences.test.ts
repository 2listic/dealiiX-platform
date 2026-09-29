import { describe, expect, it } from 'vitest'
import { resolveExistingFileReferences } from './fileReferences'

describe('resolveExistingFileReferences', () => {
  it('resolves existing files recursively and leaves other strings unchanged', async () => {
    const existing = new Set(['/work/input.vtu', '/work/data/table.csv'])

    const result = await resolveExistingFileReferences(
      {
        graph: {
          input: 'input.vtu',
          missing: 'solution.vtu',
          nested: ['data/table.csv', 4],
        },
      },
      (value) => `/work/${value}`,
      async (filePath) => existing.has(filePath)
    )

    expect(result).toEqual({
      graph: {
        input: '/work/input.vtu',
        missing: 'solution.vtu',
        nested: ['/work/data/table.csv', 4],
      },
    })
  })

  it('checks a repeated path only once', async () => {
    const checked: string[] = []

    await resolveExistingFileReferences(
      { first: 'mesh.vtu', second: 'mesh.vtu' },
      (value) => `/work/${value}`,
      async (filePath) => {
        checked.push(filePath)
        return true
      }
    )

    expect(checked).toEqual(['/work/mesh.vtu'])
  })
})
