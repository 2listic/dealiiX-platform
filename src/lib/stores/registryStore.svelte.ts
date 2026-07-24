import {
  type RegisteredNodes,
  type StandardNodeDefinition,
  type SubGraphNodeDefinition,
  type RegisteredSubGraphNodes,
  NodeType,
} from '../types/nodeTypes'
import defaultNodesJson from '../data/defaultNodes.json'
import defaultNetworkNodesJson from '../data/defaultNetworkNodes.json'
import { filterValidNodes } from '../utils/registryValidator'
import type { ExecutionLocation } from '../types/settingsTypes'

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

type LocationRegistries = Record<ExecutionLocation, RegisteredNodes>

/**
 * Per-location application registries (one coral node set per execution
 * location). Reads resolve against the {@link activeLocation}; the palette and
 * graph only ever see the active location's registry.
 */
let registries = $state<LocationRegistries>({
  local: {},
  remote: {},
})

/**
 * Location whose registry the read APIs resolve against. Set by the
 * execution-mode switch orchestration and the startup bootstrap. Plain internal
 * state (no `settingsState` import) so this module stays free of electron side
 * effects in test/util contexts.
 */
let activeLocation: ExecutionLocation = $state('remote')

const persistStoreValue = async (key: string, value: unknown) => {
  // globalThis.window (not bare window) so this never throws a ReferenceError in
  // node/test contexts where `window` is undefined.
  if (globalThis.window?.electron?.store) {
    await window.electron.store.set(key, value)
  } else {
    console.warn(`Electron store not available while persisting '${key}'`)
  }
}

// Type guard distinguishing the per-location shape from a legacy flat registry.
const isPerLocationRegistry = (
  value: unknown
): value is Record<ExecutionLocation, RegisteredNodes> => {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.local === 'object' &&
    v.local !== null &&
    typeof v.remote === 'object' &&
    v.remote !== null
  )
}

// Load per-location registries from electron-store, migrating an old flat value.
const loadRegistries = async () => {
  if (!globalThis.window?.electron?.store) {
    const fallback = sortRegistry(defaultNodes)
    registries = { local: fallback, remote: fallback }
    console.warn('Electron store not available (e.g., dev:vite mode)')
    return
  }
  const stored = await window.electron.store.get('registered_nodes', undefined)
  if (stored === undefined) {
    const fallback = sortRegistry(defaultNodes)
    registries = { local: fallback, remote: fallback }
  } else if (isPerLocationRegistry(stored)) {
    registries = {
      local: sortRegistry(
        Object.keys(stored.local).length ? stored.local : defaultNodes
      ),
      remote: sortRegistry(
        Object.keys(stored.remote).length ? stored.remote : defaultNodes
      ),
    }
  } else {
    // Legacy flat registry — seed both locations from it and re-persist.
    const flat = sortRegistry(stored as RegisteredNodes)
    registries = { local: flat, remote: flat }
    await persistStoreValue('registered_nodes', $state.snapshot(registries))
  }
}
loadRegistries()

/**
 * Set which location's registry the read APIs resolve against.
 * @param location - The execution location to make active.
 */
export const setActiveLocation = (location: ExecutionLocation): void => {
  activeLocation = location
}

/**
 * Replace the given location's registry with the given nodes (does not change
 * the active location). Filters out entries that are not valid
 * StandardNodeDefinition objects.
 * @param data - Dictionary of node data to register.
 * @param location - The execution location whose registry to replace.
 * @returns List of keys that were skipped due to invalid structure.
 */
export const setRegistry = async (
  data: Record<string, unknown>,
  location: ExecutionLocation
): Promise<string[]> => {
  const [filtered, skipped] = filterValidNodes(data)
  registries[location] = sortRegistry(filtered)
  await persistStoreValue('registered_nodes', $state.snapshot(registries))
  return skipped
}

/**
 * Merge the given nodes into the given location's registry (imported keys win),
 * preserving nodes already registered for that location. Does not change the
 * active location.
 * @param data - Dictionary of node data to merge in.
 * @param location - The execution location whose registry to merge into.
 * @returns List of keys that were skipped due to invalid structure.
 */
export const mergeRegistry = async (
  data: Record<string, unknown>,
  location: ExecutionLocation
): Promise<string[]> => {
  const [filtered, skipped] = filterValidNodes(data)
  registries[location] = sortRegistry({
    ...registries[location],
    ...filtered,
  })
  await persistStoreValue('registered_nodes', $state.snapshot(registries))
  return skipped
}

/**
 * Get all the available nodes from the active location's registry.
 * @remarks Returns reactive state - changes will trigger UI updates
 * @returns {StandardNodeDefinition[]}
 */
export const getAvailableNodes = (): StandardNodeDefinition[] => {
  const nodes = Object.values(registries[activeLocation])
  return nodes
}

/**
 * Get node definition from the active location's registry by type (snapshot for validation)
 * @param {string} type - The node type identifier (e.g., 'Triangulation', 'DoFHandler')
 * @returns {StandardNodeDefinition} A snapshot (non-reactive copy) of the node definition for the given type
 * @throws {Error} If the node type is not found in the registry
 */
export const getNodeData = (type: string): StandardNodeDefinition => {
  if (!isNodeInRegistry(type)) {
    console.error(`Node type '${type}' was not found in the available nodes.`)
    throw new Error(`Node type '${type}' was not found in the available nodes.`)
  }
  return $state.snapshot(registries[activeLocation][type])
}

/**
 * Returns if node is present in the active location's registry of available nodes
 * @param {string} type - The node type identifier (e.g., 'Triangulation', 'DoFHandler')
 * @returns {boolean} True if present, false if not
 */
export const isNodeInRegistry = (type: string): boolean => {
  return type in registries[activeLocation]
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
 * Get all the stored network nodes
 * @remarks Returns reactive state - changes will trigger UI updates
 * @returns {SubGraphNodeDefinition[]}
 */
export const getStoredNetworkNodes = (): SubGraphNodeDefinition[] => {
  const nodes = Object.values(networkNodes)
  return nodes
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
