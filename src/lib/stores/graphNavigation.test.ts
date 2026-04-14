/**
 * Unit tests for graphNavigation.svelte.ts — the high-level subnetwork
 * navigation actions (enterSubnetwork, loadParentGraph, renameCurrentSubnetwork).
 *
 * Strategy
 * --------
 * All store and utility dependencies are mocked so that tests exercise only the
 * navigation logic itself, without a real Svelte runtime, Electron IPC, or file
 * system. A single `mockState` object acts as a shared in-memory "world":
 *
 *   - `currentNodes` / `currentEdges`   — the live canvas (what the user sees)
 *   - `networkNodes` / `networkNodeData` — the subnetwork registry
 *   - `protocolNodes` / `protocolEdges` — the inner graph returned by the parser
 *   - spy functions for every store mutation and utility call
 *
 * The tests follow a pattern of: seed mockState → call navigation action(s) →
 * assert on spy calls and resulting canvas state.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  NodeType,
  TypeField,
  type SubGraphNodeDefinition,
} from '../types/nodeTypes'

/**
 * Shared in-memory state and spies, hoisted so they are available inside all
 * `vi.mock` factory functions that run before imports are resolved.
 *
 * Spy implementations for `setNodes`/`setEdges` also write back to
 * `currentNodes`/`currentEdges`, so that subsequent `getNodesSnapshot` /
 * `getEdgesSnapshot` calls (inside the module under test) observe the updated
 * canvas as they would in production.
 */
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

/**
 * Returns a project with `id: null` so `graphStackState.currentLabel` resolves
 * to 'Unsaved Project' at the root level, making breadcrumb assertions stable.
 */
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

/**
 * Canvas store: snapshot functions read from `mockState`, write functions
 * delegate to the spies that also update `mockState` so later snapshots
 * reflect the new canvas contents.
 */
vi.mock('./nodes.svelte', () => ({
  getEdgesSnapshot: vi.fn(() => structuredClone(mockState.currentEdges)),
  getNodesSnapshot: vi.fn(() => structuredClone(mockState.currentNodes)),
  setEdges: mockState.setEdges,
  setNodes: mockState.setNodes,
  updateLastNodeId: mockState.updateLastNodeId,
}))

/**
 * Network-node registry: lookups read from `mockState.networkNodes` /
 * `mockState.networkNodeData`; mutations are plain spies.
 */
vi.mock('./registryStore.svelte', () => ({
  addNetworkNode: mockState.addNetworkNode,
  getNetworkNodeDefinition: vi.fn(
    (name: string) => mockState.networkNodeData[name]
  ),
  isNodeInNetworkNodes: vi.fn((name: string) =>
    mockState.networkNodes.has(name)
  ),
  removeNetworkNode: mockState.removeNetworkNode,
}))

/**
 * `createNetworkNodeDefinition` is a plain spy; each test sets its return
 * value via `.mockReturnValue(...)` to control what the rebuilt definition looks like.
 */
vi.mock('../utils/networkNode', () => ({
  createNetworkNodeDefinition: mockState.createNetworkNodeDefinition,
}))

/**
 * `isNetworkCanvasNode` is kept real (via `importActual`) because it is a
 * type-guard that gates whether `enterSubnetwork` proceeds. Mocking it to
 * always return true/false would make navigation tests meaningless.
 * All other canvas utilities from this module are unused in these tests.
 */
vi.mock('../utils/networkNodeCanvas', async () => {
  const actual = await vi.importActual<
    typeof import('../utils/networkNodeCanvas')
  >('../utils/networkNodeCanvas')
  return {
    isNetworkCanvasNode: actual.isNetworkCanvasNode,
  }
})

/**
 * Graph parser: both conversion functions return clones of the protocol-format
 * arrays in `mockState`, simulating what the real parser would produce when
 * loading a subnetwork's inner workflow.
 */
vi.mock('../utils/graphParser', () => ({
  nodesFromProtocolToFlow: vi.fn(() =>
    structuredClone(mockState.protocolNodes)
  ),
  edgesFromProtocolToFlow: vi.fn(() =>
    structuredClone(mockState.protocolEdges)
  ),
}))

/** Captures `toastState.add(...)` calls so tests can assert on user-facing feedback. */
vi.mock('./toastsStore.svelte.js', () => ({
  toastState: {
    add: mockState.toastAdd,
  },
}))

/**
 * Builds a minimal empty @xyflow network (subnetwork) node.
 *
 * @param id - Canvas node ID (string, as used by @xyflow).
 * @param name - Subnetwork name used to look up its definition in the registry.
 * @param extra - Optional partial overrides merged into the node's data field.
 */
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
  /**
   * Resets all shared state and spies before each test.
   *
   * `vi.resetModules()` is required because `graphNavigation.svelte.ts` and
   * `graphStack.svelte.ts` hold module-level `$state` (the navigation stack).
   * Without a module reset, stack entries from one test would leak into the next.
   * Each test therefore does a fresh dynamic `import()` to get a clean instance.
   *
   * `mockClear()` resets call counts without clearing return values; `mockReset()`
   * additionally clears any `mockReturnValue(...)` set in a previous test.
   */
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
    // Parent canvas: subnetwork node '5' ("Sub") connected to a regular node '1'.
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
    // Registry knows about "Sub"; the inner graph is empty (all nodes deleted).
    mockState.networkNodes = new Set(['Sub'])
    mockState.networkNodeData.Sub = parentNode.data
    mockState.protocolNodes = []
    mockState.protocolEdges = []

    // Dynamic imports are required because vi.resetModules() was called in beforeEach,
    // giving each test a fresh module instance with a clean navigation stack.
    const { enterSubnetwork, loadParentGraph } = await import(
      './graphNavigation.svelte'
    )
    const { graphStackState } = await import('./graphStack.svelte')

    // Enter the subnetwork, then immediately go back — simulates a user who
    // deleted every node inside before navigating back.
    await enterSubnetwork('5')
    await loadParentGraph()

    // Empty subnetwork: registry entry must be removed.
    expect(mockState.removeNetworkNode).toHaveBeenCalledWith('Sub')
    // Only node '1' survives; node '5' and its edge are stripped from the parent.
    expect(mockState.currentNodes.map((node) => node.id)).toEqual(['1'])
    expect(mockState.currentEdges).toEqual([])
    // User sees a toast explaining why the subnetwork node disappeared.
    expect(mockState.toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Removed empty subnetwork "Sub"',
      })
    )
    // Stack is back to root — there is no parent to go back to.
    expect(graphStackState.canGoBack).toBe(false)
  })

  it('renames the current subnetwork and updates the parent node metadata immediately', async () => {
    // Parent canvas has only the subnetwork node to rename.
    const parentNode = makeNetworkCanvasNode('5', 'OldName')
    mockState.currentNodes = [parentNode]
    mockState.currentEdges = []
    mockState.networkNodes = new Set(['OldName'])
    mockState.networkNodeData.OldName = parentNode.data
    // The inner graph has one node, so the subnetwork is non-empty after entering.
    mockState.protocolNodes = [
      {
        id: '7',
        type: NodeType.ELEMENTARY_CONSTRUCTOR,
        position: { x: 10, y: 20 },
        data: { type: 'std::string' },
      },
    ]
    mockState.protocolEdges = []
    // `createNetworkNodeDefinition` returns a definition carrying the new name so
    // the rename logic can detect the change and swap registry entries.
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

    const { enterSubnetwork, renameCurrentSubnetwork } = await import(
      './graphNavigation.svelte'
    )
    const { graphStackState } = await import('./graphStack.svelte')

    // Enter the subnetwork, then rename in-place (no navigation back).
    await enterSubnetwork('5')
    await renameCurrentSubnetwork('Renamed')

    // Old registry entry removed, new one registered under the new name.
    expect(mockState.removeNetworkNode).toHaveBeenCalledWith('OldName')
    expect(mockState.addNetworkNode).toHaveBeenCalledWith(
      'Renamed',
      expect.objectContaining({ name: 'Renamed' })
    )
    // Breadcrumb must reflect the new name immediately, without navigating back.
    expect(graphStackState.currentLabel).toBe('Renamed')
  })

  it('saves a non-empty subnetwork back into the parent graph', async () => {
    // Parent canvas has only the subnetwork node '5'.
    const parentNode = makeNetworkCanvasNode('5', 'Sub')
    mockState.currentNodes = [parentNode]
    mockState.currentEdges = []
    mockState.networkNodes = new Set(['Sub'])
    mockState.networkNodeData.Sub = parentNode.data
    // The inner graph has one node — the subnetwork is non-empty.
    mockState.protocolNodes = [
      {
        id: '7',
        type: NodeType.ELEMENTARY_CONSTRUCTOR,
        position: { x: 10, y: 20 },
        data: { type: 'std::string' },
      },
    ]
    mockState.protocolEdges = []
    // The rebuilt definition exposes one input argument on the subnetwork boundary.
    // This is what the parent canvas node's data should be updated to on exit.
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

    const { enterSubnetwork, loadParentGraph } = await import(
      './graphNavigation.svelte'
    )
    const { graphStackState } = await import('./graphStack.svelte')

    // Enter the subnetwork, then navigate back — simulates a user who edited
    // the inner graph and then clicked the breadcrumb to return.
    await enterSubnetwork('5')
    await loadParentGraph()

    // Registry must be updated with the rebuilt definition.
    expect(mockState.addNetworkNode).toHaveBeenCalledWith(
      'Sub',
      expect.objectContaining({ name: 'Sub' })
    )
    // The canvas node '5' (index 0) must have its arguments updated to match
    // the new subnetwork boundary so its handles are correct.
    expect(mockState.currentNodes[0].data.arguments).toEqual([
      {
        connection_type: 'input',
        name: 'value',
        type: 'std::string',
      },
    ])
    // User sees a confirmation toast.
    expect(mockState.toastAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Saved changes to subnetwork "Sub"',
      })
    )
    // Stack is back to root.
    expect(graphStackState.canGoBack).toBe(false)
  })
})
