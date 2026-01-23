import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Network, NodeData, RegisteredNodes } from '../types/nodeTypes'
import { ConnectionType, NodeType, SELF } from '../types/nodeTypes'
import testValidationData from '../../../docs/test-validation.json'

// Mock registry data populated per-test
let mockRegistry: RegisteredNodes = {}

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
    mockRegistry = {}
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

  describe('type mismatch detection (test-validation.json)', () => {
    beforeEach(() => {
      mockRegistry = {
        'std::string': {
          type: 'std::string',
          node_type: NodeType.ELEMENTARY_CONSTRUCTOR,
          arguments: [],
          inputs: [],
          outputs: [SELF],
        } as NodeData,
        'GridGenerator::generate_from_name_and_arguments<2>': {
          type: 'GridGenerator::generate_from_name_and_arguments<2>',
          node_type: NodeType.VOID_FUNCTION,
          arguments: [
            {
              connection_type: ConnectionType.PASSTHROUGH,
              name: 'triangulation',
              type: 'dealii::Triangulation<2, 2>',
            },
            {
              connection_type: ConnectionType.INPUT,
              name: 'grid_generator_function_name',
              type: 'std::string',
            },
            {
              connection_type: ConnectionType.INPUT,
              name: 'grid_generator_function_arguments',
              type: 'std::string',
            },
          ],
          inputs: [0, 1, 2],
          outputs: [0],
        } as NodeData,
      }
    })

    it('returns empty validEdges and invalidEdges with edgeId "0" for type mismatch', () => {
      const [validEdges, invalidEdges] = validateGraphData(
        testValidationData as unknown as Network
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
  })

  describe('valid connections', () => {
    beforeEach(() => {
      mockRegistry = {
        'std::string': {
          type: 'std::string',
          node_type: NodeType.ELEMENTARY_CONSTRUCTOR,
          arguments: [],
          inputs: [],
          outputs: [SELF],
        } as NodeData,
        SomeFunction: {
          type: 'SomeFunction',
          node_type: NodeType.VOID_FUNCTION,
          arguments: [
            {
              connection_type: ConnectionType.INPUT,
              name: 'input_str',
              type: 'std::string',
            },
          ],
          inputs: [0],
          outputs: [],
        } as NodeData,
      }
    })

    it('accepts edges where source output type matches target input type', () => {
      const graph: Network = {
        workflow: {
          nodes: {
            '1': { type: 'std::string' } as any,
            '2': { type: 'SomeFunction' } as any,
          },
          edges: {
            '0': { source: 1, target: 2, source_output: 0, target_input: 0 },
          },
        },
        version: 1,
        author: 'test',
        date_time_utc: '2026-01-01T00:00:00Z',
      }

      const [validEdges, invalidEdges] = validateGraphData(graph)

      expect(Object.keys(validEdges)).toHaveLength(1)
      expect(invalidEdges).toHaveLength(0)
    })
  })
})
