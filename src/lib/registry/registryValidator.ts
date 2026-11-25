/**
 * Validation utilities for the CORAL node registry.
 * Filters raw registry payloads received from CORAL or loaded from disk,
 * separating well-formed node definitions from non-compliant entries.
 */

import type {
  BackendIdentity,
  StandardNodeDefinition,
  RegisteredNodes,
} from '../types/nodeTypes'

const BACKEND_HEADER = '__backend'
const logicalId = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/

/**
 * Filters a registry object, separating valid nodes from non-compliant ones.
 * A valid node must be a non-null object with `node_type`, `arguments`, `inputs`, and `outputs`.
 * The backend identity header is handled separately.
 * @param registry - Raw dictionary that may contain both valid node entries and non-compliant nodes
 * @returns Tuple of [filtered valid registry, list of skipped keys]
 */
export const filterValidNodes = (
  registry: Record<string, unknown>
): [RegisteredNodes, string[]] => {
  const skipped: string[] = []
  const filtered: RegisteredNodes = {}
  for (const [key, value] of Object.entries(registry)) {
    if (key === BACKEND_HEADER) continue
    if (
      typeof value !== 'object' ||
      value === null ||
      !('node_type' in value) ||
      !('arguments' in value) ||
      !('inputs' in value) ||
      !('outputs' in value)
    ) {
      skipped.push(key)
      continue
    }
    filtered[key] = value as StandardNodeDefinition
  }
  return [filtered, skipped]
}

/**
 * Reads the backend header a registry carries under `__backend`.
 * @param registry - Raw registry payload.
 * @returns The header, or undefined when the registry has none or the identity is invalid.
 */
export const registryBackend = (
  registry: Record<string, unknown>
): BackendIdentity | undefined => {
  const header = registry[BACKEND_HEADER]
  if (typeof header !== 'object' || header === null) return
  const { id, plugin } = header as { id?: unknown; plugin?: unknown }
  if (Object.keys(header).some((key) => key !== 'id' && key !== 'plugin'))
    return
  if (typeof id !== 'string' || !logicalId.test(id)) return
  if (plugin === undefined) return { id }
  if (typeof plugin === 'string' && logicalId.test(plugin))
    return { id, plugin }
}
