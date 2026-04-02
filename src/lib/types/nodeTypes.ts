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

/**
 * Full definition of a standard (non-subgraph) node from the CORAL registry.
 * Contains complete metadata for rendering and wiring the node on the canvas.
 * Stored in {@link RegisteredNodes}, keyed by node type identifier.
 */
export type StandardNodeDefinition = {
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
  [key: string]: StandardNodeDefinition
}

/**
 * Dictionary of stored subgraph node definitions, keyed by node name.
 */
export type RegisteredSubGraphNodes = {
  [key: string]: SubGraphNodeDefinition
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

/**
 * Lean (protocol-level) representation of a standard node as it appears
 * in the serialized {@link Network} JSON. Contains only the fields needed
 * for serialization, not the full registry metadata.
 * For subgraph nodes in the protocol, use {@link SubGraphNodeDefinition}.
 */
export type LeanStandardNode = {
  type: string
  base?: string
  derived?: string[]
  value?: string
  name?: string
  position?: { x: number; y: number }
}

/**
 * Full definition of a subgraph node — an encapsulated computational graph
 * that can be reused as a single node on the canvas.
 * Always has `type === TypeField.CORAL_NETWORK` and carries the embedded
 * sub-network in its `value` field.
 * Stored in {@link RegisteredSubGraphNodes}, keyed by node name.
 */
export type SubGraphNodeDefinition = {
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

/**
 * Union of all node definition types that can be placed on the canvas —
 * either a registry node or a stored subgraph node.
 */
export type NodeDefinitions = StandardNodeDefinition | SubGraphNodeDefinition

/**
 * Record of all lean protocol nodes in a serialized network.
 * Values are either {@link LeanStandardNode} (regular nodes) or
 * {@link SubGraphNodeDefinition} (subgraph nodes).
 */
export type LeanNodes = {
  [id: string]: LeanStandardNode | SubGraphNodeDefinition
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
    nodes: LeanNodes
  }
}

/** Protocol node with a `qualified_id` encoding its position in the nesting hierarchy (e.g. `"12_3"`). */
export type QualifiedLeanStandardNode = LeanStandardNode & {
  qualified_id: string
}

/** Subgraph definition with a `qualified_id` and a recursively qualified embedded network. */
export type QualifiedSubGraphNodeDefinition = Omit<
  SubGraphNodeDefinition,
  'value'
> & {
  qualified_id: string
  value: QualifiedNetwork
}

/** Record of qualified protocol nodes, used for export and execution. */
export type QualifiedLeanNodes = {
  [id: string]: QualifiedLeanStandardNode | QualifiedSubGraphNodeDefinition
}

export type QualifiedNetwork = Omit<Network, 'workflow'> & {
  workflow: { edges: NetworkEdges; nodes: QualifiedLeanNodes }
}

/**
 * Type guard to check if a protocol node is a {@link SubGraphNodeDefinition}.
 * @param node - The node to check
 * @returns True if the node is a coral::Network node with all required fields
 */
export const isSubGraphNodeDefinition = (
  node: LeanNodes[string]
): node is SubGraphNodeDefinition => {
  return (
    node.type === TypeField.CORAL_NETWORK &&
    'node_type' in node &&
    node.node_type === NodeType.NETWORK
  )
}

/**
 * Returns the display name for a node template: prefers `name` over `type`,
 * replaces underscores with spaces, and capitalizes the first letter.
 * @param node - Registry node or stored subgraph node.
 */
export const returnNodeName = (node: NodeDefinitions): string => {
  const normalized = (node.name ?? node.type).replaceAll('_', ' ').trim()
  if (!normalized) return ''
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}
