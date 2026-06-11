import type {
  StandardNodeDefinition,
  SubGraphNodeDefinition,
} from '../types/nodeTypes'

type DragNodeData = StandardNodeDefinition | SubGraphNodeDefinition | null

let nodeData = $state<DragNodeData>(null)

export const dndNodeDataState = {
  get current(): DragNodeData {
    return nodeData
  },
  set current(value: DragNodeData) {
    nodeData = value
  },
}
