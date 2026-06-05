export type ParameterLeaf = {
  value: string
  default_value: string
  documentation: string
  pattern: string
  pattern_description: string
  actions?: string
  __extra?: boolean
}

/** boolean | undefined — required by TypeScript to accommodate `__extra?: boolean` in the index signature. */
export type Extra = boolean | undefined

export type ParameterNode = ParameterLeaf | ParameterTree

export interface ParameterTree {
  __extra?: boolean
  [key: string]: ParameterNode | Extra
}
