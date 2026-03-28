import type { XYPosition } from '@xyflow/svelte'
import { getNextNodeId, getNodes, setNodes } from '../stores/nodes.svelte'
import type { NetworkNodeOfTypeNetwork, NodeData } from '../types/nodeTypes'
import { createCanvasNode } from './flowNodeCreation'

export const onDragOver = (event: DragEvent) => {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

export const onDrop = (
  event: DragEvent,
  // underscore-prefixed arg name to avoid eslint no-unused-vars error in interfaces
  screenToFlowPosition: (_XYPosition: XYPosition) => XYPosition,
  draggedNodeData: NodeData | NetworkNodeOfTypeNetwork | null
) => {
  event.preventDefault()
  if (!draggedNodeData) {
    return
  }

  const position = screenToFlowPosition({
    x: event.clientX,
    y: event.clientY,
  })
  const newNode = createCanvasNode(draggedNodeData, position, {
    id: getNextNodeId().toString(),
  })

  setNodes([...getNodes(), newNode])
}
