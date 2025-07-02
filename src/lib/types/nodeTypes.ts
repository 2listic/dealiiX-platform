export enum InOutTypes {
  STR = 'string',
  BOOL = 'boolean',
  INT = 'integer'
}

export type TextNodeData = { value: string, inputs: InOutTypes[], outputs: InOutTypes[] }
export type BoolNodeData = { value: boolean, inputs: InOutTypes[], outputs: InOutTypes[] }
export type ConcatNodeData = { value: string, inputs: InOutTypes[], outputs: InOutTypes[] }