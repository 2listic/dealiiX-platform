import type { XYPosition } from '@xyflow/svelte'
import { getNextNodeId, getNodes, setNodes } from '../states/store.svelte'

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
  const newNode = {
    id: getNextNodeId().toString(),
    type: type.current,
    data: {},
    position,
    origin: [0.5, 0.0],
  }

  setNodes([...getNodes(), newNode])
}