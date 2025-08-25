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
  type_hash: string
}

export enum Inputs {
  ZERO = 0,
  ONE = 1,
  TWO = 2,
  THREE = 3,
}

// TODO: delete when MethodOrFunc component is deleted
export enum MethodName {
  // NULL = null,
  TRIANGULATION2_REFINEGLOBAL = 'Triangulation<2>::refine_global',
  GRIDOUT_WRITEVTK2 = 'GridOut::write_vtk<2>',
  GRIDGENERATOR_GENERATEFROMNAMEANDARGUMENTS2 = 'GridGenerator::generate_from_name_and_arguments<2>',
}

export enum NodeType {
  ELEMENTARY_CONSTRUCTOR = 'elementary_constructor',
  EMPTY_CONSTRUCTOR = 'empty_constructor',
  CONSTRUCTOR = 'constructor',
  ABSTRACT = 'abstract',
  VOID_METHOD = 'void_method',
  VOID_CONST_METHOD = 'void_const_method',
  VOID_FUNCTION = 'void_function',
}

export const nodeColors = {
  [NodeType.ELEMENTARY_CONSTRUCTOR]: 'yellowgreen',
  [NodeType.EMPTY_CONSTRUCTOR]: 'gray',
  [NodeType.CONSTRUCTOR]: 'gray',
  [NodeType.ABSTRACT]: 'gray',
  [NodeType.VOID_METHOD]: 'skyblue',
  [NodeType.VOID_CONST_METHOD]: 'skyblue',
  [NodeType.VOID_FUNCTION]: 'skyblue',
}

export enum Outputs {
  SELF = -1,
}

// TODO: delete TRIANGULATION22 and GRID_OUT when EmptyConstructor and ElementaryConstructor are deleted
export enum Type {
  UNSIGNED = 'unsigned',
  BOOLEAN = 'bool',
  STRING = 'std::string',
  TRIANGULATION22 = 'dealii::Triangulation<2, 2>',
  GRID_OUT = 'dealii::GridOut',
}

export type NodeData = {
  arguments: Argument[]
  derived?: string[]
  inputs: Inputs[]
  method_name?: MethodName
  node_type: NodeType
  outputs: Outputs[]
  type: string
  type_hash: string
  value?: string
  is_valid?: boolean
}

export type ImportedNodes = {
  [key: string]: NodeData
}
