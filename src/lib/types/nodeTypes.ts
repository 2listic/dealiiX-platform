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

export type InputIndex = number
export const SELF = -1 as const
export type OutputIndex = typeof SELF | number

export enum NodeType {
  ELEMENTARY_CONSTRUCTOR = 'elementary_constructor',
  EMPTY_CONSTRUCTOR = 'empty_constructor',
  CONSTRUCTOR = 'constructor',
  ABSTRACT = 'abstract',
  VOID_METHOD = 'void_method',
  VOID_CONST_METHOD = 'void_const_method',
  VOID_FUNCTION = 'void_function',
  FUNCTION = 'function',
  NETWORK = 'network',
}

export enum TypeField {
  CORAL_NETWORK = 'coral::Network',
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
  [NodeType.NETWORK]: 'darkorchid',
  [NodeTypePyBackend.PRIMITIVE]: 'yellowgreen',
  [NodeTypePyBackend.METHOD]: 'skyblue',
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
  type: string
  arguments: Argument[]
  inputs: InputIndex[]
  outputs: OutputIndex[]
  node_type: NodeType
  name?: string
  derived?: string[]
  base?: string
  method_name?: string
  value?: string | Network
  is_valid?: boolean
}

/**
 * Registry protocol JSON structure. Used for loading available nodes and holding
 * their definitions
 */
export type RegisteredNodes = {
  [key: string]: NodeData
}

export type NetworkEdge = {
  source: number
  source_output: number
  target: number
  target_input: number
}

export type NetworkEdges = {
  [id: string]: NetworkEdge
}

export type NetworkNode = {
  type: string
  base?: string
  derived?: string[]
  value?: string
  name?: string
  position?: { x: number; y: number }
}

export type NetworkNodeOfTypeNetwork = {
  type: TypeField.CORAL_NETWORK
  node_type: NodeType.NETWORK
  value: Network
  name: string
  arguments: Argument[]
  inputs: InputIndex[]
  outputs: OutputIndex[]
  position?: { x: number; y: number }
}

export type NetworkNodes = {
  [id: string]: NetworkNode | NetworkNodeOfTypeNetwork
}

/**
 * Network protocol JSON structure with graph structure and current values
 * for stafull nodes. It is used for evaluating/saving/loading CORAL
 * computational graphs together with the registry JSON protocol.
 */
export type Network = {
  author: string
  date_time_utc: string
  version: number
  workflow: {
    edges: NetworkEdges
    nodes: NetworkNodes
  }
}

/**
 * Type guard to check if a network node is of type NetworkNodeOfTypeNetwork
 * @param node - The node to check
 * @returns True if the node is a coral::Network node with all required fields
 */
export const isNetworkNodeOfTypeNetwork = (
  node: NetworkNodes[string]
): node is NetworkNodeOfTypeNetwork => {
  return (
    node.type === TypeField.CORAL_NETWORK &&
    'node_type' in node &&
    node.node_type === NodeType.NETWORK &&
    'value' in node &&
    'name' in node &&
    'arguments' in node &&
    'inputs' in node &&
    'outputs' in node
  )
}

/**
 * Returns the name property -or method_name or type if not present- formatted with
 * spaces instead of underscores.
 * TODO: simplify and remove backward compatibility for method_name
 * @param node
 * @returns
 */
export const returnNodeName = (node: NodeData): string => {
  let nodeName =
    'name' in node
      ? node.name
      : 'method_name' in node
        ? node.method_name
        : node.type
  return nodeName.replaceAll('_', ' ')
}
