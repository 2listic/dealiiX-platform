import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Edge, Node } from '@xyflow/svelte'
import {
  NodeType,
  type SubGraphNodeDefinition,
  type StandardNodeDefinition,
  type RegisteredNodes,
} from '../types/nodeTypes'
import defaultRegistry from '../data/defaultNodes.json'
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

describe('networkNodeCanvas utilities', () => {
  beforeEach(() => {
    mockStore.nodeDataByType = defaultRegistry as unknown as RegisteredNodes
    mockStore.networkNodeDataByName = {}
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
