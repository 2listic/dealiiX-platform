import type { XYPosition } from '@xyflow/svelte'
import { addNode } from '../stores/nodes.svelte'
import type { NodeDefinitions } from '../types/nodeTypes'
import { createCanvasNode } from './canvasNodeUtils'

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
  draggedNodeData: NodeDefinitions | null
) => {
  event.preventDefault()
  if (!draggedNodeData) {
    return
  }

  const position = screenToFlowPosition({
    x: event.clientX,
    y: event.clientY,
  })
  const newNode = createCanvasNode(draggedNodeData, position)

  addNode(newNode)
}
