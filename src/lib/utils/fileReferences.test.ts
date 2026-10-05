import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  ConnectionType,
  NodeType,
  Type,
  type StandardNodeDefinition,
} from '../types/nodeTypes'

const registry = vi.hoisted(() => ({
  nodeDataByType: {} as Record<string, StandardNodeDefinition>,
}))

vi.mock('../stores/registryStore.svelte', () => ({
  getNodeData: vi.fn((type: string): StandardNodeDefinition => {
    const node = registry.nodeDataByType[type]
    if (!node) throw new Error(`Node type '${type}' was not found`)
    return structuredClone(node)
  }),
  isNodeInRegistry: vi.fn((type: string) => type in registry.nodeDataByType),
}))

import {
  buildRemoteStagedFileCommand,
  prepareGraphFileReferences,
  resolveGraphFileReferences,
  resolveParameterFileReferences,
} from './fileReferences'

const invoke = vi.fn()
vi.stubGlobal('window', { electron: { invoke } })

beforeEach(() => {
  invoke.mockReset()
  registry.nodeDataByType = {}
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

const stagedTarget = (createIfMissing = false): StandardNodeDefinition => ({
  type: 'ParameterAcceptor::initialize',
  arguments: [
    {
      connection_type: ConnectionType.INPUT,
      name: 'parameters',
      type: Type.STRING,
      file_scope: 'working',
      staging: 'copy',
      create_if_missing: createIfMissing,
    },
  ],
  inputs: [0],
  outputs: [],
  node_type: NodeType.VOID_FUNCTION,
})

const stagedGraph = (value = 'configs/parameters.prm') => ({
  workflow: {
    edges: {
      '0': { source: 1, source_output: 0, target: 2, target_input: 0 },
    },
    nodes: {
      '1': { type: 'std::string', value },
      '2': { type: 'ParameterAcceptor::initialize' },
    },
  },
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

describe('prepareGraphFileReferences', () => {
  it('keeps ordinary existing files absolute and ordinary strings unchanged', async () => {
    stubLocalFiles(['/work/mesh.vtu'])
    const graph = {
      workflow: {
        edges: {},
        nodes: {
          '1': { type: 'std::string', value: 'mesh.vtu' },
          '2': { type: 'std::string', value: 'not-a-file' },
        },
      },
    }

    const result = await prepareGraphFileReferences(
      graph,
      'local',
      '/work',
      '/work/run-42'
    )

    expect(result.workflow.nodes['1'].value).toBe('/work/mesh.vtu')
    expect(result.workflow.nodes['2'].value).toBe('not-a-file')
  })

  it('copies an existing staged file locally and keeps its relative graph path', async () => {
    registry.nodeDataByType = {
      'ParameterAcceptor::initialize': stagedTarget(),
    }
    const copyCalls: unknown[] = []
    invoke.mockImplementation(
      async (channel: string, payload: Record<string, unknown>) => {
        if (channel === 'find-existing-local-files') {
          return ['/work/configs/parameters.prm']
        }
        if (channel === 'stage-local-files') {
          copyCalls.push(payload.files)
          return undefined
        }
        throw new Error(channel)
      }
    )

    const result = await prepareGraphFileReferences(
      stagedGraph(),
      'local',
      '/work',
      '/work/run-42'
    )

    expect(result.workflow.nodes['1'].value).toBe('configs/parameters.prm')
    expect(copyCalls).toEqual([
      [
        {
          sourcePath: '/work/configs/parameters.prm',
          destinationPath: '/work/run-42/configs/parameters.prm',
        },
      ],
    ])
  })

  it('uses explicit graph metadata on a parameter filename when the registry is generic', async () => {
    const copyCalls: unknown[] = []
    invoke.mockImplementation(
      async (channel: string, payload: Record<string, unknown>) => {
        if (channel === 'find-existing-local-files') {
          return ['/work/configs/parameters.prm']
        }
        if (channel === 'stage-local-files') {
          copyCalls.push(payload.files)
          return undefined
        }
        throw new Error(channel)
      }
    )
    const graph = stagedGraph() as any
    graph.workflow.nodes['1'].working_file = {
      create_if_missing: true,
    }

    const result = await prepareGraphFileReferences(
      graph,
      'local',
      '/work',
      '/work/run-42'
    )

    expect(result.workflow.nodes['1'].value).toBe('configs/parameters.prm')
    expect(result.workflow.nodes['1'].working_file).toBeUndefined()
    expect(copyCalls).toEqual([
      [
        {
          sourcePath: '/work/configs/parameters.prm',
          destinationPath: '/work/run-42/configs/parameters.prm',
        },
      ],
    ])
  })

  it('uses the absolute working path for a missing creatable file without creating a placeholder', async () => {
    registry.nodeDataByType = {
      'ParameterAcceptor::initialize': stagedTarget(true),
    }
    const channels: string[] = []
    invoke.mockImplementation(
      async (channel: string, payload: Record<string, unknown>) => {
        channels.push(channel)
        if (channel === 'find-existing-local-files') return []
        throw new Error(channel)
      }
    )

    const result = await prepareGraphFileReferences(
      stagedGraph(),
      'local',
      '/work',
      '/work/run-42'
    )

    expect(result.workflow.nodes['1'].value).toBe(
      '/work/configs/parameters.prm'
    )
    expect(channels).toEqual(['find-existing-local-files'])
  })

  it('rejects a missing non-creatable staged file before execution', async () => {
    registry.nodeDataByType = {
      'ParameterAcceptor::initialize': stagedTarget(),
    }
    stubLocalFiles([])

    await expect(
      prepareGraphFileReferences(
        stagedGraph(),
        'local',
        '/work',
        '/work/run-42'
      )
    ).rejects.toThrow(
      'Staged working file is missing and create_if_missing is false: /work/configs/parameters.prm'
    )
  })

  it('preserves nested paths and copies the same staged file only once', async () => {
    registry.nodeDataByType = {
      'ParameterAcceptor::initialize': stagedTarget(),
    }
    const copyCalls: unknown[] = []
    invoke.mockImplementation(
      async (channel: string, payload: Record<string, unknown>) => {
        if (channel === 'find-existing-local-files') {
          return ['/work/bulk/parameters.prm']
        }
        if (channel === 'stage-local-files') {
          copyCalls.push(payload.files)
          return undefined
        }
        throw new Error(channel)
      }
    )
    const graph = {
      workflow: {
        edges: {
          a: { source: 1, source_output: 0, target: 3, target_input: 0 },
          b: { source: 2, source_output: 0, target: 3, target_input: 0 },
        },
        nodes: {
          '1': { type: 'std::string', value: 'bulk/parameters.prm' },
          '2': { type: 'std::string', value: 'bulk/parameters.prm' },
          '3': { type: 'ParameterAcceptor::initialize' },
        },
      },
    }

    const result = await prepareGraphFileReferences(
      graph,
      'local',
      '/work',
      '/work/run-42'
    )

    expect(result.workflow.nodes['1'].value).toBe('bulk/parameters.prm')
    expect(result.workflow.nodes['2'].value).toBe('bulk/parameters.prm')
    expect(copyCalls).toEqual([
      [
        {
          sourcePath: '/work/bulk/parameters.prm',
          destinationPath: '/work/run-42/bulk/parameters.prm',
        },
      ],
    ])
  })

  it('recurses into nested subnetworks', async () => {
    registry.nodeDataByType = {
      'ParameterAcceptor::initialize': stagedTarget(),
    }
    const copyCalls: unknown[] = []
    invoke.mockImplementation(
      async (channel: string, payload: Record<string, unknown>) => {
        if (channel === 'find-existing-local-files') {
          return ['/work/configs/parameters.prm']
        }
        if (channel === 'stage-local-files') {
          copyCalls.push(payload.files)
          return undefined
        }
        throw new Error(channel)
      }
    )
    const graph = {
      workflow: {
        edges: {},
        nodes: {
          '10': {
            type: 'coral::Network',
            value: stagedGraph(),
          },
        },
      },
    }

    const result = await prepareGraphFileReferences(
      graph,
      'local',
      '/work',
      '/work/run-42'
    )

    expect(result.workflow.nodes['10'].value.workflow.nodes['1'].value).toBe(
      'configs/parameters.prm'
    )
    expect(copyCalls).toHaveLength(1)
  })

  it('stages an existing file remotely without uploading its contents', async () => {
    registry.nodeDataByType = {
      'ParameterAcceptor::initialize': stagedTarget(),
    }
    const commands: string[] = []
    invoke.mockImplementation(
      async (channel: string, payload: Record<string, unknown>) => {
        if (channel !== 'execute-ssh-with-key') throw new Error(channel)
        const command = String(payload.command)
        commands.push(command)
        if (command.startsWith('for p in')) {
          return '/work/configs/parameters.prm\n'
        }
        return ''
      }
    )

    const result = await prepareGraphFileReferences(
      stagedGraph(),
      'remote',
      '/work',
      '/work/run-42'
    )

    expect(result.workflow.nodes['1'].value).toBe('configs/parameters.prm')
    expect(commands).toHaveLength(2)
    expect(commands[1]).toContain(
      "cp -- '/work/configs/parameters.prm' '/work/run-42/configs/parameters.prm'"
    )
  })

  it('quotes every remote staging path safely', () => {
    expect(
      buildRemoteStagedFileCommand([
        {
          sourcePath: "/work/user's/config.prm",
          destinationPath: '/work/run 42/configs/config.prm',
        },
      ])
    ).toBe(
      "mkdir -p '/work/run 42/configs' && cp -- '/work/user'\\''s/config.prm' '/work/run 42/configs/config.prm'"
    )
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
})
