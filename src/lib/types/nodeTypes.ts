export enum InOutTypes {
  STR = 'string',
  BOOL = 'boolean',
  INT = 'integer'
}

export type TextNodeData = { value: string, inputsTypes: InOutTypes[], outputsTypes: InOutTypes[] }
export type BoolNodeData = { value: boolean, inputsTypes: InOutTypes[], outputsTypes: InOutTypes[] }
export type ConcatNodeData = { value: string, inputsTypes: InOutTypes[], outputsTypes: InOutTypes[] }