import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  NodeType,
  TypeField,
  type SubGraphNodeDefinition,
} from '../types/nodeTypes'

const mockState = vi.hoisted(() => ({
  currentNodes: [] as any[],
  currentEdges: [] as any[],
  networkNodes: new Set<string>(),
  networkNodeData: {} as Record<string, SubGraphNodeDefinition>,
  protocolNodes: [] as any[],
  protocolEdges: [] as any[],
  addNetworkNode: vi.fn(),
  removeNetworkNode: vi.fn(),
  setNodes: vi.fn((nodes: any[]) => {
    mockState.currentNodes = structuredClone(nodes)
  }),
  setEdges: vi.fn((edges: any[]) => {
    mockState.currentEdges = structuredClone(edges)
  }),
  updateLastNodeId: vi.fn(),
  createNetworkNodeDefinition: vi.fn(),
  toastAdd: vi.fn(),
}))

vi.mock('./currentProjectStore.svelte.js', () => ({
  currentProjectState: {
    get id() {
      return null
    },
    get name() {
      return 'Test Project'
    },
  },
}))

vi.mock('./nodes.svelte', () => ({
  addNetworkNode: mockState.addNetworkNode,
  getEdgesSnapshot: vi.fn(() => structuredClone(mockState.currentEdges)),
  getNetworkNodeDefinition: vi.fn(
    (name: string) => mockState.networkNodeData[name]
  ),
  getNodesSnapshot: vi.fn(() => structuredClone(mockState.currentNodes)),
  isNodeInNetworkNodes: vi.fn((name: string) =>
    mockState.networkNodes.has(name)
  ),
  removeNetworkNode: mockState.removeNetworkNode,
  setEdges: mockState.setEdges,
  setNodes: mockState.setNodes,
  updateLastNodeId: mockState.updateLastNodeId,
}))

vi.mock('../utils/networkNode', () => ({
  createNetworkNodeDefinition: mockState.createNetworkNodeDefinition,
}))

vi.mock('../utils/graphParser', () => ({
  nodesFromProtocolToFlow: vi.fn(() =>
    structuredClone(mockState.protocolNodes)
  ),
  edgesFromProtocolToFlow: vi.fn(() =>
    structuredClone(mockState.protocolEdges)
  ),
}))

vi.mock('./toastsStore.svelte.js', () => ({
  toastState: {
    add: mockState.toastAdd,
  },
}))

const makeNetworkCanvasNode = (
  id: string,
  name: string,
  extra: Partial<SubGraphNodeDefinition> = {}
) => ({
  id,
  type: NodeType.NETWORK,
  position: { x: 0, y: 0 },
  data: {
    type: TypeField.CORAL_NETWORK,
    node_type: NodeType.NETWORK,
    name,
    arguments: [],
    inputs: [],
    outputs: [],
    value: {
      author: 'test',
      date_time_utc: '',
      version: 1,
      workflow: { nodes: {}, edges: {} },
    },
    is_valid: true,
    ...extra,
  } as SubGraphNodeDefinition,
})

describe('graphNavigationState', () => {
  beforeEach(() => {
    vi.resetModules()
    mockState.currentNodes = []
    mockState.currentEdges = []
    mockState.networkNodes = new Set()
    mockState.networkNodeData = {}
    mockState.protocolNodes = []
    mockState.protocolEdges = []
    mockState.addNetworkNode.mockReset()
    mockState.removeNetworkNode.mockReset()
    mockState.setNodes.mockClear()
    mockState.setEdges.mockClear()
    mockState.updateLastNodeId.mockClear()
    mockState.createNetworkNodeDefinition.mockReset()
    mockState.toastAdd.mockReset()
  })

  it('removes the parent network node when leaving an empty subnetwork', async () => {
    const parentNode = makeNetworkCanvasNode('5', 'Sub')
    mockState.currentNodes = [
      parentNode,
      {
        id: '1',
        type: NodeType.ELEMENTARY_CONSTRUCTOR,
        position: { x: 0, y: 0 },
        data: { type: 'std::string' },
      },
    ]
    mockState.currentEdges = [
      {
        id: 'e1',
        source: '1',
        sourceHandle: 'output-0',
        target: '5',
        targetHandle: 'input-0',
      },
    ]
    mockState.networkNodes = new Set(['Sub'])
    mockState.networkNodeData.Sub = parentNode.data
    mockState.protocolNodes = []
    mockState.protocolEdges = []

    const { graphNavigationState } = await import('./graphNavigation.svelte')

    await graphNavigationState.enterSubnetwork('5')
    await graphNavigationState.goBack()

    expect(mockState.removeNetworkNode).toHaveBeenCalledWith('Sub')
    expect(mockState.currentNodes.map((node) => node.id)).toEqual(['1'])
    expect(mockState.currentEdges).toEqual([])
    expect(mockState.toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Removed empty subnetwork "Sub"',
      })
    )
    expect(graphNavigationState.canGoBack).toBe(false)
  })

  it('renames the current subnetwork and updates the parent node metadata immediately', async () => {
    const parentNode = makeNetworkCanvasNode('5', 'OldName')
    mockState.currentNodes = [parentNode]
    mockState.currentEdges = []
    mockState.networkNodes = new Set(['OldName'])
    mockState.networkNodeData.OldName = parentNode.data
    mockState.protocolNodes = [
      {
        id: '7',
        type: NodeType.ELEMENTARY_CONSTRUCTOR,
        position: { x: 10, y: 20 },
        data: { type: 'std::string' },
      },
    ]
    mockState.protocolEdges = []
    mockState.createNetworkNodeDefinition.mockReturnValue({
      type: TypeField.CORAL_NETWORK,
      node_type: NodeType.NETWORK,
      name: 'Renamed',
      arguments: [
        {
          connection_type: 'input',
          name: 'value',
          type: 'std::string',
        },
      ],
      inputs: [0],
      outputs: [],
      value: {
        author: 'test',
        date_time_utc: '',
        version: 1,
        workflow: { nodes: {}, edges: {} },
      },
      is_valid: true,
    })

    const { graphNavigationState } = await import('./graphNavigation.svelte')

    await graphNavigationState.enterSubnetwork('5')
    await graphNavigationState.renameCurrentSubnetwork('Renamed')

    expect(mockState.removeNetworkNode).toHaveBeenCalledWith('OldName')
    expect(mockState.addNetworkNode).toHaveBeenCalledWith(
      'Renamed',
      expect.objectContaining({ name: 'Renamed' })
    )
    expect(graphNavigationState.currentLabel).toBe('Renamed')
  })

  it('saves a non-empty subnetwork back into the parent graph', async () => {
    const parentNode = makeNetworkCanvasNode('5', 'Sub')
    mockState.currentNodes = [parentNode]
    mockState.currentEdges = []
    mockState.networkNodes = new Set(['Sub'])
    mockState.networkNodeData.Sub = parentNode.data
    mockState.protocolNodes = [
      {
        id: '7',
        type: NodeType.ELEMENTARY_CONSTRUCTOR,
        position: { x: 10, y: 20 },
        data: { type: 'std::string' },
      },
    ]
    mockState.protocolEdges = []
    mockState.createNetworkNodeDefinition.mockReturnValue({
      type: TypeField.CORAL_NETWORK,
      node_type: NodeType.NETWORK,
      name: 'Sub',
      arguments: [
        {
          connection_type: 'input',
          name: 'value',
          type: 'std::string',
        },
      ],
      inputs: [0],
      outputs: [],
      value: {
        author: 'test',
        date_time_utc: '',
        version: 1,
        workflow: { nodes: {}, edges: {} },
      },
      is_valid: true,
    })

    const { graphNavigationState } = await import('./graphNavigation.svelte')

    await graphNavigationState.enterSubnetwork('5')
    await graphNavigationState.goBack()

    expect(mockState.addNetworkNode).toHaveBeenCalledWith(
      'Sub',
      expect.objectContaining({ name: 'Sub' })
    )
    expect(mockState.currentNodes[0].data.arguments).toEqual([
      {
        connection_type: 'input',
        name: 'value',
        type: 'std::string',
      },
    ])
    expect(mockState.toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Saved changes to subnetwork "Sub"',
      })
    )
    expect(graphNavigationState.canGoBack).toBe(false)
  })
})
