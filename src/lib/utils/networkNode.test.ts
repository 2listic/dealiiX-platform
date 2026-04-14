import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Edge, Node } from '@xyflow/svelte'
import {
  ConnectionType,
  NodeType,
  type SubGraphNodeDefinition,
  type StandardNodeDefinition,
  type RegisteredNodes,
} from '../types/nodeTypes'
import defaultRegistry from '../data/defaultNodes.json'
import flatGraph from '../../../test_files/network-mwe-simplified-qualified.json'
import networkNodeGraph from '../../../test_files/network-mwe-simplified-network-node-qualified.json'

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
  beforeEach(() => {
    mockStore.nodeDataByType = defaultRegistry as unknown as RegisteredNodes
    mockStore.networkNodeDataByName = {}
  })

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

  it('exploding the Step1 network node rewires outer edges to match the flat graph', () => {
    // The network-node fixture has 5 source nodes (0,1,2,6,9) plus the Step1 network node (12).
    // After exploding 12, the 5 internal nodes reappear with new IDs 100–104
    // (protocol node order 3,5,8,10,11 → 100,101,102,103,104 with nextId starting at 99).
    // Each rewired outer edge should match the corresponding edge in the flat graph.
    const step1Definition = networkNodeGraph.workflow.nodes[
      '12'
    ] as unknown as SubGraphNodeDefinition

    const outerNodes = [
      ...['0', '1', '2', '6', '9'].map((id) =>
        protoNodeToCanvas(
          id,
          networkNodeGraph.workflow.nodes[
            id as keyof typeof networkNodeGraph.workflow.nodes
          ] as { type: string; position: { x: number; y: number } }
        )
      ),
      makeCanvasNode(
        '12',
        step1Definition,
        NodeType.NETWORK,
        step1Definition.position
      ),
    ]
    const outerEdges = Object.values(networkNodeGraph.workflow.edges).map(
      protoEdgeToCanvas
    )

    let nextId = 99
    const expanded = explodeNetworkNodeInGraph(
      '12',
      outerNodes,
      outerEdges,
      () => ++nextId
    )

    expect(expanded.nodes.map((n) => n.id)).not.toContain('12')

    // Rewired outer edges — each corresponds to one edge in the flat graph:
    //   flat edge 0: 0→3  input-0  (triangulation → GridGenerator)
    //   flat edge 1: 1→3  input-1  (name          → GridGenerator)
    //   flat edge 2: 2→3  input-2  (args          → GridGenerator)
    //   flat edge 4: 6→5  input-1  (n_refinements → refine_global)
    //   flat edge 5: 9→10 input-0  (file_name     → std::ofstream)
    expect(expanded.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: '0',
          sourceHandle: 'output-0',
          target: '100',
          targetHandle: 'input-0',
        }),
        expect.objectContaining({
          source: '1',
          sourceHandle: 'output-0',
          target: '100',
          targetHandle: 'input-1',
        }),
        expect.objectContaining({
          source: '2',
          sourceHandle: 'output-0',
          target: '100',
          targetHandle: 'input-2',
        }),
        expect.objectContaining({
          source: '6',
          sourceHandle: 'output-0',
          target: '101',
          targetHandle: 'input-1',
        }),
        expect.objectContaining({
          source: '9',
          sourceHandle: 'output-0',
          target: '103',
          targetHandle: 'input-0',
        }),
      ])
    )
  })

  it('flattenSelectedSubgraphs rewires a selection edge through the expanded Step1 nodes', () => {
    // Selection: node 9 (file_name string) + the Step1 network node, connected by
    // edge 4 from the network-node fixture (9 → 12 input-4 / file_name).
    // After flattening, that edge must rewire to 9 → 103 input-0 (std::ofstream file_name),
    // since std::ofstream (old node 10) is the Step1 node that receives file_name.
    const step1Definition = networkNodeGraph.workflow.nodes[
      '12'
    ] as unknown as SubGraphNodeDefinition

    const selectionNodes = [
      protoNodeToCanvas('9', networkNodeGraph.workflow.nodes['9']),
      makeCanvasNode(
        '12',
        step1Definition,
        NodeType.NETWORK,
        step1Definition.position
      ),
    ]
    const selectionEdges = [makeEdge('9', 'output-0', '12', 'input-4')]

    let nextId = 99
    const flattened = flattenSelectedSubgraphs(
      selectionNodes,
      selectionEdges,
      () => ++nextId
    )

    expect(flattened.nodes.map((n) => n.id)).not.toContain('12')
    expect(flattened.nodes.some((n) => n.id === '9')).toBe(true)
    expect(
      flattened.nodes.some((n) => n.data.type === 'GridOut::write_vtk<2>')
    ).toBe(true)

    // The selection edge must be rewired through the exploded std::ofstream node
    expect(flattened.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: '9',
          sourceHandle: 'output-0',
          target: '103',
          targetHandle: 'input-0',
        }),
      ])
    )

    // Full alias maps for all 5 Step1 inputs and its single output
    expect(flattened.aliasedInputTargetByOriginal).toEqual({
      '12::input-0': '100::input-0', // triangulation  → GridGenerator input-0
      '12::input-1': '100::input-1', // name           → GridGenerator input-1
      '12::input-2': '100::input-2', // args           → GridGenerator input-2
      '12::input-3': '101::input-1', // n_refinements  → refine_global input-1
      '12::input-4': '103::input-0', // file_name      → std::ofstream input-0
    })
    expect(flattened.aliasedOutputSourceByOriginal).toEqual({
      '12::output-0': '104::output-0', // output_file from write_vtk
    })
  })
})
