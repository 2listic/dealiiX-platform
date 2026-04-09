import type { Edge, Node } from '@xyflow/svelte'
import { currentProjectState } from './currentProjectStore.svelte.js'
import { getEdgesSnapshot, getNodesSnapshot } from './nodes.svelte'

export type GraphContext = {
  label: string
  originalName: string | null
  parentNodeId: string | null
  nodes: Node[]
  edges: Edge[]
}

let graphStack = $state<GraphContext[]>([])

const cloneNodes = (nodes: Node[]): Node[] =>
  $state.snapshot(nodes) as unknown as Node[]

const cloneEdges = (edges: Edge[]): Edge[] =>
  $state.snapshot(edges) as unknown as Edge[]

const rootLabel = (): string =>
  currentProjectState.id ? currentProjectState.name : 'Main Graph'

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
 *
 * Kept as a standalone export (not on graphStackState) because it also
 * reads from the nodes store — it is not a pure graphStack operation.
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

/**
 * Reactive state object for the context stack.
 *
 * All members exclusively read from or write to `graphStack` — nothing
 * that touches the canvas or other stores. That boundary keeps this object
 * a pure store and makes its behaviour easy to reason about in isolation.
 */
export const graphStackState = {
  // ---- Reactive getters ----

  get breadcrumbs(): string[] {
    safelyInitGraphStack()
    return graphStack.map((context) => context.label)
  },

  get canGoBack(): boolean {
    return graphStack.length > 1
  },

  get currentLabel(): string {
    safelyInitGraphStack()
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
