import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Network, NodeData, RegisteredNodes } from '../types/nodeTypes'
import graphValidConnections from '../../../test_files/graph-valid-connections.json'
import defaultRegistry from '../data/defaultNodes.json'

// Mock registry data populated per-test
let mockRegistry = defaultRegistry as RegisteredNodes

vi.mock('../stores/nodes.svelte', () => ({
  getNodeData: vi.fn((type: string): NodeData => {
    if (!(type in mockRegistry)) {
      throw new Error(
        `Node type '${type}' was not found in the available nodes.`
      )
    }
    return { ...mockRegistry[type] }
  }),
  getNetworkNodeData: vi.fn((name: string): NodeData => {
    throw new Error(`Sub-graph node '${name}' not found in networkNodes store`)
  }),
  addNetworkNode: vi.fn(),
  setEdges: vi.fn(),
  setNodes: vi.fn(),
  updateLastNodeId: vi.fn(),
}))

import { validateGraphData } from './graphParser'

describe('validateGraphData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('input validation', () => {
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

  describe('type mismatch detection', () => {
    let graph: Network

    beforeEach(() => {
      graph = structuredClone(graphValidConnections) as Network
    })

    it('returns empty validEdges and invalidEdges with edgeId "0" for type mismatch', () => {
      graph.workflow.edges['0'].target_input = 0
      const [validEdges, invalidEdges] = validateGraphData(
        graph as unknown as Network
      )

      expect(Object.keys(validEdges)).toHaveLength(0)
      expect(invalidEdges).toHaveLength(1)
      expect(invalidEdges[0].edgeId).toBe('0')
      expect(invalidEdges[0].edge).toEqual({
        source: 5,
        target: 4,
        source_output: 0,
        target_input: 0,
      })
      expect(invalidEdges[0].error).toContain('std::string')
      expect(invalidEdges[0].error).toContain('dealii::Triangulation<2, 2>')
    })
    it('returns empty validEdges and invalidEdges with edgeId "0" for type mismatch', () => {
      graph.workflow.nodes['5'].type = 'dealii::Triangulation<2, 2>'
      const [validEdges, invalidEdges] = validateGraphData(
        graph as unknown as Network
      )

      expect(Object.keys(validEdges)).toHaveLength(0)
      expect(invalidEdges).toHaveLength(1)
      expect(invalidEdges[0].edgeId).toBe('0')
    })
  })

  describe('valid connections', () => {
    it('accepts edges where source output type matches target input type', () => {
      const [validEdges, invalidEdges] = validateGraphData(
        graphValidConnections as unknown as Network
      )
      expect(Object.keys(validEdges)).toHaveLength(1)
      expect(invalidEdges).toHaveLength(0)
    })
  })
})
