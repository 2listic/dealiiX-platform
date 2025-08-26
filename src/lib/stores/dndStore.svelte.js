let nodeData = $state(null)

export const dndNodeDataState = {
  get current() {
    return nodeData
  },
  set current(value) {
    nodeData = value
  },
}
