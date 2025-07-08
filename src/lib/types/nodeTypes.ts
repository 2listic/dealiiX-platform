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
  TRIANGULATION2_REFINEGLOBAL = 'Triangulation<2>::refine_global',
  GRIDOUT_WRITEVTK2 = 'GridOut::write_vtk<2>'
}

export enum NodeType {
  ELEMENTARY_CONSTRUCTOR = 'elementary_constructor',
  EMPTY_CONSTRUCTOR = 'empty_constructor',
  VOID_METHOD = 'void_method',
  VOID_CONST_METHOD = 'void_const_method',
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
  BOOLEAN = 'bool',
  TRIANGULATION22 = 'dealii::Triangulation<2, 2>',
  GRID_OUT = 'dealii::GridOut',
  VOID = 'void',
  STD_OUTSTREAM = 'std::ostream',
  VOID_TRIANGULATION22_UNSIGNED = `${Type.VOID}(${Type.TRIANGULATION22})::*)(${Type.UNSIGNED})`,
  VOID_GRIDOUT_TRIANGULATION22CONST_STDOUTSTREAMCONST = `${Type.VOID}(${Type.GRID_OUT}::*)(${Type.TRIANGULATION22} const&, ${Type.STD_OUTSTREAM}&) const`,
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