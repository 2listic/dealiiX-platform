import type { Edge, Node } from '@xyflow/svelte'
import {
  getNodesSnapshot,
  setEdges,
  setNodes,
  updateLastNodeId,
} from './nodes.svelte'
import {
  addNetworkNode,
  getNetworkNodeDefinition,
  isNodeInNetworkNodes,
  removeNetworkNode,
} from './registryStore.svelte'
import { createNetworkNodeDefinition } from '../utils/networkNode'
import { isNetworkCanvasNode } from '../utils/networkNodeCanvas'
import {
  edgesFromProtocolToFlow,
  nodesFromProtocolToFlow,
} from '../utils/graphParser'
import {
  handleIdToIndex,
  resolveInputArgument,
  resolveOutputType,
} from '../utils/canvasNodeUtils'
import type {
  NodeDefinitions,
  SubGraphNodeDefinition,
} from '../types/nodeTypes'
import { toastState } from './toastsStore.svelte.js'
import { graphStackState } from './graphStack.svelte'

/**
 * Drills into a subnetwork node, replacing the canvas with its inner graph.
 *
 * The current canvas is snapshotted onto the context stack so it can be
 * restored when the user navigates back. The subnetwork's inner nodes and
 * edges are loaded from the network node store and converted to @xyflow
 * format before being applied to the canvas.
 *
 * @param nodeId - The canvas node ID of the subnetwork to enter.
 */
export const enterSubnetwork = async (nodeId: string): Promise<void> => {
  try {
    // Validate that the target node is a subnetwork canvas node.
    const currentNodes = getNodesSnapshot()
    const targetNode = currentNodes.find((node) => node.id === nodeId)
    if (!isNetworkCanvasNode(targetNode)) {
      throw new Error(`Node '${nodeId}' is not a subnetwork`)
    }

    // Snapshot the current canvas into the top of the stack before leaving.
    graphStackState.syncCurrent()

    // Convert the subnetwork's stored protocol graph to @xyflow format.
    const networkNodeData = getNetworkNodeDefinition(targetNode.data.name)
    const nextNodes = nodesFromProtocolToFlow(
      networkNodeData.value.workflow.nodes
    )
    const nextEdges = edgesFromProtocolToFlow(
      networkNodeData.value.workflow.edges
    )

    // Push a new context for the subnetwork level, recording the parent
    // node ID so it can be updated when navigating back.
    graphStackState.pushContext({
      label: targetNode.data.name,
      originalName: targetNode.data.name,
      parentNodeId: nodeId,
      current: { nodes: cloneNodes(nextNodes), edges: cloneEdges(nextEdges) },
      past: [],
      future: [],
    })

    // Replace the canvas with the inner graph.
    applyCanvasState(nextNodes, nextEdges)
  } catch (error) {
    console.error('Failed to enter subnetwork:', error)
    toastState.add({
      message: errorMessage(error, 'Failed to open subnetwork'),
      type: 'error',
    })
  }
}

/**
 * Navigates back to the parent graph, persisting any edits made to the
 * current subnetwork.
 *
 * The current canvas is snapshotted and used to rebuild the network node
 * definition. The parent context's canvas node is then updated with the
 * new definition (arguments, inputs, outputs) so the interface reflects
 * any structural changes made while editing.
 *
 * Special case: if the subnetwork is left empty (all nodes deleted), the
 * corresponding canvas node is removed from the parent graph entirely and
 * the network node entry is deleted from the store.
 */
export const loadParentGraph = async (): Promise<void> => {
  // Can't go back from the root context.
  if (!graphStackState.canGoBack) {
    return
  }

  // Snapshot any unsaved edits from the live canvas into the current context.
  graphStackState.syncCurrent()

  const currentContext = graphStackState.getTopContext()
  const parentContext = graphStackState.getParentContext()
  if (!currentContext || !parentContext) {
    return
  }

  try {
    // Empty subnetwork: remove the node from the parent and clean up the store.
    if (currentContext.current.nodes.length === 0) {
      if (
        currentContext.originalName &&
        isNodeInNetworkNodes(currentContext.originalName)
      ) {
        await removeNetworkNode(currentContext.originalName)
      }

      // Strip the subnetwork node and all its connected edges from the parent.
      const parentNodes = cloneNodes(parentContext.current.nodes).filter(
        (node) => node.id !== currentContext.parentNodeId
      )
      const parentEdges = cloneEdges(parentContext.current.edges).filter(
        (edge) =>
          edge.source !== currentContext.parentNodeId &&
          edge.target !== currentContext.parentNodeId
      )

      graphStackState.collapseToParent({
        ...parentContext,
        current: { nodes: parentNodes, edges: parentEdges },
      })
      applyCanvasState(parentNodes, parentEdges)
      toastState.add({
        message: `Removed empty subnetwork "${currentContext.label}"`,
        timeout: 2500,
      })
      return
    }

    // Rebuild the network node definition from the current subnetwork's graph.
    const updatedNetworkNode = createNetworkNodeDefinition(
      currentContext.label,
      currentContext.current.nodes,
      currentContext.current.edges
    )

    // If the name changed during editing, remove the stale store entry.
    if (
      currentContext.originalName &&
      currentContext.originalName !== updatedNetworkNode.name &&
      isNodeInNetworkNodes(currentContext.originalName)
    ) {
      await removeNetworkNode(currentContext.originalName)
    }

    // Persist the updated definition to the network nodes store.
    await addNetworkNode(updatedNetworkNode.name, updatedNetworkNode)

    // Update the subnetwork's canvas node in the parent context so its
    // handle interface (arguments, inputs, outputs) stays in sync.
    let parentNodeFound = false
    const parentNodes = cloneNodes(parentContext.current.nodes).map((node) => {
      if (
        node.id !== currentContext.parentNodeId ||
        !isNetworkCanvasNode(node)
      ) {
        return node
      }

      parentNodeFound = true
      return {
        ...node,
        data: {
          ...node.data,
          name: updatedNetworkNode.name,
          arguments: updatedNetworkNode.arguments,
          inputs: updatedNetworkNode.inputs,
          outputs: updatedNetworkNode.outputs,
        },
      }
    })

    if (!parentNodeFound) {
      throw new Error('Parent subnetwork node was not found.')
    }

    // Remove edges that became stale because the subnetwork interface changed
    // (out-of-bounds handle indices or type mismatches after boundary rebuild).
    const [validParentEdges, removedEdgesCount] = filterStaleParentEdges(
      cloneEdges(parentContext.current.edges),
      parentNodes,
      currentContext.parentNodeId!,
      updatedNetworkNode
    )

    // Pop current context and update parent context with new subnetwork definition and validated edges
    graphStackState.collapseToParent({
      ...parentContext,
      current: { nodes: parentNodes, edges: validParentEdges },
    })
    // Restore the parent graph on canvas
    applyCanvasState(parentNodes, validParentEdges)
    toastState.add({
      message: `Saved changes to subnetwork "${updatedNetworkNode.name}"`,
      timeout: 2500,
    })
    if (removedEdgesCount > 0) {
      toastState.add({
        message: `Removed ${removedEdgesCount} edge${removedEdgesCount === 1 ? '' : 's'} — subnetwork interface changed`,
        type: 'error',
      })
    }
  } catch (error) {
    console.error('Failed to leave subnetwork:', error)
    toastState.add({
      message: errorMessage(
        error,
        `Failed to save changes for subnetwork "${currentContext.label}"`
      ),
      type: 'error',
    })
  }
}

/**
 * Renames the current subnetwork in place without navigating away.
 *
 * Re-creates the network node definition under the new name, removes the
 * old store entry if the name changed, and updates both the top context
 * and the parent context's canvas node so everything stays in sync.
 *
 * @param name - The new name for the current subnetwork.
 * @throws If the name is empty.
 */
export const renameCurrentSubnetwork = async (name: string): Promise<void> => {
  // Only works when inside a subnetwork.
  if (!graphStackState.canGoBack) {
    return
  }

  const trimmedName = name.trim()
  if (!trimmedName) {
    throw new Error('Subnetwork name cannot be empty.')
  }

  const currentContext = graphStackState.getTopContext()
  if (!currentContext) {
    return
  }

  if (trimmedName === currentContext.label) {
    return
  }

  // Snapshot edits so the rebuilt definition includes any recent canvas changes.
  graphStackState.syncCurrent()

  // Re-read after persist — nodes/edges may have been updated.
  const refreshedCurrentContext = graphStackState.getTopContext()
  const parentContext = graphStackState.getParentContext()
  if (!refreshedCurrentContext || !parentContext) {
    return
  }

  const updatedNetworkNode = createNetworkNodeDefinition(
    trimmedName,
    refreshedCurrentContext.current.nodes,
    refreshedCurrentContext.current.edges
  )

  // If the name changed, remove the stale store entry before adding the new one.
  if (
    refreshedCurrentContext.originalName &&
    refreshedCurrentContext.originalName !== updatedNetworkNode.name &&
    isNodeInNetworkNodes(refreshedCurrentContext.originalName)
  ) {
    await removeNetworkNode(refreshedCurrentContext.originalName)
  }

  await addNetworkNode(updatedNetworkNode.name, updatedNetworkNode)

  // Update the subnetwork's canvas node in the parent context so its
  // handle interface (arguments, inputs, outputs) stays in sync.
  const parentNodes = cloneNodes(parentContext.current.nodes).map((node) => {
    if (
      node.id !== refreshedCurrentContext.parentNodeId ||
      !isNetworkCanvasNode(node)
    ) {
      return node
    }

    return {
      ...node,
      data: {
        ...node.data,
        name: updatedNetworkNode.name,
        arguments: updatedNetworkNode.arguments,
        inputs: updatedNetworkNode.inputs,
        outputs: updatedNetworkNode.outputs,
      },
    }
  })

  // Update both contexts: parent gets the new node data, current gets the new name.
  graphStackState.updateParentContext({
    current: { nodes: parentNodes, edges: parentContext.current.edges },
  })
  graphStackState.updateTopContext({
    label: updatedNetworkNode.name,
    originalName: updatedNetworkNode.name,
  })
}

// ── Private helpers ────────────────────────────────────────────────────────────

const cloneNodes = (nodes: Node[]): Node[] =>
  $state.snapshot(nodes) as unknown as Node[]

const cloneEdges = (edges: Edge[]): Edge[] =>
  $state.snapshot(edges) as unknown as Edge[]

const errorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return fallback
}

/**
 * Replaces the live canvas with the given nodes and edges.
 * Clones both arrays before writing so the stack's stored context
 * and the canvas state remain independent references.
 * @param nodes - Nodes to load onto the canvas.
 * @param edges - Edges to load onto the canvas.
 */
const applyCanvasState = (nodes: Node[], edges: Edge[]) => {
  setNodes(cloneNodes(nodes))
  setEdges(cloneEdges(edges))
  updateLastNodeId()
}

/**
 * Filters parent graph edges that became stale after a subnetwork interface changed.
 *
 * An edge is removed if its handle index is out of bounds on the updated subnetwork node,
 * or if the type at that handle no longer matches the connecting node's type.
 * Both cases arise when `analyzeNetworkBoundary` rebuilds the interface from scratch
 * (e.g. a free port was consumed internally, or argument order shifted due to new nodes).
 *
 * @returns A tuple of [valid edges, number of removed edges].
 */
const filterStaleParentEdges = (
  edges: Edge[],
  parentNodes: Node[],
  parentNodeId: string,
  updatedNetworkNode: SubGraphNodeDefinition
): [Edge[], number] => {
  let removedCount = 0

  const validEdges = edges.filter((edge) => {
    if (edge.source !== parentNodeId && edge.target !== parentNodeId) {
      return true
    }

    if (edge.target === parentNodeId) {
      // Incoming edge: check the target handle exists and types still match.
      const inputIndex = handleIdToIndex(edge.targetHandle as string)
      const argIndex = updatedNetworkNode.inputs[inputIndex]
      if (argIndex == null) {
        removedCount++
        return false
      }
      const expectedType = updatedNetworkNode.arguments[argIndex]?.type
      const sourceNode = parentNodes.find((n) => n.id === edge.source)
      const actualType = sourceNode
        ? resolveOutputType(
            sourceNode.data as NodeDefinitions,
            handleIdToIndex(edge.sourceHandle as string)
          )
        : null
      if (actualType !== expectedType) {
        removedCount++
        return false
      }
    } else {
      // Outgoing edge: check the source handle exists and types still match.
      const outputIndex = handleIdToIndex(edge.sourceHandle as string)
      const argIndex = updatedNetworkNode.outputs[outputIndex]
      if (argIndex == null) {
        removedCount++
        return false
      }
      const expectedType = updatedNetworkNode.arguments[argIndex]?.type
      const targetNode = parentNodes.find((n) => n.id === edge.target)
      const actualType = targetNode
        ? resolveInputArgument(
            targetNode.data as NodeDefinitions,
            handleIdToIndex(edge.targetHandle as string)
          )?.type
        : null
      if (actualType !== expectedType) {
        removedCount++
        return false
      }
    }

    return true
  })

  return [validEdges, removedCount]
}
