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

export type Argument = {
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

/**
 * Node types that should not appear in the sidebar's available nodes list.
 * Abstract nodes only provide type information for their derived nodes.
 * Network nodes have their concrete implementations in a different section.
 */
export const HIDDEN_SIDEBAR_NODE_TYPES: NodeType[] = [
  NodeType.ABSTRACT,
  NodeType.NETWORK,
]

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

/**
 * Array of all numeric types that require validation
 */
export const NUMERIC_TYPES: Type[] = [
  Type.UNSIGNED,
  Type.UNSIGNED_INT,
  Type.INT,
  Type.DOUBLE,
  Type.FLOAT,
]

/**
 * Check if a type is a numeric type that requires validation
 * @param type - The type to check
 * @returns True if the type is numeric (int, unsigned, double, float)
 */
export const isNumericType = (type: string): boolean => {
  return NUMERIC_TYPES.includes(type as Type)
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
  value?: any
  is_valid?: boolean
}

export type RegisteredNodes = {
  [key: string]: NodeData
}

export type RegisteredNetworkNodes = {
  [key: string]: NetworkNodeOfTypeNetwork
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
  is_valid?: boolean
}

/** A node that can be placed on the canvas — either a registry node or a stored network node. */
// TODO: use this around the codebase
// TODO: rename NodeData and/or NetworkNodeOfTypeNetwork to something more descriptive
export type CanvasNode = NodeData | NetworkNodeOfTypeNetwork

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
 * Types for networks with qualified ids that includes the ancestor ids if any
 */
export type QualifiedNetworkNode = NetworkNode & { qualified_id: string }
export type QualifiedNetworkNodeOfTypeNetwork = Omit<
  NetworkNodeOfTypeNetwork,
  'value'
> & {
  qualified_id: string
  value: QualifiedNetwork
}
export type QualifiedNetworkNodes = {
  [id: string]: QualifiedNetworkNode | QualifiedNetworkNodeOfTypeNetwork
}
export type QualifiedNetwork = Omit<Network, 'workflow'> & {
  workflow: { edges: NetworkEdges; nodes: QualifiedNetworkNodes }
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
    node.node_type === NodeType.NETWORK
  )
}

/**
 * Returns the display name for a node template: prefers `name` over `type`,
 * replaces underscores with spaces, and capitalizes the first letter.
 * @param node - Registry node or stored network node.
 */
export const returnNodeName = (node: CanvasNode): string => {
  const normalized = (node.name ?? node.type).replaceAll('_', ' ').trim()
  if (!normalized) return ''
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}
