type ParameterLeaf = {
  value: string
  default_value: string
  documentation: string
  pattern: string
  pattern_description: string
  actions?: string
}

type ParameterTree = {
  [key: string]: ParameterLeaf | ParameterTree
}

let parameters: ParameterTree | null = $state(null)

export const parametersState = {
  get value() {
    return parameters
  },
  set value(v: ParameterTree | null) {
    parameters = v
  },
  get snapshot() {
    return parameters ? $state.snapshot(parameters) : null
  },
}
