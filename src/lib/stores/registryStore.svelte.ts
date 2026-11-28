import {
  type BackendIdentity,
  type RegisteredNodes,
  type StandardNodeDefinition,
  type SubGraphNodeDefinition,
  type RegisteredSubGraphNodes,
  NodeType,
  TypeField,
} from '../types/nodeTypes'
import defaultNodesJson from '../data/defaultNodes.json'
import defaultNetworkNodesJson from '../data/defaultNetworkNodes.json'
import { canonicalTypeKey } from '../registry/canonicalTypeKey'
import {
  filterValidNodes,
  registryBackend,
} from '../registry/registryValidator'
import { graphStackState } from './graphStack.svelte'

// ================= Registered nodes (sidebar) ========================

const defaultNodes = defaultNodesJson as RegisteredNodes

/**
 * Sort a registry so that ELEMENTARY_CONSTRUCTOR nodes appear first,
 * preserving relative order within each group.
 * @param {RegisteredNodes} nodes - The registry to sort
 * @returns {RegisteredNodes} A new registry with ELEMENTARY_CONSTRUCTOR nodes first
 */
const sortRegistry = (nodes: RegisteredNodes): RegisteredNodes => {
  const elementary: [string, StandardNodeDefinition][] = []
  const rest: [string, StandardNodeDefinition][] = []
  for (const entry of Object.entries(nodes)) {
    if (entry[1].node_type === NodeType.ELEMENTARY_CONSTRUCTOR) {
      elementary.push(entry)
    } else {
      rest.push(entry)
    }
  }
  return Object.fromEntries([...elementary, ...rest])
}

type Registry = { nodes: RegisteredNodes; backend?: BackendIdentity }

// The bundled nodes remain available for graph editing before a backend is configured.
const bundledRegistry: Registry = { nodes: sortRegistry(defaultNodes) }
let rootRegistry = $state<Registry>()

const persistStoreValue = async (key: string, value: unknown) => {
  // globalThis.window (not bare window) so this never throws a ReferenceError in
  // node/test contexts where `window` is undefined.
  if (globalThis.window?.electron?.store) {
    await window.electron.store.set(key, value)
  } else {
    console.warn(`Electron store not available while persisting '${key}'`)
  }
}

/**
 * Set the root registry supplied by the workflow service.
 * @param data - The registry returned by describe.
 * @returns The registry keys that could not be read by the editor.
 */
export const setServiceRegistry = (data: Record<string, unknown>): string[] => {
  const [nodes, skipped] = filterValidNodes(data)
  rootRegistry = { nodes: sortRegistry(nodes), backend: registryBackend(data) }
  return skipped
}

const activeRegistry = () =>
  graphStackState.getTopContext()?.registry ?? rootRegistry ?? bundledRegistry

/**
 * Get the backend header of the current graph's registry.
 * @returns A plain copy of the header, or undefined when the registry has none.
 */
export const getRegistryBackend = (): BackendIdentity | undefined => {
  const backend = activeRegistry().backend
  return backend && $state.snapshot(backend)
}

/**
 * Get all the available nodes from the current graph's registry.
 * @remarks Returns reactive state - changes will trigger UI updates
 * @returns {StandardNodeDefinition[]}
 */
export const getAvailableNodes = (): StandardNodeDefinition[] => {
  return Object.values(activeRegistry().nodes).filter(
    (node) => node.type !== TypeField.ORCHESTRATOR_GENERIC_FILE
  )
}

/**
 * Get node definition from the current graph's registry by type (snapshot for validation)
 * @param {string} type - The node type identifier (e.g., 'Triangulation', 'DoFHandler')
 * @returns {StandardNodeDefinition} A snapshot (non-reactive copy) of the node definition for the given type
 * @throws {Error} If the node type is not found in the registry
 */
export const getNodeData = (type: string): StandardNodeDefinition => {
  const key = registryKey(type)
  if (key === undefined) {
    console.error(`Node type '${type}' was not found in the available nodes.`)
    throw new Error(`Node type '${type}' was not found in the available nodes.`)
  }
  return $state.snapshot(activeRegistry().nodes[key])
}

/**
 * Returns if node is present in the current graph's registry of available nodes
 * @param {string} type - The node type identifier (e.g., 'Triangulation', 'DoFHandler')
 * @returns {boolean} True if present, false if not
 */
export const isNodeInRegistry = (type: string): boolean => {
  return registryKey(type) !== undefined
}

// ============ Registered network nodes section (sidebar) ======================

const defaultNetworkNodes = defaultNetworkNodesJson as RegisteredSubGraphNodes

/**
 * Store containing all the registered subgraph node definitions
 */
let networkNodes = $state<RegisteredSubGraphNodes>({})

// Load network nodes from electron-store
const loadNetworkNodes = async () => {
  if (globalThis.window?.electron?.store) {
    networkNodes = await window.electron.store.get(
      'registered_network_nodes',
      defaultNetworkNodes
    )
  } else {
    networkNodes = defaultNetworkNodes
    console.warn('Electron store not available (e.g., dev:vite mode)')
  }
}
loadNetworkNodes()

/**
 * Set the application store for the available network nodes and persist changes
 * @param {RegisteredSubGraphNodes} data - Dictionary of node data to register
 */
export const setNetworkNodes = async (data: RegisteredSubGraphNodes) => {
  networkNodes = data
  console.log('Imported network nodes', $state.snapshot(networkNodes))
  await persistStoreValue(
    'registered_network_nodes',
    $state.snapshot(networkNodes)
  )
}

/**
 * Add or update a single network node in the relative store and persist changes
 * @param {string} key - The unique identifier for the network node
 * @param {SubGraphNodeDefinition} nodeData - The node definition to add or update
 */
export const addNetworkNode = async (
  key: string,
  nodeData: SubGraphNodeDefinition
) => {
  networkNodes = { ...networkNodes, [key]: nodeData }
  console.log(`Network node '${key}' added/updated`, $state.snapshot(nodeData))
  await persistStoreValue(
    'registered_network_nodes',
    $state.snapshot(networkNodes)
  )
}

/**
 * Remove a network node from the networkNodes store and persist changes
 * @param {string} name - The network node name identifier to remove
 * @throws {Error} If the network node name is not found in the networkNodes store
 */
export const removeNetworkNode = async (name: string) => {
  if (isNodeInNetworkNodes(name)) {
    delete networkNodes[name]
    await persistStoreValue(
      'registered_network_nodes',
      $state.snapshot(networkNodes)
    )
  } else {
    throw new Error(`Network node '${name}' not found in networkNodes store`)
  }
}

/**
 * Get saved network nodes whose backend ID matches the open graph's registry.
 * @remarks Returns reactive state - changes will trigger UI updates
 * @returns {SubGraphNodeDefinition[]}
 */
export const getStoredNetworkNodes = (): SubGraphNodeDefinition[] => {
  const backendId = getRegistryBackend()?.id
  if (!backendId) return []
  return Object.values(networkNodes).filter(
    (node) => node.value?.backend?.id === backendId
  )
}

/**
 * Get subgraph node definition from the networkNodes store by name (snapshot for validation)
 * @param {string} name - The network node name identifier (unique key for the network node)
 * @returns {SubGraphNodeDefinition} A snapshot (non-reactive copy) of the node definition for the given network node
 * @throws {Error} If the network node name is not found in the networkNodes store
 */
export const getNetworkNodeDefinition = (
  name: string
): SubGraphNodeDefinition => {
  if (!isNodeInNetworkNodes(name)) {
    console.error(`Sub-graph node '${name}' not found in networkNodes store`)
    throw new Error(`Sub-graph node '${name}' not found in networkNodes store`)
  }
  return $state.snapshot(networkNodes[name])
}

/**
 * Returns if network node exists in the networkNodes store
 * @param {string} name - The network node name identifier (unique key for the network node)
 * @returns {boolean} True if exists, false if not
 */
export const isNodeInNetworkNodes = (name: string): boolean => {
  return name in networkNodes
}

// ── Private helpers ──

// Canonical type key → the first active-registry key with that form, as Coral picks it.
const canonicalRegistryKeys = $derived.by(() => {
  const keys: Record<string, string> = Object.create(null)
  for (const key of Object.keys(activeRegistry().nodes)) {
    const canonical = canonicalTypeKey(key)
    if (!Object.hasOwn(keys, canonical)) keys[canonical] = key
  }
  return keys
})

// The stored key for a type: an exact match, else the key with the same canonical spelling.
const registryKey = (type: string): string | undefined =>
  Object.hasOwn(activeRegistry().nodes, type)
    ? type
    : canonicalRegistryKeys[canonicalTypeKey(type)]
