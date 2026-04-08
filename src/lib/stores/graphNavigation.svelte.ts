import type { Edge, Node } from '@xyflow/svelte'
import { currentProjectState } from './currentProjectStore.svelte.js'
import {
  addNetworkNode,
  getEdgesSnapshot,
  getNetworkNodeDefinition,
  getNodesSnapshot,
  isNodeInNetworkNodes,
  removeNetworkNode,
  setEdges,
  setNodes,
  updateLastNodeId,
} from './nodes.svelte'
import { createNetworkNodeDefinition } from '../utils/networkNode'
import {
  edgesFromProtocolToFlow,
  nodesFromProtocolToFlow,
} from '../utils/graphParser'
import {
  isSubGraphNodeDefinition,
  type SubGraphNodeDefinition,
} from '../types/nodeTypes'
import { toastState } from './toastsStore.svelte.js'

type GraphContext = {
  label: string
  originalName: string | null
  parentNodeId: string | null
  nodes: Node[]
  edges: Edge[]
}

let contextStack = $state<GraphContext[]>([])

const cloneNodes = (nodes: Node[]): Node[] =>
  $state.snapshot(nodes) as unknown as Node[]

const cloneEdges = (edges: Edge[]): Edge[] =>
  $state.snapshot(edges) as unknown as Edge[]

const rootLabel = (): string =>
  currentProjectState.id ? currentProjectState.name : 'Main Graph'

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

const ensureRootContext = () => {
  if (contextStack.length > 0) {
    return
  }

  contextStack = [
    {
      label: rootLabel(),
      originalName: null,
      parentNodeId: null,
      nodes: cloneNodes(getNodesSnapshot()),
      edges: cloneEdges(getEdgesSnapshot()),
    },
  ]
}

const persistActiveCanvas = () => {
  ensureRootContext()
  contextStack[contextStack.length - 1] = {
    ...contextStack[contextStack.length - 1],
    nodes: cloneNodes(getNodesSnapshot()),
    edges: cloneEdges(getEdgesSnapshot()),
  }
}

const isNetworkCanvasNode = (
  node: Node | undefined
): node is Node<SubGraphNodeDefinition> => {
  if (!node) {
    return false
  }

  return isSubGraphNodeDefinition(node.data as SubGraphNodeDefinition)
}

export const graphNavigationState = {
  get breadcrumbs(): string[] {
    ensureRootContext()
    return contextStack.map((context) => context.label)
  },

  get canGoBack(): boolean {
    return contextStack.length > 1
  },

  get currentLabel(): string {
    ensureRootContext()
    return contextStack.at(-1)?.label ?? rootLabel()
  },

  async renameCurrentSubnetwork(name: string) {
    ensureRootContext()
    if (contextStack.length <= 1) {
      return
    }

    const trimmedName = name.trim()
    if (!trimmedName) {
      throw new Error('Subnetwork name cannot be empty.')
    }

    const currentContext = contextStack.at(-1)
    if (!currentContext) {
      return
    }

    if (trimmedName === currentContext.label) {
      return
    }

    persistActiveCanvas()

    const refreshedCurrentContext = contextStack.at(-1)
    const parentContext = contextStack.at(-2)
    if (!refreshedCurrentContext || !parentContext) {
      return
    }

    const updatedNetworkNode = createNetworkNodeDefinition(
      trimmedName,
      refreshedCurrentContext.nodes,
      refreshedCurrentContext.edges
    )

    if (
      refreshedCurrentContext.originalName &&
      refreshedCurrentContext.originalName !== updatedNetworkNode.name &&
      isNodeInNetworkNodes(refreshedCurrentContext.originalName)
    ) {
      await removeNetworkNode(refreshedCurrentContext.originalName)
    }

    await addNetworkNode(updatedNetworkNode.name, updatedNetworkNode)

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

    contextStack[contextStack.length - 2] = {
      ...parentContext,
      nodes: parentNodes,
    }
    contextStack[contextStack.length - 1] = {
      ...refreshedCurrentContext,
      label: updatedNetworkNode.name,
      originalName: updatedNetworkNode.name,
    }
  },

  reset() {
    contextStack = []
  },

  async enterSubnetwork(nodeId: string) {
    try {
      const currentNodes = getNodesSnapshot()
      const targetNode = currentNodes.find((node) => node.id === nodeId)
      if (!isNetworkCanvasNode(targetNode)) {
        throw new Error(`Node '${nodeId}' is not a subnetwork`)
      }

      persistActiveCanvas()

      const networkNodeData = getNetworkNodeDefinition(targetNode.data.name)
      const nextNodes = nodesFromProtocolToFlow(
        networkNodeData.value.workflow.nodes
      )
      const nextEdges = edgesFromProtocolToFlow(
        networkNodeData.value.workflow.edges
      )

      contextStack = [
        ...contextStack,
        {
          label: targetNode.data.name,
          originalName: targetNode.data.name,
          parentNodeId: nodeId,
          nodes: cloneNodes(nextNodes),
          edges: cloneEdges(nextEdges),
        },
      ]

      applyCanvasState(nextNodes, nextEdges)
    } catch (error) {
      console.error('Failed to enter subnetwork:', error)
      toastState.add({
        message: errorMessage(error, 'Failed to open subnetwork'),
        type: 'error',
      })
    }
  },

  async goBack() {
    if (contextStack.length <= 1) {
      return
    }

    persistActiveCanvas()

    const currentContext = contextStack.at(-1)
    const parentContext = contextStack.at(-2)
    if (!currentContext || !parentContext) {
      return
    }

    try {
      if (currentContext.nodes.length === 0) {
        if (
          currentContext.originalName &&
          isNodeInNetworkNodes(currentContext.originalName)
        ) {
          await removeNetworkNode(currentContext.originalName)
        }

        const parentNodes = cloneNodes(parentContext.nodes).filter(
          (node) => node.id !== currentContext.parentNodeId
        )
        const parentEdges = cloneEdges(parentContext.edges).filter(
          (edge) =>
            edge.source !== currentContext.parentNodeId &&
            edge.target !== currentContext.parentNodeId
        )

        contextStack = [
          ...contextStack.slice(0, -2),
          {
            ...parentContext,
            nodes: parentNodes,
            edges: parentEdges,
          },
        ]

        applyCanvasState(parentNodes, parentEdges)
        toastState.add({
          message: `Removed empty subnetwork "${currentContext.label}"`,
          timeout: 2500,
        })
        return
      }

      const updatedNetworkNode = createNetworkNodeDefinition(
        currentContext.label,
        currentContext.nodes,
        currentContext.edges
      )

      if (
        currentContext.originalName &&
        currentContext.originalName !== updatedNetworkNode.name &&
        isNodeInNetworkNodes(currentContext.originalName)
      ) {
        await removeNetworkNode(currentContext.originalName)
      }

      await addNetworkNode(updatedNetworkNode.name, updatedNetworkNode)

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

      contextStack = [
        ...contextStack.slice(0, -2),
        {
          ...parentContext,
          nodes: parentNodes,
        },
      ]

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
  },
}
