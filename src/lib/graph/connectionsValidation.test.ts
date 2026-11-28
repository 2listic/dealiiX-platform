import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Edge, Node } from '@xyflow/svelte'
import {
  ConnectionType,
  NodeType,
  Type,
  TypeField,
  type NodeDefinitions,
  type StandardNodeDefinition,
} from '../types/nodeTypes'
import { parameterHandle } from './handleIds'

let nodes: Node<NodeDefinitions>[] = []
let edges: Edge[] = []

// The real stores initialise electron-store.
vi.mock('../stores/nodes.svelte', () => ({
  getNodesSnapshot: () => nodes,
  getEdgesSnapshot: () => edges,
}))
vi.mock('../stores/registryStore.svelte', () => ({
  getNodeData: vi.fn(),
  getNetworkNodeDefinition: vi.fn(),
  isNodeInNetworkNodes: () => false,
}))
vi.mock('../stores/settingsStore.svelte', () => ({ settingsState: {} }))

const { clearConnectionCache, isValidConnection } = await import(
  './connectionsValidation'
)
const { createOverloadNodeDefinition } = await import(
  '../registry/overloadResolution'
)

const tolerance = ['Solver', 'Tolerance']

/** A function from one input of `inputType` to a `double`. */
const doubleFunction = (
  type: string,
  inputType: string
): StandardNodeDefinition => ({
  type,
  operation: 'norm',
  display_name: 'norm',
  arguments: [
    {
      connection_type: ConnectionType.INPUT,
      name: 'field',
      type: inputType as Type,
    },
  ],
  inputs: [0],
  outputs: [-1],
  output_type: Type.DOUBLE,
  node_type: NodeType.FUNCTION,
})

const literal = (type: Type, value: string): StandardNodeDefinition => ({
  type,
  value,
  arguments: [],
  inputs: [],
  outputs: [-1],
  node_type: NodeType.ELEMENTARY_CONSTRUCTOR,
  is_valid: true,
})

const canvasNode = (
  id: string,
  data: NodeDefinitions
): Node<NodeDefinitions> => ({
  id,
  type: data.node_type,
  data,
  position: { x: 0, y: 0 },
})

const family = canvasNode('family', {
  ...createOverloadNodeDefinition([
    doubleFunction('norm<scalar>', 'ScalarField'),
    doubleFunction('norm<vector>', 'VectorField'),
  ]),
  is_valid: true,
})

const parameterFile = canvasNode('file', {
  ...literal(Type.STRING, 'solver.prm'),
  parameter_file: {
    exposures: [
      { path: tolerance, type: 'double', input: true, output: false },
    ],
  },
})

const consumer = canvasNode('consumer', {
  type: 'consumer',
  arguments: [
    { connection_type: ConnectionType.INPUT, name: 'value', type: Type.DOUBLE },
  ],
  inputs: [0],
  outputs: [-1],
  node_type: NodeType.FUNCTION,
  is_valid: true,
})

const connect = (source: string, target: string, targetHandle: string) =>
  isValidConnection({
    source,
    sourceHandle: 'output-0',
    target,
    targetHandle,
  })

describe('isValidConnection', () => {
  beforeEach(() => {
    nodes = [
      family,
      parameterFile,
      consumer,
      canvasNode('literal', literal(Type.DOUBLE, '1e-8')),
    ]
    edges = []
    clearConnectionCache()
  })

  it('rejects a family output into an exposed parameter input', () => {
    expect(connect('family', 'file', parameterHandle('input', tolerance))).toBe(
      false
    )
  })

  it('accepts a literal into an exposed parameter input', () => {
    expect(
      connect('literal', 'file', parameterHandle('input', tolerance))
    ).toBe(true)
  })

  it('requires an exact type from a scalar literal to exposed configuration', () => {
    const enabled = ['Enabled']
    const iterations = ['Iterations']
    const integer = {
      path: iterations,
      type: 'int',
      input: true,
      output: false,
    } as const
    nodes.push(
      canvasNode('option', literal(Type.BOOLEAN, 'true')),
      canvasNode('configured', {
        ...consumer.data,
        node_type: NodeType.VOID_FUNCTION,
        configuration_exposures: {
          exposures: [
            { path: enabled, type: 'bool', input: true, output: false },
            integer,
          ],
        },
      }),
      canvasNode('native', {
        ...literal(Type.STRING, 'iterations.prm'),
        parameter_file: { exposures: [integer] },
      })
    )

    expect(
      connect('option', 'configured', parameterHandle('input', enabled))
    ).toBe(true)
    expect(
      connect('option', 'configured', parameterHandle('input', iterations))
    ).toBe(false)
    expect(
      connect('option', 'native', parameterHandle('input', iterations))
    ).toBe(true)
  })

  it('accepts a family output into an ordinary input of the same type', () => {
    expect(connect('family', 'consumer', 'input-0')).toBe(true)
  })
})

describe('orchestrator file ports', () => {
  it('accepts multiple declarations on a stage input and a single producer on a file', () => {
    const filePort = {
      type: Type.ORCHESTRATOR_FILE,
      name: 'File',
      connection_type: ConnectionType.INPUT,
    }
    const definition: StandardNodeDefinition = {
      type: TypeField.ORCHESTRATOR_LOCAL_FILE,
      node_type: NodeType.VOID_FUNCTION,
      arguments: [
        filePort,
        { ...filePort, connection_type: ConnectionType.OUTPUT },
      ],
      inputs: [0],
      outputs: [1],
      is_valid: true,
    }
    nodes = [
      canvasNode('first', definition),
      canvasNode('second', {
        ...definition,
        type: TypeField.ORCHESTRATOR_REMOTE_FILE,
      }),
      canvasNode('output', definition),
      canvasNode('transfer', {
        ...definition,
        type: TypeField.ORCHESTRATOR_TRANSFER,
      }),
      canvasNode('stage', { ...definition, type: 'orchestrator::Produce' }),
      canvasNode('another', { ...definition, type: 'orchestrator::Consume' }),
    ]
    edges = [
      {
        id: 'in',
        source: 'first',
        sourceHandle: 'output-0',
        target: 'stage',
        targetHandle: 'input-0',
      },
      {
        id: 'transfer-in',
        source: 'first',
        sourceHandle: 'output-0',
        target: 'transfer',
        targetHandle: 'input-0',
      },
      {
        id: 'out',
        source: 'stage',
        sourceHandle: 'output-0',
        target: 'output',
        targetHandle: 'input-0',
      },
    ]
    clearConnectionCache()
    expect(connect('second', 'stage', 'input-0')).toBe(true)
    expect(connect('first', 'stage', 'input-0')).toBe(false)
    expect(connect('another', 'output', 'input-0')).toBe(false)
    expect(connect('second', 'transfer', 'input-0')).toBe(false)
  })
})

describe('isValidConnection with a function output_type and bases', () => {
  /** A function whose SELF output is `Derived`, registered with base `Base`. */
  const derivedFunction = (type: string): StandardNodeDefinition => ({
    ...doubleFunction(type, Type.STRING),
    output_type: 'Derived' as Type,
    bases: ['Base'],
  })

  /** A function taking one input of `inputType`. */
  const takes = (id: string, inputType: string) =>
    canvasNode(id, {
      type: `takes<${inputType}>`,
      arguments: [
        {
          connection_type: ConnectionType.INPUT,
          name: 'value',
          type: inputType as Type,
        },
      ],
      inputs: [0],
      outputs: [],
      node_type: NodeType.VOID_FUNCTION,
      is_valid: true,
    })

  beforeEach(() => {
    nodes = [
      canvasNode('function', { ...derivedFunction('make'), is_valid: true }),
      canvasNode('functionFamily', {
        ...createOverloadNodeDefinition([
          derivedFunction('make<a>'),
          derivedFunction('make<b>'),
        ]),
        is_valid: true,
      }),
      takes('derived', 'Derived'),
      takes('base', 'Base'),
    ]
    edges = []
    clearConnectionCache()
  })

  it('accepts the output_type and refuses its base', () => {
    expect(connect('function', 'derived', 'input-0')).toBe(true)
    expect(connect('function', 'base', 'input-0')).toBe(false)
  })

  it('accepts the output_type and refuses its base from a family', () => {
    expect(connect('functionFamily', 'derived', 'input-0')).toBe(true)
    expect(connect('functionFamily', 'base', 'input-0')).toBe(false)
  })
})
