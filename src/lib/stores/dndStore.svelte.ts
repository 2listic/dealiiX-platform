import type { NodeDefinitions } from '../types/nodeTypes'

type DragNodeData = NodeDefinitions | null

let nodeData = $state<DragNodeData>(null)

export const dndNodeDataState = {
  get current(): DragNodeData {
    return nodeData
  },
  set current(value: DragNodeData) {
    nodeData = value
  },
}
