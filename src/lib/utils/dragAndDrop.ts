import type { XYPosition } from '@xyflow/svelte'
import { getNextNodeId, getNodes, setNodes } from '../stores/nodes.svelte'

export const onDragOver = (event: DragEvent) => {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'move'
  }
}

export const onDrop = (
  event: DragEvent,
  screenToFlowPosition: (XYPosition: XYPosition) => XYPosition,
  type: { current: string | null }
) => {
  event.preventDefault()
  if (!type.current) {
    return
  }

  const position = screenToFlowPosition({
    x: event.clientX,
    y: event.clientY,
  })
  const id = getNextNodeId().toString()
  console.log(id)
  const newNode = {
    id: id,
    type: type.current,
    data: {},
    position,
    origin: [0.5, 0.0],
  }

  setNodes([...getNodes(), newNode])
}
