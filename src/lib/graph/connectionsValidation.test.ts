import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Edge, Node } from '@xyflow/svelte'
import {
  ConnectionType,
  NodeType,
  Type,
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

  it('accepts a family output into an ordinary input of the same type', () => {
    expect(connect('family', 'consumer', 'input-0')).toBe(true)
  })
})
