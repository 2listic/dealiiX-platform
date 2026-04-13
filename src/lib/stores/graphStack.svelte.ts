import type { Edge, Node } from '@xyflow/svelte'
import { currentProjectState } from './currentProjectStore.svelte.js'
import { getEdgesSnapshot, getNodesSnapshot } from './nodes.svelte'

/** One entry per navigation level, from root graph down to the currently open subnetwork. */
export type GraphContext = {
  /** Display name shown in the breadcrumb trail. */
  label: string
  /** Original name of the subnetwork node before any in-session rename, or null for the root. */
  originalName: string | null
  /** ID of the network node on the parent canvas that was double-clicked to enter this level, or null for the root. */
  parentNodeId: string | null
  /** Snapshot of the canvas nodes at this level, saved before navigating away. */
  nodes: Node[]
  /** Snapshot of the canvas edges at this level, saved before navigating away. */
  edges: Edge[]
}

/** The navigation stack — empty until the first navigation action initializes it. */
let graphStack = $state<GraphContext[]>([])

/** Deep-copies nodes via $state.snapshot so mutations on the canvas don't affect saved contexts. */
const cloneNodes = (nodes: Node[]): Node[] =>
  $state.snapshot(nodes) as unknown as Node[]

/** Deep-copies edges via $state.snapshot so mutations on the canvas don't affect saved contexts. */
const cloneEdges = (edges: Edge[]): Edge[] =>
  $state.snapshot(edges) as unknown as Edge[]

/** Label for the root graph: the loaded project name, or 'Unsaved Project' when project is not yet loaded or saved. */
const rootLabel = (): string =>
  currentProjectState.id ? currentProjectState.name : 'Unsaved Project'

const isInitialized = (): boolean => graphStack.length > 0

/**
 * Lazily initializes the graph stack with a root entry if it is empty.
 *
 * The root context is not created at module load time because the canvas may
 * not have loaded its graph yet. Deferring creation ensures the snapshot
 * captures the real initial state rather than an empty canvas.
 *
 * Safe to call multiple times — it is a no-op when the stack already has
 * at least one entry.
 */
const safelyInitGraphStack = () => {
  if (isInitialized()) return

  // Push the root context, snapshotting whatever is currently on the canvas.
  graphStack = [
    {
      label: rootLabel(),
      originalName: null,
      parentNodeId: null,
      nodes: cloneNodes(getNodesSnapshot()),
      edges: cloneEdges(getEdgesSnapshot()),
    },
  ]
}

/**
 * Snapshots the live canvas state into the top entry of the context stack,
 * preserving any unsaved edits before a navigation action takes place.
 *
 * The reactive @xyflow canvas state is the source of truth while the user
 * is editing. This function bridges it back into the stack so that
 * `enterSubnetwork`, `loadParentGraph`, and `renameCurrentSubnetwork` always work
 * from an up-to-date snapshot rather than a stale one.
 */
export const persistActiveCanvas = () => {
  // Guarantee a root entry exists before writing to the top of the stack.
  safelyInitGraphStack()

  // Overwrite only the nodes/edges of the current (top) context with a
  // non-reactive deep copy of the live canvas.
  graphStack[graphStack.length - 1] = {
    ...graphStack[graphStack.length - 1],
    nodes: cloneNodes(getNodesSnapshot()),
    edges: cloneEdges(getEdgesSnapshot()),
  }
}

/** Reactive state object for the context stack. */
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

  /** Clears the entire context stack, returning to the uninitialized state. */
  reset(): void {
    graphStack = []
  },

  /** Appends a new context to the top of the stack. */
  pushContext(ctx: GraphContext): void {
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
    graphStack = [...graphStack.slice(0, -2), updatedParent]
  },
}
