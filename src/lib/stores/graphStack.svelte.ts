import type { Edge, Node } from '@xyflow/svelte'
import { currentProjectState } from './currentProjectStore.svelte.js'
import {
  getEdgesSnapshot,
  getNodesSnapshot,
  setEdges,
  setNodes,
  updateLastNodeId,
} from './nodes.svelte'

const HISTORY_LIMIT = 50

/** A point-in-time snapshot of the canvas, stored in the undo/redo stacks. */
type HistoryEntry = { nodes: Node[]; edges: Edge[] }

/** One entry per navigation level, from root graph down to the currently open subnetwork. */
export type GraphContext = {
  /** Display name shown in the breadcrumb trail. */
  label: string
  /** Original name of the subnetwork node before any in-session rename, or null for the root. */
  originalName: string | null
  /** ID of the network node on the parent canvas that was clicked to enter this level, or null for the root. */
  parentNodeId: string | null
  /** Last navigation-sync snapshot of the canvas at this level.
   *  Updated by syncCurrent() before any navigation action; restored when navigating back.
   *  Not the live canvas state — use getNodesSnapshot()/getEdgesSnapshot() for that. */
  current: HistoryEntry
  /** Undo stack for this navigation level — most-recent entry last.
   *  Touch only via graphHistoryState, never directly. */
  past: HistoryEntry[]
  /** Redo stack for this navigation level — most-recent entry last.
   *  Touch only via graphHistoryState, never directly. */
  future: HistoryEntry[]
}

/** The navigation stack. Starts with a root context so history and navigation are ready
 *  from the first user interaction. Nodes/edges are empty until a graph is loaded;
 *  syncCurrent() syncs the real canvas state before any navigation action. */
let graphStack = $state<GraphContext[]>([
  {
    label: 'Unsaved Project',
    originalName: null,
    parentNodeId: null,
    current: { nodes: [], edges: [] },
    past: [],
    future: [],
  },
])

/** Temporary pre-gesture snapshot held between begin() and commit().
 *  Discarded on any navigation action to prevent cross-level contamination. */
let _stagedEntry: HistoryEntry | null = null

/** Deep-copies nodes via $state.snapshot so mutations on the canvas don't affect saved contexts. */
const cloneNodes = (nodes: Node[]): Node[] =>
  $state.snapshot(nodes) as unknown as Node[]

/** Deep-copies edges via $state.snapshot so mutations on the canvas don't affect saved contexts. */
const cloneEdges = (edges: Edge[]): Edge[] =>
  $state.snapshot(edges) as unknown as Edge[]

/** Label for the root graph: the loaded project name, or 'Unsaved Project' when project is not yet loaded or saved. */
const rootLabel = (): string =>
  currentProjectState.id ? currentProjectState.name : 'Unsaved Project'

// ── Private helpers ──

/** Returns a deep snapshot of the current live canvas. */
const captureEntry = (): HistoryEntry => ({
  nodes: cloneNodes(getNodesSnapshot()),
  edges: cloneEdges(getEdgesSnapshot()),
})

/** Returns true when two history entries represent identical canvas states. */
const entriesEqual = (a: HistoryEntry, b: HistoryEntry): boolean =>
  JSON.stringify(a.nodes) === JSON.stringify(b.nodes) &&
  JSON.stringify(a.edges) === JSON.stringify(b.edges)

/**
 * Appends an entry to the top context's past stack and clears future.
 * Caps the stack at HISTORY_LIMIT, dropping the oldest entry when exceeded.
 */
const pushToPast = (entry: HistoryEntry): void => {
  const top = graphStack.at(-1)
  if (!top) return
  const past = [...top.past, entry].slice(-HISTORY_LIMIT)
  graphStack[graphStack.length - 1] = { ...top, past, future: [] }
}

/** Restores a history entry onto the live canvas. */
const applyEntry = (entry: HistoryEntry): void => {
  setNodes(entry.nodes)
  setEdges(entry.edges)
  updateLastNodeId()
}

// ── Navigation state ──

/** Reactive state object for graph navigation (subnetwork stack). */
export const graphStackState = {
  // ---- Reactive getters ----

  /** Labels for every level of the navigation stack, from root to current.
   *  Falls back to `[rootLabel()]` when the stack is uninitialized.
   */
  get breadcrumbs(): string[] {
    if (graphStack.length === 0) return [rootLabel()]
    return graphStack.map((context) => context.label)
  },

  /** True when there is at least one parent graph to navigate back to. */
  get canGoBack(): boolean {
    return graphStack.length > 1
  },

  /** Display name of the graph currently being edited.
   *  Returns `rootLabel()` directly when the stack is uninitialized.
   */
  get currentLabel(): string {
    return graphStack.at(-1)?.label ?? rootLabel()
  },

  // ---- Read accessors ----

  /** Returns the top (current) context, or undefined if the stack is empty. */
  getTopContext(): GraphContext | undefined {
    return graphStack.at(-1)
  },

  /** Returns the parent (second from top) context, or undefined if it doesn't exist. */
  getParentContext(): GraphContext | undefined {
    return graphStack.at(-2)
  },

  // ---- Mutators ----

  /**
   * Syncs the live canvas state into the top entry of the context stack.
   * Call this before any navigation action.
   *
   * Note: updates GraphContext.current only — not the undo/redo history.
   */
  syncCurrent(): void {
    this.updateTopContext({ current: captureEntry() })
  },

  /** Resets the context stack to a single empty root context. */
  reset(): void {
    graphStack = [
      {
        label: rootLabel(),
        originalName: null,
        parentNodeId: null,
        current: { nodes: [], edges: [] },
        past: [],
        future: [],
      },
    ]
    _stagedEntry = null
  },

  /** Appends a new context to the top of the stack. */
  pushContext(ctx: GraphContext): void {
    _stagedEntry = null
    graphStack = [...graphStack, ctx]
  },

  /**
   * Updates the top (current) context entry in place.
   * @param updates - Partial fields to merge into the top context.
   */
  updateTopContext(updates: Partial<GraphContext>): void {
    const top = graphStack.at(-1)
    if (!top) return
    graphStack[graphStack.length - 1] = { ...top, ...updates }
  },

  /**
   * Updates the parent (second from top) context entry in place.
   * @param updates - Partial fields to merge into the parent context.
   */
  updateParentContext(updates: Partial<GraphContext>): void {
    const parentIndex = graphStack.length - 2
    if (parentIndex < 0) return
    graphStack[parentIndex] = { ...graphStack[parentIndex], ...updates }
  },

  /**
   * Replaces the top two context entries with a single updated parent context.
   * Used when navigating back: pops the current subnetwork level and restores
   * the parent with any changes accumulated during the subnetwork edit.
   * @param updatedParent - The new parent context to push after popping both entries.
   */
  collapseToParent(updatedParent: GraphContext): void {
    _stagedEntry = null
    graphStack = [...graphStack.slice(0, -2), updatedParent]
  },
}

// ── Undo / redo history state ──

/** Reactive state object for undo/redo history, scoped to the current navigation level. */
export const graphHistoryState = {
  // ---- Reactive getters ----

  /** True when there is at least one action to undo at the current navigation level. */
  get canUndo(): boolean {
    return (graphStack.at(-1)?.past.length ?? 0) > 0
  },

  /** True when there is at least one action to redo at the current navigation level. */
  get canRedo(): boolean {
    return (graphStack.at(-1)?.future.length ?? 0) > 0
  },

  // ---- Mutators ----

  /**
   * Snapshots the current canvas and pushes it onto the undo stack immediately.
   * Use before discrete actions where the full mutation happens in a single step.
   *
   * Note: distinct from syncCurrent(), which updates GraphContext.current
   */
  checkpoint(): void {
    pushToPast(captureEntry())
  },

  /**
   * Captures the current canvas state into a temporary slot without pushing
   * it to the undo stack yet. Call at the start of a multi-step gesture
   * (e.g. node drag start, input focus) to record the pre-gesture state.
   * Pair with commit() at the end of the gesture.
   */
  begin(): void {
    _stagedEntry = captureEntry()
  },

  /**
   * Commits the staged pre-gesture snapshot to the undo stack if the canvas
   * has changed since begin() was called. No-op if begin() was never called
   * or if the canvas state is identical to the staged snapshot.
   * Call at the end of a multi-step gesture (e.g. node drag stop, input blur).
   */
  commit(): void {
    if (!_stagedEntry) return
    const liveState = captureEntry()
    if (!entriesEqual(_stagedEntry, liveState)) {
      pushToPast(_stagedEntry)
    }
    _stagedEntry = null
  },

  /**
   * Restores the previous canvas state, moving the current state to the redo stack.
   * No-op when the undo stack for the current navigation level is empty.
   */
  undo(): void {
    const top = graphStack.at(-1)
    if (!top || top.past.length === 0) return
    const prev = top.past.at(-1)!
    const liveState = captureEntry()
    graphStack[graphStack.length - 1] = {
      ...top,
      past: top.past.slice(0, -1),
      future: [...top.future, liveState],
    }
    applyEntry(prev)
  },

  /**
   * Restores the next canvas state, moving the current state back to the undo stack.
   * No-op when the redo stack for the current navigation level is empty.
   */
  redo(): void {
    const top = graphStack.at(-1)
    if (!top || top.future.length === 0) return
    const next = top.future.at(-1)!
    const liveState = captureEntry()
    graphStack[graphStack.length - 1] = {
      ...top,
      past: [...top.past, liveState],
      future: top.future.slice(0, -1),
    }
    applyEntry(next)
  },

  /**
   * Clears the undo and redo stacks for the current navigation level.
   * Call after a full graph load to discard pre-load history.
   */
  clearHistory(): void {
    const top = graphStack.at(-1)
    if (!top) return
    graphStack[graphStack.length - 1] = { ...top, past: [], future: [] }
    _stagedEntry = null
  },
}
