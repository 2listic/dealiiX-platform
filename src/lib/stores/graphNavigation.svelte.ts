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
import {
  createNetworkNodeDefinition,
  isNetworkCanvasNode,
} from '../utils/networkNode'
import {
  edgesFromProtocolToFlow,
  nodesFromProtocolToFlow,
} from '../utils/graphParser'
import { toastState } from './toastsStore.svelte.js'
import { graphStackState, persistActiveCanvas } from './graphStack.svelte'

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

const applyCanvasState = (nodes: Node[], edges: Edge[]) => {
  setNodes(cloneNodes(nodes))
  setEdges(cloneEdges(edges))
  updateLastNodeId()
}

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
    persistActiveCanvas()

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
      nodes: cloneNodes(nextNodes),
      edges: cloneEdges(nextEdges),
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
  persistActiveCanvas()

  const currentContext = graphStackState.getTopContext()
  const parentContext = graphStackState.getParentContext()
  if (!currentContext || !parentContext) {
    return
  }

  try {
    // Empty subnetwork: remove the node from the parent and clean up the store.
    if (currentContext.nodes.length === 0) {
      if (
        currentContext.originalName &&
        isNodeInNetworkNodes(currentContext.originalName)
      ) {
        await removeNetworkNode(currentContext.originalName)
      }

      // Strip the subnetwork node and all its connected edges from the parent.
      const parentNodes = cloneNodes(parentContext.nodes).filter(
        (node) => node.id !== currentContext.parentNodeId
      )
      const parentEdges = cloneEdges(parentContext.edges).filter(
        (edge) =>
          edge.source !== currentContext.parentNodeId &&
          edge.target !== currentContext.parentNodeId
      )

      graphStackState.collapseToParent({
        ...parentContext,
        nodes: parentNodes,
        edges: parentEdges,
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
      currentContext.nodes,
      currentContext.edges
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
    const parentNodes = cloneNodes(parentContext.nodes).map((node) => {
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

    // Pop the current context and restore the parent canvas.
    graphStackState.collapseToParent({ ...parentContext, nodes: parentNodes })
    applyCanvasState(parentNodes, parentContext.edges)
    toastState.add({
      message: `Saved changes to subnetwork "${updatedNetworkNode.name}"`,
      timeout: 2500,
    })
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
  persistActiveCanvas()

  // Re-read after persist — nodes/edges may have been updated.
  const refreshedCurrentContext = graphStackState.getTopContext()
  const parentContext = graphStackState.getParentContext()
  if (!refreshedCurrentContext || !parentContext) {
    return
  }

  const updatedNetworkNode = createNetworkNodeDefinition(
    trimmedName,
    refreshedCurrentContext.nodes,
    refreshedCurrentContext.edges
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
  const parentNodes = cloneNodes(parentContext.nodes).map((node) => {
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
  graphStackState.updateParentContext({ nodes: parentNodes })
  graphStackState.updateTopContext({
    label: updatedNetworkNode.name,
    originalName: updatedNetworkNode.name,
  })
}
