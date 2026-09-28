import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  Network,
  StandardNodeDefinition,
  RegisteredNodes,
} from '../types/nodeTypes'
import { Type } from '../types/nodeTypes'
import validQualifiedGraph from '../../../test_files/network-mwe-simplified-qualified.json'
import validQualifiedGraphNetworkNode from '../../../test_files/network-mwe-simplified-network-node-qualified.json'
import defaultRegistry from '../data/defaultNodes.json'
import validGraphMathFunctions from '../../../test_files/network-math-functions.json'
import mathFunctionsRegistry from '../data/mathFunctionsNodes.json'
import validGraphCollectionsMath from '../../../test_files/network-collections-math.json'
import collectionsMathRegistry from '../data/collectionsMathNodes.json'

const mockStore = vi.hoisted(() => ({
  nodeDataByType: {} as Record<string, StandardNodeDefinition>,
}))

vi.mock('../stores/registryStore.svelte', () => ({
  getNodeData: vi.fn((type: string): StandardNodeDefinition => {
    const node = mockStore.nodeDataByType[type]
    if (!node) {
      throw new Error(
        `Node type '${type}' was not found in the available nodes.`
      )
    }
    return structuredClone(node)
  }),
  getNetworkNodeDefinition: vi.fn(),
  addNetworkNode: vi.fn(),
}))

import {
  validateGraphData,
  addQualifiedIds,
  removeQualifiedIds,
  parseGraphToProtocol,
  edgesFromProtocolToFlow,
} from './graphParser'
import { parameterHandle } from './parameterPorts'

describe('validateGraphData', () => {
  let graph: Network
  let graphNetworkNode: Network

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
      mockStore.nodeDataByType = defaultRegistry as unknown as RegisteredNodes
      graph = structuredClone(validQualifiedGraph) as Network
      vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    it('accepts a well defined MWE graph (no network nodes)', () => {
      const [validEdges, invalidEdges] = validateGraphData(
        validQualifiedGraph as unknown as Network
      )
      expect(Object.keys(validEdges)).toHaveLength(9)
      expect(invalidEdges).toHaveLength(0)
    })

    it('throws error when node type is not found', () => {
      // Modify type of second node to trigger node not in the registry
      const invalidType = 'type_not_registered'
      graph.workflow.nodes['1'].type = invalidType

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

  describe('lean graph with an "any"-typed input', () => {
    beforeEach(() => {
      mockStore.nodeDataByType =
        mathFunctionsRegistry as unknown as RegisteredNodes
      vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    it('keeps the edge into print_result (input typed "any"); all edges valid', () => {
      // Edge "4" wires multiply's output into print_result, whose input is typed "any".
      // Before the fix this was dropped as a type mismatch on load.
      const [validEdges, invalidEdges] = validateGraphData(
        validGraphMathFunctions as unknown as Network
      )
      expect(invalidEdges).toHaveLength(0)
      expect(Object.keys(validEdges)).toHaveLength(
        Object.keys(validGraphMathFunctions.workflow.edges).length
      )
    })
  })

  describe('graph with an "any"-typed output feeding a concrete input', () => {
    beforeEach(() => {
      mockStore.nodeDataByType =
        collectionsMathRegistry as unknown as RegisteredNodes
      vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    it('keeps edges from an "any"-typed output (list element) into a "float" input', () => {
      // Edges "8" and "9" wire a list-element lookup's output (typed "any") into an add
      // node's two "float" inputs. Before the fix these were dropped as a type mismatch on load.
      const [validEdges, invalidEdges] = validateGraphData(
        validGraphCollectionsMath as unknown as Network
      )
      expect(invalidEdges).toHaveLength(0)
      expect(Object.keys(validEdges)).toHaveLength(
        Object.keys(validGraphCollectionsMath.workflow.edges).length
      )
    })
  })

  describe('graphs with network nodes', () => {
    beforeEach(() => {
      mockStore.nodeDataByType = defaultRegistry as unknown as RegisteredNodes
      graphNetworkNode = structuredClone(
        validQualifiedGraphNetworkNode
      ) as Network
    })

    it('accepts a well defined MWE graph which includes a network node', () => {
      const [validEdges, invalidEdges] = validateGraphData(
        validQualifiedGraphNetworkNode as unknown as Network
      )
      expect(Object.keys(validEdges)).toHaveLength(5)
      expect(invalidEdges).toHaveLength(0)
    })

    it('accepts a well defined MWE graph which includes a network node that is not already in the store', () => {
      // Modify name of the network node
      const nameNotInStore = 'name_not_in_store'
      graphNetworkNode.workflow.nodes['12'].name = nameNotInStore

      const [validEdges, invalidEdges] = validateGraphData(
        graphNetworkNode as unknown as Network
      )
      expect(Object.keys(validEdges)).toHaveLength(5)
      expect(invalidEdges).toHaveLength(0)
    })
  })
})

describe('addQualifiedIds / removeQualifiedIds', () => {
  let qualifiedGraph: Network
  let cleanGraph: Network

  beforeEach(() => {
    qualifiedGraph = structuredClone(
      validQualifiedGraphNetworkNode
    ) as unknown as Network
    cleanGraph = removeQualifiedIds(qualifiedGraph)
  })

  it('removeQualifiedIds strips qualified_id from all top-level and nested nodes', () => {
    for (const node of Object.values(cleanGraph.workflow.nodes)) {
      expect((node as any).qualified_id).toBeUndefined()
    }

    const nestedNodes = (cleanGraph.workflow.nodes['12'] as any).value.workflow
      .nodes
    for (const node of Object.values(nestedNodes)) {
      expect((node as any).qualified_id).toBeUndefined()
    }
  })

  it('addQualifiedIds assigns node id as qualified_id for top-level nodes', () => {
    const result = addQualifiedIds(cleanGraph)

    for (const nodeId of Object.keys(result.workflow.nodes)) {
      expect(result.workflow.nodes[nodeId].qualified_id).toBe(nodeId)
    }
  })

  it('addQualifiedIds prefixes nested node ids with parent qualified_id', () => {
    const result = addQualifiedIds(cleanGraph)

    expect(result.workflow.nodes['1'].qualified_id).toBe('1')
    expect(result.workflow.nodes['12'].qualified_id).toBe('12')

    const nestedNodes = (result.workflow.nodes['12'] as any).value.workflow
      .nodes
    expect(nestedNodes['3'].qualified_id).toBe('12_3')
    expect(nestedNodes['5'].qualified_id).toBe('12_5')
    expect(nestedNodes['8'].qualified_id).toBe('12_8')
    expect(nestedNodes['10'].qualified_id).toBe('12_10')
    expect(nestedNodes['11'].qualified_id).toBe('12_11')
  })

  it('addQualifiedIds does not mutate the original network', () => {
    addQualifiedIds(cleanGraph)

    for (const node of Object.values(cleanGraph.workflow.nodes)) {
      expect((node as any).qualified_id).toBeUndefined()
    }
  })

  it('round-trip: removeQualifiedIds then addQualifiedIds restores the original', () => {
    const roundTripped = addQualifiedIds(cleanGraph)
    expect(roundTripped).toEqual(qualifiedGraph)
  })

  it('addQualifiedIds handles an empty network', () => {
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

describe('parameter-node graph persistence', () => {
  beforeEach(() => {
    mockStore.nodeDataByType = {
      ...(defaultRegistry as unknown as RegisteredNodes),
      consumer: {
        type: 'consumer',
        node_type: 'void_method' as any,
        arguments: [
          { connection_type: 'input' as any, name: 'value', type: Type.DOUBLE },
        ],
        inputs: [0],
        outputs: [],
      },
    }
  })

  it('round-trips exposure metadata and stable virtual handles', () => {
    const inputHandle = parameterHandle('input', ['Solver', 'Tolerance'])
    const outputHandle = parameterHandle('output', ['Solver', 'Tolerance'])
    const nodes = [
      {
        id: '1',
        position: { x: 0, y: 0 },
        data: {
          type: 'std::string',
          node_type: 'elementary_constructor',
          arguments: [],
          inputs: [],
          outputs: [-1],
          value: 'poisson_2d.prm',
          parameter_file: {
            exposures: [
              {
                path: ['Solver', 'Tolerance'],
                type: 'double',
                input: true,
                output: true,
              },
            ],
          },
          working_file: {
            create_if_missing: true,
          },
        },
      },
      {
        id: '2',
        position: { x: 100, y: 0 },
        data: {
          type: 'double',
          node_type: 'elementary_constructor',
          arguments: [],
          inputs: [],
          outputs: [-1],
          value: '0.01',
        },
      },
      {
        id: '3',
        position: { x: 200, y: 0 },
        data: {
          type: 'consumer',
          node_type: 'void_method',
          arguments: [
            { connection_type: 'input', name: 'value', type: 'double' },
          ],
          inputs: [0],
          outputs: [],
        },
      },
    ] as any
    const edges = [
      {
        id: 'input',
        source: '2',
        sourceHandle: 'output-0',
        target: '1',
        targetHandle: inputHandle,
      },
      {
        id: 'output',
        source: '1',
        sourceHandle: outputHandle,
        target: '3',
        targetHandle: 'input-0',
      },
    ] as any

    const graph = parseGraphToProtocol(nodes, edges)
    const savedNode = graph.workflow.nodes['1'] as any
    expect(savedNode.parameter_file.exposures[0]).toEqual({
      path: ['Solver', 'Tolerance'],
      type: 'double',
      input: true,
      output: true,
    })
    expect(savedNode.working_file).toEqual({
      create_if_missing: true,
    })
    expect(graph.workflow.edges['0'].target_handle).toBe(inputHandle)
    expect(graph.workflow.edges['1'].source_handle).toBe(outputHandle)

    const restoredEdges = edgesFromProtocolToFlow(graph.workflow.edges)
    expect(restoredEdges[0].targetHandle).toBe(inputHandle)
    expect(restoredEdges[1].sourceHandle).toBe(outputHandle)

    const [validEdges, invalidEdges] = validateGraphData(graph)
    expect(Object.keys(validEdges)).toHaveLength(2)
    expect(invalidEdges).toHaveLength(0)
  })

  it('serializes only the concrete type, not palette metadata', () => {
    const nodes = [
      {
        id: '1',
        position: { x: 0, y: 0 },
        data: {
          type: 'GridGenerator::generate<2,2>',
          operation: 'GridGenerator::generate',
          display_name: 'Generate grid',
          node_type: 'void_function',
          arguments: [],
          inputs: [],
          outputs: [],
        },
      },
    ] as any

    const graph = parseGraphToProtocol(nodes, [])
    expect(graph.workflow.nodes['1']).toEqual({
      type: 'GridGenerator::generate<2,2>',
      position: { x: 0, y: 0 },
    })
  })
})
