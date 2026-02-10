import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  Network,
  NetworkNodeOfTypeNetwork,
  NodeData,
  RegisteredNodes,
  RegisteredNetworkNodes,
} from '../types/nodeTypes'
import validGraph from '../../../test_files/network-mwe.json'
import validGraphNewtorkNode from '../../../test_files/network-mwe-network-node.json'
import defaultRegistry from '../data/defaultNodes.json'
import defaultNetworkNodes from '../data/defaultNetworkNodes.json'

// Mock registries data populated per-test
let mockRegistry = defaultRegistry as RegisteredNodes
let mockNetworkNodes = defaultNetworkNodes as RegisteredNetworkNodes

vi.mock('../stores/nodes.svelte', () => ({
  getNodeData: vi.fn((type: string): NodeData => {
    if (!(type in mockRegistry)) {
      throw new Error(
        `Node type '${type}' was not found in the available nodes.`
      )
    }
    return { ...mockRegistry[type] } // Return a copy
  }),
  getNetworkNodeData: vi.fn((name: string): NetworkNodeOfTypeNetwork => {
    if (!(name in mockNetworkNodes)) {
      throw new Error(
        `Sub-graph node '${name}' not found in networkNodes store`
      )
    }
    return { ...mockNetworkNodes[name] } // Return a copy
  }),
  addNetworkNode: vi.fn(),
  setEdges: vi.fn(),
  setNodes: vi.fn(),
  updateLastNodeId: vi.fn(),
}))

import { validateGraphData, addQualifiedIds } from './graphParser'

describe('validateGraphData', () => {
  // beforeEach(() => {
  //   vi.clearAllMocks()
  // })
  let graph
  let graphNetworkNode

  describe('graph structure validation', () => {
    it('throws when no graph data is provided', () => {
      expect(() => validateGraphData(null as unknown as Network)).toThrow(
        'No graph data provided'
      )
    })
    it('throws when nodes are missing', () => {
      expect(() =>
        validateGraphData({ workflow: { edges: {} } } as unknown as Network)
      ).toThrow('No nodes found in graph')
    })
    it('throws when edges are missing', () => {
      expect(() =>
        validateGraphData({
          workflow: { nodes: { '1': { type: 'foo' } } },
        } as unknown as Network)
      ).toThrow('No edges found in graph')
    })
  })

  describe('standard graphs with no network nodes', () => {
    beforeEach(() => {
      graph = structuredClone(validGraph) as Network
    })

    it('accepts a well defined MWE graph (no network nodes)', () => {
      const [validEdges, invalidEdges] = validateGraphData(
        validGraph as unknown as Network
      )
      expect(Object.keys(validEdges)).toHaveLength(9)
      expect(invalidEdges).toHaveLength(0)
    })

    it('throws error when node type is not found', () => {
      // Modify type of second node to trigger node not in the registry
      const invalidType = 'type_not_registered'
      graph.workflow.nodes['1'].type = invalidType
      graph.workflow.nodes['3'].arguments[1].type = invalidType

      expect(() => validateGraphData(graph as unknown as Network)).toThrow(
        `Node type '${invalidType}' was not found in the available nodes.`
      )
    })

    it('returns one invalid edge for type mismatch', () => {
      // Modify target input of first edge to trigger invalid edge
      graph.workflow.edges['0'].target_input = 1
      const [validEdges, invalidEdges] = validateGraphData(
        graph as unknown as Network
      )

      expect(Object.keys(validEdges)).toHaveLength(8)
      expect(invalidEdges).toHaveLength(1)
      expect(invalidEdges[0].edgeId).toBe('0')
      expect(invalidEdges[0].edge).toEqual({
        source: 0,
        target: 3,
        source_output: 0,
        target_input: 1,
      })
      expect(invalidEdges[0].error).toContain('std::string')
      expect(invalidEdges[0].error).toContain('dealii::Triangulation<2, 2>')
    })

    it('returns one invalid edge for type mismatch', () => {
      // Modify type of second node to trigger invalid edge
      graph.workflow.nodes['1'].type = 'dealii::Triangulation<2, 2>'
      const [validEdges, invalidEdges] = validateGraphData(
        graph as unknown as Network
      )

      expect(Object.keys(validEdges)).toHaveLength(8)
      expect(invalidEdges).toHaveLength(1)
      expect(invalidEdges[0].edgeId).toBe('1')
    })
  })

  describe('graphs with network nodes', () => {
    beforeEach(() => {
      graphNetworkNode = structuredClone(validGraphNewtorkNode) as Network
    })

    it('accepts a well defined MWE graph which includes a network node', () => {
      const [validEdges, invalidEdges] = validateGraphData(
        validGraphNewtorkNode as unknown as Network
      )
      expect(Object.keys(validEdges)).toHaveLength(4)
      expect(invalidEdges).toHaveLength(0)
    })

    it('accepts a well defined MWE graph which includes a network node that is not already in the store', () => {
      // Modify name of the network node
      const nameNotInStore = 'name_not_in_store'
      graphNetworkNode.workflow.nodes['12'].name = nameNotInStore

      const [validEdges, invalidEdges] = validateGraphData(
        graphNetworkNode as unknown as Network
      )
      expect(Object.keys(validEdges)).toHaveLength(4)
      expect(invalidEdges).toHaveLength(0)
    })
  })
})

describe('addQualifiedIds', () => {
  it('assigns node id as qualified_id for top-level nodes', () => {
    const graph = structuredClone(validGraph) as Network
    const result = addQualifiedIds(graph)

    for (const nodeId of Object.keys(result.workflow.nodes)) {
      expect(result.workflow.nodes[nodeId].qualified_id).toBe(nodeId)
    }
  })

  it('prefixes nested node ids with parent qualified_id', () => {
    const graph = structuredClone(validGraphNewtorkNode) as unknown as Network
    const result = addQualifiedIds(graph)

    // Top-level nodes get their own id
    expect(result.workflow.nodes['1'].qualified_id).toBe('1')
    expect(result.workflow.nodes['12'].qualified_id).toBe('12')

    // Nested nodes inside network node "12" get prefixed
    const nestedNodes = (result.workflow.nodes['12'] as any).value.workflow
      .nodes
    expect(nestedNodes['0'].qualified_id).toBe('12_0')
    expect(nestedNodes['3'].qualified_id).toBe('12_3')
    expect(nestedNodes['5'].qualified_id).toBe('12_5')
    expect(nestedNodes['8'].qualified_id).toBe('12_8')
    expect(nestedNodes['10'].qualified_id).toBe('12_10')
    expect(nestedNodes['11'].qualified_id).toBe('12_11')
  })

  it('does not mutate the original network', () => {
    const graph = structuredClone(validGraphNewtorkNode) as unknown as Network
    addQualifiedIds(graph)

    // Original nodes should not have qualified_id
    expect((graph.workflow.nodes['1'] as any).qualified_id).toBeUndefined()
    expect((graph.workflow.nodes['12'] as any).qualified_id).toBeUndefined()
  })

  it('handles a network with no nodes', () => {
    const emptyNetwork: Network = {
      author: 'test',
      date_time_utc: '',
      version: 1,
      workflow: { nodes: {}, edges: {} },
    }
    const result = addQualifiedIds(emptyNetwork)
    expect(Object.keys(result.workflow.nodes)).toHaveLength(0)
  })
})
