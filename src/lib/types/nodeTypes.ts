export enum InOutTypes {
  STR = 'string',
  BOOL = 'boolean',
  INT = 'integer'
}

export type TextNodeData = { value: string, inputsTypes: InOutTypes[], outputsTypes: InOutTypes[] }
export type BoolNodeData = { value: boolean, inputsTypes: InOutTypes[], outputsTypes: InOutTypes[] }
export type ConcatNodeData = { value: string, inputsTypes: InOutTypes[], outputsTypes: InOutTypes[] }


export enum ConnectionType {
  INPUT = 'input',
  OUTPUT = 'output',
  PASSTHROUGH = 'passthrough',
}

type Argument = { 
  connection_type: ConnectionType,
  name: string,
  type: Type,
  type_hash: string,
}

export enum Inputs {
  ZERO = 0,
  ONE = 1,
  TWO = 2,
  THREE = 3,
}

export enum MethodName {
  // NULL = null,
  TRIANGULATION2_REFINEGLOBAL = 'Triangulation<2>::refine_global'
}

export enum NodeType {
  ELEMENTARY_CONSTRUCTOR = 'elementary_constructor',
  EMPTY_CONSTRUCTOR = 'empty_constructor',
  VOID_METHOD = 'void_method',
}

export enum Outputs {
  SELF = "self",
  ZERO = 0,
  ONE = 1,
  TWO = 2,
  THREE = 3,
}

export enum Type {
  UNSIGNED = 'unsigned',
  TRIANGULATION22 = 'dealii::Triangulation<2, 2>',
  VOID = 'void',
  VOID_TRIANGULATION22_UNSIGNED = `${Type.VOID}(${Type.TRIANGULATION22})::*)(${Type.UNSIGNED})`
}

export type NodeData = { 
  arguments: Argument[], 
  inputs: Inputs[],
  method_name: MethodName,
  node_type: NodeType,
  outputs: Outputs[]
  type: Type,
  type_hash: string,
  value: string,
  is_valid: boolean,
}