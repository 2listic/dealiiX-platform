export type ParameterLeaf = {
  value: string
  default_value: string
  documentation: string
  pattern: string
  pattern_description: string
  actions?: string
  __extra?: boolean
}

export interface ParameterTree {
  __extra?: boolean
  [key: string]: ParameterLeaf | ParameterTree | boolean | undefined
}

export type ParameterNode = ParameterLeaf | ParameterTree
