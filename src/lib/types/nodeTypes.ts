// export enum InOutTypes {
//   STR = 'string',
//   BOOL = 'boolean',
//   INT = 'integer'
// }

// export type TextNodeData = { value: string, inputsTypes: InOutTypes[], outputsTypes: InOutTypes[] }
// export type BoolNodeData = { value: boolean, inputsTypes: InOutTypes[], outputsTypes: InOutTypes[] }
// export type ConcatNodeData = { value: string, inputsTypes: InOutTypes[], outputsTypes: InOutTypes[] }

export enum ConnectionType {
  INPUT = 'input',
  OUTPUT = 'output',
  PASSTHROUGH = 'pass_through',
}

type Argument = {
  connection_type: ConnectionType
  name: string
  type: Type
}

export enum Inputs {
  ZERO = 0,
  ONE = 1,
  TWO = 2,
  THREE = 3,
}

export enum NodeType {
  ELEMENTARY_CONSTRUCTOR = 'elementary_constructor',
  EMPTY_CONSTRUCTOR = 'empty_constructor',
  CONSTRUCTOR = 'constructor',
  ABSTRACT = 'abstract',
  VOID_METHOD = 'void_method',
  VOID_CONST_METHOD = 'void_const_method',
  VOID_FUNCTION = 'void_function',
  FUNCTION = 'function',
}

export enum NodeTypePyBackend {
  PRIMITIVE = 'primitive',
  METHOD = 'method',
}

export const nodeColors = {
  [NodeType.ELEMENTARY_CONSTRUCTOR]: 'yellowgreen',
  [NodeType.EMPTY_CONSTRUCTOR]: 'gray',
  [NodeType.CONSTRUCTOR]: 'gray',
  [NodeType.ABSTRACT]: 'gray',
  [NodeType.VOID_METHOD]: 'skyblue',
  [NodeType.VOID_CONST_METHOD]: 'skyblue',
  [NodeType.VOID_FUNCTION]: 'skyblue',
  [NodeType.FUNCTION]: 'skyblue',
  [NodeTypePyBackend.PRIMITIVE]: 'yellowgreen',
  [NodeTypePyBackend.METHOD]: 'skyblue',
}

export enum Outputs {
  SELF = -1,
}

export enum Type {
  INT = 'int',
  UNSIGNED = 'unsigned',
  UNSIGNED_INT = 'unsigned int',
  DOUBLE = 'double',
  FLOAT = 'float',
  BOOLEAN = 'bool',
  STRING = 'std::string',
  STR = 'str',
  ANY = 'any',
}

export type NodeData = {
  arguments: Argument[]
  derived?: string[]
  inputs: Inputs[]
  method_name?: string
  node_type: NodeType
  outputs: Outputs[]
  type: string
  value?: string
  is_valid?: boolean
}

export type ImportedNodes = {
  [key: string]: NodeData
}

export const returnNodeName = (node: NodeData): string => {
  // Check if method_name is present for retrocompatibility
  let nodeName = 'method_name' in node ? node.method_name : node.type
  return nodeName.replaceAll('_', ' ')
}
