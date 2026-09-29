import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  resolveGraphFileReferences,
  resolveParameterFileReferences,
} from './fileReferences'

const invoke = vi.fn()
vi.stubGlobal('window', { electron: { invoke } })

beforeEach(() => {
  invoke.mockReset()
})

/** Answers the local file check with the subset of requested paths in `existing`. */
const stubLocalFiles = (existing: string[]) => {
  invoke.mockImplementation(
    async (channel: string, { paths }: { paths: string[] }) => {
      if (channel !== 'find-existing-local-files') throw new Error(channel)
      return paths.filter((path) => existing.includes(path))
    }
  )
}

const leaf = (value: string) => ({
  value,
  default_value: value,
  documentation: value,
  pattern: '.*',
  pattern_description: '[Anything]',
})

describe('resolveGraphFileReferences', () => {
  it('resolves literal node values naming existing files, including inside subnetworks', async () => {
    stubLocalFiles(['/work/mesh.vtu', '/work/data/table.csv'])

    const result = await resolveGraphFileReferences(
      {
        plugin: { MPI: { enabled: true } },
        workflow: {
          edges: {},
          nodes: {
            '1': { type: 'std::string', value: 'mesh.vtu' },
            '2': { type: 'std::string', value: 'solution.vtu' },
            '3': {
              type: 'coral::Network',
              name: 'sub',
              value: {
                workflow: {
                  edges: {},
                  nodes: {
                    '1': { type: 'std::string', value: 'data/table.csv' },
                  },
                },
              },
            },
          },
        },
      },
      'local',
      '/work/'
    )

    expect(result).toEqual({
      plugin: { MPI: { enabled: true } },
      workflow: {
        edges: {},
        nodes: {
          '1': { type: 'std::string', value: '/work/mesh.vtu' },
          '2': { type: 'std::string', value: 'solution.vtu' },
          '3': {
            type: 'coral::Network',
            name: 'sub',
            value: {
              workflow: {
                edges: {},
                nodes: {
                  '1': { type: 'std::string', value: '/work/data/table.csv' },
                },
              },
            },
          },
        },
      },
    })
  })

  it('never rewrites structural fields, even when they name an existing file', async () => {
    stubLocalFiles(['/work/Triangulation'])

    const result = await resolveGraphFileReferences(
      { workflow: { edges: {}, nodes: { '1': { type: 'Triangulation' } } } },
      'local',
      '/work'
    )

    expect(result.workflow.nodes['1']).toEqual({ type: 'Triangulation' })
    expect(invoke).not.toHaveBeenCalled()
  })

  it('checks every candidate remotely in a single SSH command', async () => {
    invoke.mockResolvedValue('/remote/mesh.vtu\nsome login banner\n')

    const result = await resolveGraphFileReferences(
      {
        workflow: {
          edges: {},
          nodes: {
            '1': { type: 'std::string', value: 'mesh.vtu' },
            '2': { type: 'std::string', value: 'out.vtu' },
            '3': { type: 'std::string', value: 'mesh.vtu' },
          },
        },
      },
      'remote',
      '/remote'
    )

    expect(invoke).toHaveBeenCalledOnce()
    const { command } = invoke.mock.calls[0][1]
    expect(command).toContain(`'/remote/mesh.vtu' '/remote/out.vtu';`)
    expect(result.workflow.nodes['1'].value).toBe('/remote/mesh.vtu')
    expect(result.workflow.nodes['2'].value).toBe('out.vtu')
    expect(result.workflow.nodes['3'].value).toBe('/remote/mesh.vtu')
  })

  it('skips the check for absolute paths, empty values, and no working directory', async () => {
    const graph = {
      workflow: {
        edges: {},
        nodes: {
          '1': { type: 'std::string', value: '/abs/mesh.vtu' },
          '2': { type: 'std::string', value: '' },
        },
      },
    }

    expect(await resolveGraphFileReferences(graph, 'local', '/work')).toEqual(
      graph
    )
    const relative = {
      workflow: {
        edges: {},
        nodes: { '1': { type: 'std::string', value: 'mesh.vtu' } },
      },
    }
    expect(await resolveGraphFileReferences(relative, 'local', ' ')).toEqual(
      relative
    )
    expect(invoke).not.toHaveBeenCalled()
  })
})

describe('resolveParameterFileReferences', () => {
  it('resolves only leaf values, recursing into subsections', async () => {
    stubLocalFiles(['/work/mesh.vtu'])

    const result = await resolveParameterFileReferences(
      {
        'Grid generator': { 'Input file': leaf('mesh.vtu') },
        'Output file': leaf('solution.vtu'),
        __extra: true,
      },
      'local',
      '/work'
    )

    expect(result).toEqual({
      'Grid generator': {
        'Input file': { ...leaf('mesh.vtu'), value: '/work/mesh.vtu' },
      },
      'Output file': leaf('solution.vtu'),
      __extra: true,
    })
  })

  it('can preserve parameter-file names for the run-local staging step', async () => {
    const result = await resolveExistingFileReferences(
      { input: 'mesh.vtu', parameters: 'parameters.json' },
      (value) => `/work/${value}`,
      async () => true,
      (value) => !/\.(json|prm)$/i.test(value)
    )

    expect(result).toEqual({
      input: '/work/mesh.vtu',
      parameters: 'parameters.json',
    })
  })
})
