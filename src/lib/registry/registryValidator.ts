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
const BACKEND_NAME = '__backend_name'
const logicalId = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/

/**
 * Filters a registry object, separating valid nodes from non-compliant ones.
 * A valid node must be a non-null object with `node_type`, `arguments`, `inputs`, and `outputs`.
 * The metadata keys `__backend` and `__backend_name` are never nodes; they are
 * reported as skipped only when unusable.
 * @param registry - Raw dictionary that may contain both valid node entries and non-compliant nodes
 * @returns Tuple of [filtered valid registry, list of skipped keys]
 */
export const filterValidNodes = (
  registry: Record<string, unknown>
): [RegisteredNodes, string[]] => {
  const skipped: string[] = []
  const filtered: RegisteredNodes = {}
  for (const [key, value] of Object.entries(registry)) {
    if (key === BACKEND_HEADER || key === BACKEND_NAME) {
      const usable =
        key === BACKEND_HEADER
          ? registryBackend(registry) !== undefined
          : typeof value === 'string'
      if (!usable) skipped.push(key)
      continue
    }
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
 * Reads the backend identity a registry carries under `__backend`. Keys other
 * than `id` and `plugin` are ignored, so a header with later fields still
 * yields its identity.
 * @param registry - Raw registry payload.
 * @returns `{ id, plugin? }`, or undefined when the registry has no header or
 *   its `id` or `plugin` is not a logical identifier.
 */
export const registryBackend = (
  registry: Record<string, unknown>
): BackendIdentity | undefined => {
  const header = registry[BACKEND_HEADER]
  if (typeof header !== 'object' || header === null) return
  const { id, plugin } = header as { id?: unknown; plugin?: unknown }
  if (typeof id !== 'string' || !logicalId.test(id)) return
  if (plugin === undefined) return { id }
  if (typeof plugin === 'string' && logicalId.test(plugin))
    return { id, plugin }
}
