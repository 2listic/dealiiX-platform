/**
 * Unit tests for the history API in graphStack.svelte.ts:
 * historyCheckpoint, historyBegin/historyCommit, undo, redo, clearHistory,
 * canUndo/canRedo, and the invariant that navigation discards _stagedEntry.
 *
 * Strategy
 * --------
 * `nodes.svelte` is mocked so that getNodesSnapshot/getEdgesSnapshot read
 * from a shared `mockCanvas` object, and setNodes/setEdges write back to it.
 * This lets tests drive "canvas state" by mutating mockCanvas directly and
 * assert that undo/redo restored the right values via the same object.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GraphContext } from './graphStack.svelte'

const mockCanvas = vi.hoisted(() => ({
  nodes: [] as any[],
  edges: [] as any[],
  setNodes: vi.fn((n: any[]) => {
    mockCanvas.nodes = structuredClone(n)
  }),
  setEdges: vi.fn((e: any[]) => {
    mockCanvas.edges = structuredClone(e)
  }),
  updateLastNodeId: vi.fn(),
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
  getNodesSnapshot: vi.fn(() => structuredClone(mockCanvas.nodes)),
  getEdgesSnapshot: vi.fn(() => structuredClone(mockCanvas.edges)),
  setNodes: mockCanvas.setNodes,
  setEdges: mockCanvas.setEdges,
  updateLastNodeId: mockCanvas.updateLastNodeId,
}))

const { graphStackState, graphHistoryState, persistActiveCanvas } =
  await import('./graphStack.svelte')

/** Helper: set canvas to a given state and return simple nodes/edges arrays. */
const setCanvas = (nodeIds: number[], edgeIds: number[] = []) => {
  mockCanvas.nodes = nodeIds.map((id) => ({ id: String(id) }))
  mockCanvas.edges = edgeIds.map((id) => ({ id: String(id) }))
}

/** Helper: return the current canvas node IDs as seen by the mock. */
const canvasNodeIds = () => mockCanvas.nodes.map((n: any) => Number(n.id))

beforeEach(() => {
  graphStackState.reset()
  mockCanvas.nodes = []
  mockCanvas.edges = []
  mockCanvas.setNodes.mockClear()
  mockCanvas.setEdges.mockClear()
  mockCanvas.updateLastNodeId.mockClear()
  // Initialize the stack with the current (empty) canvas.
  persistActiveCanvas()
})

// ── historyCheckpoint ──────────────────────────────────────────────────────────

describe('historyCheckpoint', () => {
  it('pushes current canvas state to past', () => {
    setCanvas([1, 2])
    graphHistoryState.checkpoint()
    expect(graphHistoryState.canUndo).toBe(true)
  })

  it('clears future when called after an undo', () => {
    setCanvas([1])
    graphHistoryState.checkpoint()
    setCanvas([1, 2])
    graphHistoryState.undo()
    expect(graphHistoryState.canRedo).toBe(true)

    setCanvas([1, 3])
    graphHistoryState.checkpoint()
    expect(graphHistoryState.canRedo).toBe(false)
  })

  it('caps the past stack at HISTORY_LIMIT (50)', () => {
    for (let i = 0; i < 60; i++) {
      setCanvas([i])
      graphHistoryState.checkpoint()
    }
    // Undo 50 times should exhaust the stack exactly.
    for (let i = 0; i < 50; i++) {
      graphHistoryState.undo()
    }
    expect(graphHistoryState.canUndo).toBe(false)
  })
})

// ── undo / redo ────────────────────────────────────────────────────────────────

describe('undo', () => {
  it('is a no-op when the past stack is empty', () => {
    setCanvas([1, 2])
    graphHistoryState.undo()
    expect(canvasNodeIds()).toEqual([1, 2])
    expect(mockCanvas.setNodes).not.toHaveBeenCalled()
  })

  it('restores the previous canvas state', () => {
    setCanvas([1])
    graphHistoryState.checkpoint()
    setCanvas([1, 2])

    graphHistoryState.undo()
    expect(canvasNodeIds()).toEqual([1])
  })

  it('moves the current state to the redo stack', () => {
    setCanvas([1])
    graphHistoryState.checkpoint()
    setCanvas([1, 2])

    graphHistoryState.undo()
    expect(graphHistoryState.canRedo).toBe(true)
  })

  it('calls updateLastNodeId after restoring', () => {
    setCanvas([1])
    graphHistoryState.checkpoint()
    setCanvas([1, 2])
    graphHistoryState.undo()
    expect(mockCanvas.updateLastNodeId).toHaveBeenCalled()
  })
})

describe('redo', () => {
  it('is a no-op when the future stack is empty', () => {
    setCanvas([1])
    graphHistoryState.checkpoint()
    setCanvas([1, 2])

    graphHistoryState.redo()
    expect(canvasNodeIds()).toEqual([1, 2])
  })

  it('restores the next canvas state', () => {
    setCanvas([1])
    graphHistoryState.checkpoint()
    setCanvas([1, 2])
    graphHistoryState.undo()

    graphHistoryState.redo()
    expect(canvasNodeIds()).toEqual([1, 2])
  })

  it('moves the restored state back to the undo stack', () => {
    setCanvas([1])
    graphHistoryState.checkpoint()
    setCanvas([1, 2])
    graphHistoryState.undo()
    graphHistoryState.redo()
    expect(graphHistoryState.canUndo).toBe(true)
  })
})

describe('undo/redo round-trip', () => {
  it('restores across multiple steps', () => {
    setCanvas([1])
    graphHistoryState.checkpoint()
    setCanvas([1, 2])
    graphHistoryState.checkpoint()
    setCanvas([1, 2, 3])

    graphHistoryState.undo()
    expect(canvasNodeIds()).toEqual([1, 2])
    graphHistoryState.undo()
    expect(canvasNodeIds()).toEqual([1])
    graphHistoryState.redo()
    expect(canvasNodeIds()).toEqual([1, 2])
    graphHistoryState.redo()
    expect(canvasNodeIds()).toEqual([1, 2, 3])
  })
})

// ── historyBegin / historyCommit ───────────────────────────────────────────────

describe('historyBegin / historyCommit', () => {
  it('commits to past when canvas changed since historyBegin', () => {
    setCanvas([1])
    graphHistoryState.begin()
    setCanvas([1, 2])

    graphHistoryState.commit()
    expect(graphHistoryState.canUndo).toBe(true)

    graphHistoryState.undo()
    expect(canvasNodeIds()).toEqual([1])
  })

  it('is a no-op when canvas did not change since historyBegin', () => {
    setCanvas([1])
    graphHistoryState.begin()
    // canvas unchanged
    graphHistoryState.commit()
    expect(graphHistoryState.canUndo).toBe(false)
  })

  it('is a no-op when historyBegin was never called', () => {
    setCanvas([1])
    graphHistoryState.commit()
    expect(graphHistoryState.canUndo).toBe(false)
  })

  it('clears the staged entry after commit', () => {
    setCanvas([1])
    graphHistoryState.begin()
    setCanvas([1, 2])
    graphHistoryState.commit()

    // A second commit without a new begin should be a no-op.
    setCanvas([1, 2, 3])
    graphHistoryState.commit()
    expect(graphHistoryState.canUndo).toBe(true)

    graphHistoryState.undo()
    expect(canvasNodeIds()).toEqual([1]) // restored to pre-begin state, not pre-second-commit
  })
})

// ── clearHistory ───────────────────────────────────────────────────────────────

describe('clearHistory', () => {
  it('empties past and future', () => {
    setCanvas([1])
    graphHistoryState.checkpoint()
    setCanvas([1, 2])
    graphHistoryState.undo()

    expect(graphHistoryState.canUndo).toBe(false)
    expect(graphHistoryState.canRedo).toBe(true)

    graphHistoryState.clearHistory()
    expect(graphHistoryState.canUndo).toBe(false)
    expect(graphHistoryState.canRedo).toBe(false)
  })

  it('discards any staged entry', () => {
    setCanvas([1])
    graphHistoryState.begin()
    setCanvas([1, 2])
    graphHistoryState.clearHistory()

    // commit after clear should be a no-op
    graphHistoryState.commit()
    expect(graphHistoryState.canUndo).toBe(false)
  })
})

// ── canUndo / canRedo ──────────────────────────────────────────────────────────

describe('canUndo / canRedo', () => {
  it('both false on a fresh stack', () => {
    expect(graphHistoryState.canUndo).toBe(false)
    expect(graphHistoryState.canRedo).toBe(false)
  })

  it('canUndo becomes true after historyCheckpoint', () => {
    setCanvas([1])
    graphHistoryState.checkpoint()
    expect(graphHistoryState.canUndo).toBe(true)
    expect(graphHistoryState.canRedo).toBe(false)
  })

  it('canRedo becomes true after undo, false after historyCheckpoint', () => {
    setCanvas([1])
    graphHistoryState.checkpoint()
    setCanvas([1, 2])
    graphHistoryState.undo()
    expect(graphHistoryState.canRedo).toBe(true)

    setCanvas([1, 3])
    graphHistoryState.checkpoint()
    expect(graphHistoryState.canRedo).toBe(false)
  })
})

// ── Navigation discards staged entry ──────────────────────────────────────────

describe('navigation clears staged entry', () => {
  const makeContext = (label: string): GraphContext => ({
    label,
    originalName: null,
    parentNodeId: null,
    nodes: [],
    edges: [],
    past: [],
    future: [],
  })

  it('pushContext discards staged entry', () => {
    setCanvas([1])
    graphHistoryState.begin()
    setCanvas([1, 2])

    graphStackState.pushContext(makeContext('sub'))
    graphStackState.collapseToParent(makeContext('root'))

    // commit should be a no-op — staged entry was discarded on pushContext
    graphHistoryState.commit()
    expect(graphHistoryState.canUndo).toBe(false)
  })

  it('reset discards staged entry', () => {
    setCanvas([1])
    graphHistoryState.begin()
    setCanvas([1, 2])
    graphStackState.reset()
    persistActiveCanvas()

    graphHistoryState.commit()
    expect(graphHistoryState.canUndo).toBe(false)
  })
})
