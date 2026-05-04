import type {
  ParameterLeaf,
  ParameterTree,
  ParameterNode,
} from '../types/parameterTypes'

let parameters: ParameterTree | null = $state(null)

const stripUiMetadata = (node: ParameterNode): ParameterNode => {
  if (typeof node !== 'object' || node === null) {
    return node
  }

  const entries = Object.entries(node)
    .filter(([key]) => key !== '__extra')
    .map(([key, value]) => {
      if (typeof value === 'object' && value !== null) {
        return [key, stripUiMetadata(value as ParameterLeaf | ParameterTree)]
      }
      return [key, value]
    })

  return Object.fromEntries(entries) as ParameterLeaf | ParameterTree
}

export const parametersState = {
  get value() {
    return parameters
  },
  set value(v: ParameterTree | null) {
    parameters = v
  },
  get snapshot() {
    return parameters
      ? (stripUiMetadata($state.snapshot(parameters)) as ParameterTree)
      : null
  },
}
