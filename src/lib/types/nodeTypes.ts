export enum InOutTypes {
  STR = 'string',
  BOOL = 'boolean',
  INT = 'integer'
}

export type TextNodeData = { value: string, inputsTypes: InOutTypes[], outputsTypes: InOutTypes[] }
export type BoolNodeData = { value: boolean, inputsTypes: InOutTypes[], outputsTypes: InOutTypes[] }
export type ConcatNodeData = { value: string, inputsTypes: InOutTypes[], outputsTypes: InOutTypes[] }


export enum Arguments { 
}

export enum NodeType {
  ELEMENTARY_CONSTRUCTOR = 'elementary_constructor',
}

export enum Outputs {
  SELF = "self",
  ONE = 1,
  TWO = 2,
  THREE = 3,
}

export enum Type {
  UNSIGNED = 'unsigned',
}

export enum Inputs {
  ONE = 1,
  TWO = 2,
  THREE = 3,
}

export type NodeData = { 
  arguments: Arguments[], 
  inputs: Inputs[],
  nodeType: NodeType,
  outputs: Outputs[]
  type: Type,
  typeHash: string,
  value: string,
}