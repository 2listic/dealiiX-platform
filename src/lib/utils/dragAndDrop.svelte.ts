import type { XYPosition } from '@xyflow/svelte'
import { getNextNodeId, getNodes, setNodes } from '../stores/nodes.svelte'
import type { NodeData } from '../types/nodeTypes'

export const onDragOver = (event: DragEvent) => {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

export const onDrop = (
  event: DragEvent,
  // eslint-disable-next-line no-unused-vars
  screenToFlowPosition: (XYPosition: XYPosition) => XYPosition,
  draggedNodeData: NodeData | null
) => {
  event.preventDefault()
  if (!draggedNodeData) {
    return
  }
  const data = draggedNodeData

  const position = screenToFlowPosition({
    x: event.clientX,
    y: event.clientY,
  })
  const id = getNextNodeId().toString()
  console.log(id)
  const newNode = {
    id: id,
    type: data.node_type,
    data: data,
    position,
    origin: [0.5, 0.0] as [number, number],
  }

  setNodes([...getNodes(), newNode])
}
