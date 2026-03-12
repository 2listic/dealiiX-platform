import type { XYPosition } from '@xyflow/svelte'
import { getNextNodeId, getNodes, setNodes } from '../stores/nodes.svelte'
import {
  TypeField,
  type NetworkNodeOfTypeNetwork,
  type NodeData,
} from '../types/nodeTypes'

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

  // Remove value field for network nodes (stored in networkNodes store)
  let data = draggedNodeData
  if (draggedNodeData.type === TypeField.CORAL_NETWORK) {
    // eslint-disable-next-line no-unused-vars
    const { value, ...dataWithoutValue } = draggedNodeData
    data = dataWithoutValue as NetworkNodeOfTypeNetwork
  }

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
