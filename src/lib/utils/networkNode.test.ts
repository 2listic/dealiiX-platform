import { describe, expect, it, vi } from 'vitest'

// graphParser (imported by networkNode.ts) transitively loads registryStore and
// nodes stores, which try to initialise electron-store. Mock them to keep tests
// free of electron side-effects.
vi.mock('../stores/registryStore.svelte', () => ({
  getNodeData: vi.fn(),
  getNetworkNodeDefinition: vi.fn(),
  addNetworkNode: vi.fn(),
}))

vi.mock('../stores/nodes.svelte', () => ({
  setNodes: vi.fn(),
  setEdges: vi.fn(),
  updateLastNodeId: vi.fn(),
}))
import type { Edge, Node } from '@xyflow/svelte'
import {
  ConnectionType,
  NodeType,
  type SubGraphNodeDefinition,
  type StandardNodeDefinition,
} from '../types/nodeTypes'
import defaultRegistry from '../data/defaultNodes.json'
import flatGraph from '../../../test_files/network-mwe-simplified-qualified.json'
import networkNodeGraph from '../../../test_files/network-mwe-simplified-network-node-qualified.json'

import {
  createNetworkNodeDefinition,
  analyzeNetworkBoundary,
} from './networkNode'

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

// Build a canvas node from a lean protocol node using defaultRegistry for the full definition.
const protoNodeToCanvas = (
  id: string,
  protoNode: { type: string; position?: { x: number; y: number } }
): Node => {
  const data = defaultRegistry[
    protoNode.type as keyof typeof defaultRegistry
  ] as unknown as StandardNodeDefinition
  return makeCanvasNode(
    id,
    data,
    data.node_type as NodeType,
    protoNode.position ?? { x: 0, y: 0 }
  )
}

// Build a canvas edge from a protocol edge record.
const protoEdgeToCanvas = (edge: {
  source: number
  source_output: number
  target: number
  target_input: number
}): Edge =>
  makeEdge(
    String(edge.source),
    `output-${edge.source_output}`,
    String(edge.target),
    `input-${edge.target_input}`
  )

// Node IDs that are collapsed into the "Step1" network node in the network-node fixture.
// These correspond to the subset of flatGraph nodes that are not present at the top level
// of networkNodeGraph.
const STEP1_SUBGRAPH_IDS = new Set(['3', '5', '8', '10', '11'])

describe('networkNode utilities', () => {
  it('rejects creating a network node from an empty graph', () => {
    expect(() => createNetworkNodeDefinition('Empty', [], [])).toThrow(
      'Cannot create network node from empty graph'
    )
  })

  it('builds pass-through and input interfaces with handle bindings deterministically', () => {
    // Triangulation<2>::refine_global is the same node used as node '5' in the Step1
    // fixture. Wrapping it alone (no edges) leaves both its pass_through handles free,
    // so the triangulation argument becomes PASSTHROUGH at the network boundary, while
    // n_refinements (input-only) becomes INPUT.
    const refineData = defaultRegistry[
      'Triangulation<2>::refine_global'
    ] as unknown as StandardNodeDefinition
    const refineNode = makeCanvasNode('5', refineData, NodeType.VOID_METHOD)

    const networkNode = createNetworkNodeDefinition(
      'RefineOnly',
      [refineNode],
      []
    )
    const { internalHandleToNetworkInput, internalHandleToNetworkOutput } =
      analyzeNetworkBoundary([refineNode], [])

    expect(networkNode.arguments).toEqual([
      {
        connection_type: ConnectionType.PASSTHROUGH,
        name: 'triangulation',
        type: 'dealii::Triangulation<2, 2>',
      },
      {
        connection_type: ConnectionType.INPUT,
        name: 'n_refinements',
        type: 'unsigned int',
      },
    ])
    expect(networkNode.inputs).toEqual([0, 1])
    expect(networkNode.outputs).toEqual([0])
    expect(internalHandleToNetworkInput).toEqual({
      '5::input-0': 0,
      '5::input-1': 1,
    })
    expect(internalHandleToNetworkOutput).toEqual({ '5::output-0': 0 })
  })

  it('exposes dangling SELF outputs as network outputs', () => {
    const triData = defaultRegistry[
      'dealii::Triangulation<2, 2>'
    ] as unknown as StandardNodeDefinition
    const triNode = makeCanvasNode('4', triData, NodeType.EMPTY_CONSTRUCTOR, {
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

  it('createNetworkNodeDefinition and analyzeNetworkBoundary produce the Step1 definition from its constituent nodes', () => {
    // The Step1 subgraph is nodes {3,5,8,10,11} from the flat graph fixture:
    //   3 (GridGenerator::generate_from_name_and_arguments<2>)
    //   5 (Triangulation<2>::refine_global)
    //   8 (dealii::GridOut)
    //  10 (std::ofstream)
    //  11 (GridOut::write_vtk<2>)
    //
    // Internal edges (both endpoints in the subgraph):
    //   3→5  source_output=0 target_input=0  (triangulation pass-through)
    //   8→11 source_output=0 target_input=0  (grid_out)
    //   5→11 source_output=0 target_input=1  (triangulation)
    //  10→11 source_output=0 target_input=2  (output_file pass-through input)
    //
    // This leaves 5 free inputs and 1 free output — matching the Step1 arguments
    // in the network-node fixture exactly.
    const subgraphNodes = Object.entries(flatGraph.workflow.nodes)
      .filter(([id]) => STEP1_SUBGRAPH_IDS.has(id))
      .map(([id, node]) => protoNodeToCanvas(id, node))

    const subgraphEdges = Object.values(flatGraph.workflow.edges)
      .filter(
        (e) =>
          STEP1_SUBGRAPH_IDS.has(String(e.source)) &&
          STEP1_SUBGRAPH_IDS.has(String(e.target))
      )
      .map(protoEdgeToCanvas)

    const networkNode = createNetworkNodeDefinition(
      'Step1',
      subgraphNodes,
      subgraphEdges
    )
    const { internalHandleToNetworkInput, internalHandleToNetworkOutput } =
      analyzeNetworkBoundary(subgraphNodes, subgraphEdges)

    // Ground truth: the Step1 node definition from the network-node fixture
    const expected = networkNodeGraph.workflow.nodes['12']

    expect(networkNode.arguments).toEqual(expected.arguments)
    expect(networkNode.inputs).toEqual(expected.inputs)
    expect(networkNode.outputs).toEqual(expected.outputs)

    // Handle maps: each internal node handle mapped to its network-level handle index
    expect(internalHandleToNetworkInput).toEqual({
      '3::input-0': 0, // triangulation  → GridGenerator input-0
      '3::input-1': 1, // name           → GridGenerator input-1
      '3::input-2': 2, // args           → GridGenerator input-2
      '5::input-1': 3, // n_refinements  → refine_global input-1
      '10::input-0': 4, // file_name     → std::ofstream input-0
    })
    expect(internalHandleToNetworkOutput).toEqual({
      '11::output-0': 0, // output_file  → write_vtk output-0
    })
  })
})
