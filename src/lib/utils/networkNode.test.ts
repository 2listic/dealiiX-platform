import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Edge, Node } from '@xyflow/svelte'
import {
  ConnectionType,
  NodeType,
  SELF,
  Type,
  TypeField,
  type SubGraphNodeDefinition,
  type StandardNodeDefinition,
} from '../types/nodeTypes'

const mockStore = vi.hoisted(() => ({
  nodeDataByType: {} as Record<string, StandardNodeDefinition>,
  networkNodeDataByName: {} as Record<string, SubGraphNodeDefinition>,
}))

vi.mock('../stores/registryStore.svelte', () => ({
  getNodeData: vi.fn((type: string) => {
    const node = mockStore.nodeDataByType[type]
    if (!node) {
      throw new Error(`Missing node data for type '${type}'`)
    }
    return structuredClone(node)
  }),
  getNetworkNodeDefinition: vi.fn((name: string) => {
    const node = mockStore.networkNodeDataByName[name]
    if (!node) {
      throw new Error(`Missing network node data for '${name}'`)
    }
    return structuredClone(node)
  }),
}))

import {
  createNetworkNodeDefinition,
  analyzeNetworkBoundary,
} from './networkNode'
import {
  explodeNetworkNodeInGraph,
  flattenSelectedSubgraphs,
} from './networkNodeCanvas'

const stringSourceData: StandardNodeDefinition = {
  type: Type.STRING,
  node_type: NodeType.ELEMENTARY_CONSTRUCTOR,
  arguments: [],
  inputs: [],
  outputs: [SELF],
  value: 'value',
  is_valid: true,
}

const passthroughData: StandardNodeDefinition = {
  type: 'passthrough',
  node_type: NodeType.FUNCTION,
  arguments: [
    {
      connection_type: ConnectionType.PASSTHROUGH,
      name: 'value',
      type: Type.STRING,
    },
  ],
  inputs: [0],
  outputs: [0],
  is_valid: true,
}

const sinkData: StandardNodeDefinition = {
  type: 'sink',
  node_type: NodeType.VOID_FUNCTION,
  arguments: [
    {
      connection_type: ConnectionType.INPUT,
      name: 'value',
      type: Type.STRING,
    },
  ],
  inputs: [0],
  outputs: [],
  is_valid: true,
}

const triData: StandardNodeDefinition = {
  type: 'dealii::Triangulation<2, 2>',
  node_type: NodeType.CONSTRUCTOR,
  arguments: [],
  inputs: [],
  outputs: [SELF],
  is_valid: true,
}

const readGridData: StandardNodeDefinition = {
  type: 'dealii::read_grid<2>',
  node_type: NodeType.FUNCTION,
  arguments: [
    {
      connection_type: ConnectionType.INPUT,
      name: 'file_name',
      type: Type.STRING,
    },
    {
      connection_type: ConnectionType.OUTPUT,
      name: 'triangulation',
      type: 'dealii::Triangulation<2, 2>' as Type,
    },
  ],
  inputs: [0],
  outputs: [1],
  is_valid: true,
}

const makeCanvasNode = (
  id: string,
  data: StandardNodeDefinition | SubGraphNodeDefinition,
  type = data.node_type,
  position = { x: 0, y: 0 }
): Node =>
  ({
    id,
    type,
    position,
    data,
  }) as Node

const makeEdge = (
  source: string,
  sourceHandle: string,
  target: string,
  targetHandle: string
): Edge =>
  ({
    id: `xy-edge__${source}${sourceHandle}-${target}${targetHandle}`,
    source,
    sourceHandle,
    target,
    targetHandle,
  }) as Edge

describe('networkNode utilities', () => {
  beforeEach(() => {
    mockStore.nodeDataByType = {
      [Type.STRING]: stringSourceData,
      passthrough: passthroughData,
      sink: sinkData,
      'dealii::Triangulation<2, 2>': triData,
      'dealii::read_grid<2>': readGridData,
    }
    mockStore.networkNodeDataByName = {}
  })

  it('rejects creating a network node from an empty graph', () => {
    expect(() => createNetworkNodeDefinition('Empty', [], [])).toThrow(
      'Cannot create network node from empty graph'
    )
  })

  it('builds pass-through interfaces and handle bindings deterministically', () => {
    const passthroughNode = makeCanvasNode(
      '2',
      passthroughData,
      NodeType.FUNCTION,
      {
        x: 100,
        y: 0,
      }
    )

    const networkNode = createNetworkNodeDefinition(
      'Selection',
      [passthroughNode],
      []
    )
    const { internalHandleToNetworkInput, internalHandleToNetworkOutput } =
      analyzeNetworkBoundary([passthroughNode], [])

    expect(networkNode.arguments).toEqual([
      {
        connection_type: ConnectionType.PASSTHROUGH,
        name: 'value',
        type: Type.STRING,
      },
    ])
    expect(networkNode.inputs).toEqual([0])
    expect(networkNode.outputs).toEqual([0])
    expect(internalHandleToNetworkInput).toEqual({ '2::input-0': 0 })
    expect(internalHandleToNetworkOutput).toEqual({ '2::output-0': 0 })
  })

  it('exposes dangling SELF outputs as network outputs', () => {
    const triNode = makeCanvasNode('4', triData, NodeType.CONSTRUCTOR, {
      x: 20,
      y: 40,
    })

    const networkNode = createNetworkNodeDefinition('TriOnly', [triNode], [])

    expect(networkNode.arguments).toEqual([
      {
        connection_type: ConnectionType.OUTPUT,
        name: 'self',
        type: 'dealii::Triangulation<2, 2>',
      },
    ])
    expect(networkNode.inputs).toEqual([])
    expect(networkNode.outputs).toEqual([0])
  })

  it('expands a network node into the parent graph and rewires external edges', () => {
    const innerNetwork: SubGraphNodeDefinition = {
      type: TypeField.CORAL_NETWORK,
      node_type: NodeType.NETWORK,
      name: 'GridLoader',
      arguments: [
        {
          connection_type: ConnectionType.INPUT,
          name: 'file_name',
          type: Type.STRING,
        },
        {
          connection_type: ConnectionType.OUTPUT,
          name: 'triangulation',
          type: 'dealii::Triangulation<2, 2>' as Type,
        },
      ],
      inputs: [0],
      outputs: [1],
      value: {
        author: 'test',
        date_time_utc: '',
        version: 1,
        workflow: {
          nodes: {
            '1': {
              type: 'dealii::read_grid<2>',
              position: { x: 10, y: 10 },
            },
          },
          edges: {},
        },
      },
      is_valid: true,
    }

    const outerNodes = [
      makeCanvasNode('10', stringSourceData, NodeType.ELEMENTARY_CONSTRUCTOR, {
        x: 0,
        y: 0,
      }),
      makeCanvasNode('20', innerNetwork, NodeType.NETWORK, {
        x: 200,
        y: 100,
      }),
      makeCanvasNode('30', sinkData, NodeType.VOID_FUNCTION, {
        x: 400,
        y: 100,
      }),
    ]
    const outerEdges = [
      makeEdge('10', 'output-0', '20', 'input-0'),
      makeEdge('20', 'output-0', '30', 'input-0'),
    ]

    let nextId = 99
    const expanded = explodeNetworkNodeInGraph(
      '20',
      outerNodes,
      outerEdges,
      () => ++nextId
    )

    expect(expanded.nodes.map((node) => node.id)).not.toContain('20')
    const insertedNode = expanded.nodes.find((node) => node.id === '100')
    expect(insertedNode).toBeDefined()
    expect(insertedNode?.selected).toBe(true)
    expect(insertedNode?.data.type).toBe('dealii::read_grid<2>')

    expect(expanded.edges).toEqual([
      expect.objectContaining({
        source: '10',
        sourceHandle: 'output-0',
        target: '100',
        targetHandle: 'input-0',
      }),
      expect.objectContaining({
        source: '100',
        sourceHandle: 'output-0',
        target: '30',
        targetHandle: 'input-0',
      }),
    ])
  })

  it('flattens selected subgraphs and rewires selection edges through the expanded nodes', () => {
    const innerNetwork: SubGraphNodeDefinition = {
      type: TypeField.CORAL_NETWORK,
      node_type: NodeType.NETWORK,
      name: 'GridLoader',
      arguments: [
        {
          connection_type: ConnectionType.INPUT,
          name: 'file_name',
          type: Type.STRING,
        },
        {
          connection_type: ConnectionType.OUTPUT,
          name: 'triangulation',
          type: 'dealii::Triangulation<2, 2>' as Type,
        },
      ],
      inputs: [0],
      outputs: [1],
      value: {
        author: 'test',
        date_time_utc: '',
        version: 1,
        workflow: {
          nodes: {
            '1': {
              type: 'dealii::read_grid<2>',
              position: { x: 10, y: 10 },
            },
          },
          edges: {},
        },
      },
      is_valid: true,
    }

    const selectionNodes = [
      makeCanvasNode('20', innerNetwork, NodeType.NETWORK, {
        x: 200,
        y: 100,
      }),
      makeCanvasNode('30', sinkData, NodeType.VOID_FUNCTION, {
        x: 400,
        y: 100,
      }),
    ]
    const selectionEdges = [makeEdge('20', 'output-0', '30', 'input-0')]

    let nextId = 99
    const flattened = flattenSelectedSubgraphs(
      selectionNodes,
      selectionEdges,
      () => ++nextId
    )

    expect(flattened.nodes.map((node) => node.id)).not.toContain('20')
    expect(flattened.nodes.some((node) => node.id === '30')).toBe(true)
    expect(
      flattened.nodes.some((node) => node.data.type === 'dealii::read_grid<2>')
    ).toBe(true)
    expect(flattened.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: '100',
          sourceHandle: 'output-0',
          target: '30',
          targetHandle: 'input-0',
        }),
      ])
    )
    expect(flattened.aliasedInputTargetByOriginal).toEqual({
      '20::input-0': '100::input-0',
    })
    expect(flattened.aliasedOutputSourceByOriginal).toEqual({
      '20::output-0': '100::output-0',
    })
  })
})
