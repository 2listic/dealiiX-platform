import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  Network,
  NetworkEdge,
  ParameterExposure,
  ParameterPortType,
  QualifiedNetwork,
} from '../types/nodeTypes'

// The submit path imports `.svelte.ts` stores that read `window.electron` at
// module init, so the global must exist before the dynamic imports below.
vi.stubGlobal('window', {
  electron: {
    invoke: vi.fn(),
    store: {
      get: vi.fn(async (_key: string, defaultValue: unknown) => defaultValue),
      set: vi.fn(async () => true),
      remove: vi.fn(async () => true),
    },
  },
})

// Parameter files live in an in-memory file system keyed by absolute path:
// sources under /work, run copies under /run.
const files = vi.hoisted(() => new Map<string, string>())

vi.mock('../utils/parameterFileAccess', () => ({
  normalizeRelativeParameterPath: (fileName: string) => fileName,
  parameterFileTarget: (location: string, fileName: string) => ({
    location,
    workingDirectory: '/work',
    fileName,
  }),
  readParameterFile: async (target: {
    workingDirectory: string
    fileName: string
  }) => {
    const path = `${target.workingDirectory}/${target.fileName}`
    const content = files.get(path)
    if (content === undefined) throw new Error(`${path} not found`)
    return { resolvedPath: path, content }
  },
  writeParameterFile: async (
    target: { workingDirectory: string; fileName: string },
    content: string
  ) => {
    files.set(`${target.workingDirectory}/${target.fileName}`, content)
  },
}))

vi.mock('../utils/fileReferences', () => ({
  resolveParameterFileReferences: async (tree: unknown) => tree,
  resolveGraphFileReferences: async (graph: unknown) => graph,
}))

const { materializeProtocolGraphIfNeeded } = await import(
  '../utils/sshMessages'
)
const { addQualifiedIds, edgesFromProtocolToFlow, nodesFromProtocolToFlow } =
  await import('../utils/graphParser')
const { createNetworkNodeDefinition } = await import('../utils/networkNode')
const { parameterHandle } = await import('../utils/parameterPorts')
const { addNetworkNode, mergeRegistry, removeNetworkNode } = await import(
  '../stores/registryStore.svelte'
)

type Nodes = Network['workflow']['nodes']

const RUN = '/run'

/** Materializes a submitted graph (saved form, qualified ids) into `/run`. */
const materialize = async (network: Network): Promise<QualifiedNetwork> =>
  (await materializeProtocolGraphIfNeeded(
    addQualifiedIds(network),
    'remote',
    {},
    RUN
  )) as QualifiedNetwork

const network = (nodes: Nodes, edges: NetworkEdge[] = []): Network =>
  ({
    workflow: { nodes, edges: Object.fromEntries(edges.entries()) },
  }) as Network

const literal = (type: string, value: string) => ({ type, value })

const parameterFile = (value: string, exposures: ParameterExposure[]) => ({
  type: 'std::string',
  value,
  parameter_file: { exposures },
})

const exposure = (
  path: string[],
  type: ParameterPortType,
  direction: 'input' | 'output' | 'both'
): ParameterExposure => ({
  path,
  type,
  input: direction !== 'output',
  output: direction !== 'input',
})

/** An edge between backend ports (numbers) or parameter ports (paths). */
const connect = (
  source: number,
  output: number | string[],
  target: number,
  input: number | string[]
): NetworkEdge => ({
  source,
  target,
  ...(Array.isArray(output)
    ? { source_handle: parameterHandle('output', output) }
    : { source_output: output }),
  ...(Array.isArray(input)
    ? { target_handle: parameterHandle('input', input) }
    : { target_input: input }),
})

/**
 * Builds a subnetwork node the way the canvas does when collapsing a
 * selection, and registers it unless `register` is false.
 */
const subnetwork = async (name: string, inner: Network, register = true) => {
  const definition = createNetworkNodeDefinition(
    name,
    nodesFromProtocolToFlow(inner.workflow.nodes),
    edgesFromProtocolToFlow(inner.workflow.edges)
  )
  if (register) await addNetworkNode(name, definition)
  const { is_valid: _isValid, ...node } = definition
  return node
}

const edgesOf = (result: Network | QualifiedNetwork) =>
  Object.values(result.workflow.edges)

const prm = (entries: Record<string, string>) =>
  Object.entries(entries)
    .map(([key, value]) => `set ${key} = ${value}\n`)
    .join('')

beforeAll(async () => {
  // Let the registry finish its startup load before adding to it.
  await new Promise((resolve) => setTimeout(resolve, 0))
  await mergeRegistry(
    {
      consume_double: {
        type: 'consume_double',
        node_type: 'void_function',
        arguments: [
          { name: 'value', type: 'double', connection_type: 'input' },
        ],
        inputs: [0],
        outputs: [],
      },
    },
    'remote'
  )
})

beforeEach(() => {
  files.clear()
})

describe('parameter materialization at submit', () => {
  it('returns a graph without parameter files unchanged', async () => {
    const graph = addQualifiedIds(network({ '0': literal('double', '1.5') }))

    expect(
      await materializeProtocolGraphIfNeeded(graph, 'remote', {}, RUN)
    ).toBe(graph)
  })

  it('writes bound inputs into a run copy and turns used outputs into literals', async () => {
    files.set('/work/a.prm', prm({ Refinement: '1', Tolerance: '1e-3' }))

    const result = await materialize(
      network(
        {
          '0': parameterFile('a.prm', [
            exposure(['Refinement'], 'int', 'input'),
            exposure(['Tolerance'], 'double', 'output'),
          ]),
          '1': literal('int', '4'),
          '2': { type: 'consume_double' },
        },
        [connect(1, 0, 0, ['Refinement']), connect(0, ['Tolerance'], 2, 0)]
      )
    )

    expect(files.get('/run/a.prm')).toMatch(/set Refinement\s*=\s*4/)
    expect(files.get('/work/a.prm')).toMatch(/set Refinement\s*=\s*1/)
    expect(result.workflow.nodes['0']).toMatchObject({
      value: '/run/a.prm',
      qualified_id: '0',
    })
    const [synthetic] = Object.entries(result.workflow.nodes).filter(
      ([id]) => !['0', '1', '2'].includes(id)
    )
    expect(synthetic[1]).toMatchObject({ type: 'double', value: '1e-3' })
    expect(edgesOf(result)).toEqual([
      {
        source: Number(synthetic[0]),
        source_output: 0,
        target: 2,
        target_input: 0,
      },
    ])
    expect(JSON.stringify(result)).not.toMatch(
      /parameter_file|source_handle|target_handle/
    )
  })

  it('feeds a parameter output into another file', async () => {
    files.set('/work/a.prm', prm({ Size: '8' }))
    files.set('/work/b.prm', prm({ Size: '1' }))

    await materialize(
      network(
        {
          '0': parameterFile('a.prm', [exposure(['Size'], 'int', 'output')]),
          '1': parameterFile('b.prm', [exposure(['Size'], 'int', 'input')]),
        },
        [connect(0, ['Size'], 1, ['Size'])]
      )
    )

    expect(files.get('/run/b.prm')).toMatch(/set Size\s*=\s*8/)
  })

  it('binds a parent literal to a parameter input on a subnetwork boundary', async () => {
    files.set('/work/a.prm', prm({ Refinement: '1' }))
    const sub = await subnetwork(
      'boundary input',
      network({
        '0': parameterFile('a.prm', [exposure(['Refinement'], 'int', 'input')]),
      })
    )

    const result = await materialize(
      network({ '0': literal('int', '4'), '1': sub }, [
        connect(
          0,
          0,
          1,
          sub.inputs.indexOf(
            sub.arguments.findIndex((a) => a.name === 'Refinement')
          )
        ),
      ])
    )

    expect(files.get('/run/a.prm')).toMatch(/set Refinement\s*=\s*4/)
    const materializedSub = result.workflow.nodes['1'] as typeof sub
    expect(materializedSub.inputs).toEqual([])
    expect(edgesOf(result)).toEqual([])
  })

  it('shares one run copy when two nodes bind the same file identically', async () => {
    files.set('/work/a.prm', prm({ Refinement: '1' }))

    const result = await materialize(
      network(
        {
          '0': parameterFile('a.prm', [
            exposure(['Refinement'], 'int', 'input'),
          ]),
          '1': parameterFile('a.prm', [
            exposure(['Refinement'], 'int', 'input'),
          ]),
          '2': literal('int', '4'),
        },
        [connect(2, 0, 0, ['Refinement']), connect(2, 0, 1, ['Refinement'])]
      )
    )

    expect(files.get('/run/a.prm')).toMatch(/set Refinement\s*=\s*4/)
    expect(result.workflow.nodes['0']).toMatchObject({ value: '/run/a.prm' })
    expect(result.workflow.nodes['1']).toMatchObject({ value: '/run/a.prm' })
  })

  it('rejects an exposed input with no connection', async () => {
    files.set('/work/a.prm', prm({ Refinement: '1' }))

    await expect(
      materialize(
        network({
          '0': parameterFile('a.prm', [
            exposure(['Refinement'], 'int', 'input'),
          ]),
        })
      )
    ).rejects.toThrow(/requires exactly one input connection/)
  })

  it('rejects an exposed input fed by a value computed at runtime', async () => {
    files.set('/work/a.prm', prm({ Tolerance: '1' }))

    await expect(
      materialize(
        network(
          {
            '0': parameterFile('a.prm', [
              exposure(['Tolerance'], 'double', 'input'),
            ]),
            '1': { type: 'consume_double' },
          },
          [
            {
              source: 1,
              source_output: 0,
              target: 0,
              target_handle: parameterHandle('input', ['Tolerance']),
            },
          ]
        )
      )
    ).rejects.toThrow(/computed at runtime/)
  })

  // Known bugs, fixed by materializing on the protocol (decision 2).

  it.fails(
    'keeps parent edges on the right port when two boundary outputs share name and type',
    async () => {
      files.set('/work/a.prm', prm({ Refinement: '1' }))
      // Before materialization the free outputs are 0:self, 2:self, 3:self.
      // Dropping the parameter edge frees 1:self, so 3:self moves to output 3.
      const sub = await subnetwork(
        'duplicate outputs',
        network(
          {
            '0': parameterFile('a.prm', [
              exposure(['Refinement'], 'int', 'input'),
            ]),
            '1': literal('int', '4'),
            '2': literal('double', '1.5'),
            '3': literal('double', '2.5'),
          },
          [connect(1, 0, 0, ['Refinement'])]
        )
      )

      const result = await materialize(
        network({ '0': sub, '1': { type: 'consume_double' } }, [
          connect(0, 2, 1, 0),
        ])
      )

      expect(edgesOf(result)).toEqual([
        { source: 0, source_output: 3, target: 1, target_input: 0 },
      ])
    }
  )

  it.fails(
    'rejects a parameter output used through a subnetwork boundary',
    async () => {
      files.set('/work/a.prm', prm({ Tolerance: '1e-3' }))
      const sub = await subnetwork(
        'boundary output',
        network({
          '0': parameterFile('a.prm', [
            exposure(['Tolerance'], 'double', 'output'),
          ]),
        })
      )
      const output = sub.outputs.indexOf(
        sub.arguments.findIndex((argument) => argument.name === 'Tolerance')
      )

      await expect(
        materialize(
          network({ '0': sub, '1': { type: 'consume_double' } }, [
            connect(0, output, 1, 0),
          ])
        )
      ).rejects.toThrow(/Tolerance/)
    }
  )

  it.fails('rejects two nodes binding the same file differently', async () => {
    files.set('/work/a.prm', prm({ Refinement: '1' }))

    await expect(
      materialize(
        network(
          {
            '0': parameterFile('a.prm', [
              exposure(['Refinement'], 'int', 'input'),
            ]),
            '1': parameterFile('a.prm', [
              exposure(['Refinement'], 'int', 'input'),
            ]),
            '2': literal('int', '4'),
            '3': literal('int', '5'),
          },
          [connect(2, 0, 0, ['Refinement']), connect(3, 0, 1, ['Refinement'])]
        )
      )
    ).rejects.toThrow(/a\.prm/)
  })

  it.fails(
    'materializes a nested subnetwork that is not in the registry',
    async () => {
      // Loading a saved graph registers only its top-level subnetworks.
      files.set('/work/a.prm', prm({ Refinement: '1' }))
      const inner = await subnetwork(
        'unregistered inner',
        network(
          {
            '0': parameterFile('a.prm', [
              exposure(['Refinement'], 'int', 'input'),
            ]),
            '1': literal('int', '4'),
          },
          [connect(1, 0, 0, ['Refinement'])]
        )
      )
      const outer = await subnetwork(
        'registered outer',
        network({ '0': inner })
      )
      await removeNetworkNode('unregistered inner')

      await materialize(network({ '0': outer }))

      expect(files.get('/run/a.prm')).toMatch(/set Refinement\s*=\s*4/)
    }
  )
})
