import { canonicalTypeKey } from './canonicalTypeKey'
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

/** Registry keys with this prefix carry metadata, not node definitions. */
export const REGISTRY_METADATA_PREFIX = '__'

const logicalId = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/

/**
 * Filters a registry object, separating valid nodes from non-compliant ones.
 * A valid node must be a non-null object with `node_type`, `arguments`, `inputs`, and `outputs`.
 * Metadata keys (prefix `__`) are neither kept nor reported as skipped.
 * @param registry - Raw dictionary that may contain both valid node entries and non-compliant nodes
 * @returns Tuple of [filtered valid registry, list of skipped keys]
 */
export const filterValidNodes = (
  registry: Record<string, unknown>
): [RegisteredNodes, string[]] => {
  const skipped: string[] = []
  const filtered: RegisteredNodes = {}
  for (const [key, value] of Object.entries(registry)) {
    if (key.startsWith(REGISTRY_METADATA_PREFIX)) {
      if (key === '__backend' && !registryBackend(registry)) skipped.push(key)
      if (key === '__backend_name' && typeof value !== 'string')
        skipped.push(key)
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
 * Reads the backend header a registry carries under `__backend`.
 * @param registry - Raw registry payload.
 * @returns The header, or undefined when the registry has none or it has no string `id`.
 */
export const registryBackend = (
  registry: Record<string, unknown>
): BackendIdentity | undefined => {
  const header = registry[`${REGISTRY_METADATA_PREFIX}backend`]
  if (typeof header !== 'object' || header === null) return undefined
  const { id, plugin, version, plugins, operations, registry_digest } =
    header as Partial<BackendIdentity>
  if (typeof id !== 'string' || !logicalId.test(id)) return undefined
  if (
    plugin !== undefined &&
    (typeof plugin !== 'string' || !logicalId.test(plugin))
  ) {
    return undefined
  }
  return {
    id,
    ...(plugin && { plugin }),
    ...(typeof version === 'string' && { version }),
    ...(Array.isArray(plugins) && { plugins }),
    ...(Array.isArray(operations) && { operations }),
    ...(typeof registry_digest === 'string' && { registry_digest }),
  }
}

// Backend nodes carry their child registry in the definition's value.
// A placed network node instead carries its editable workflow in value.
export const embeddedRegistry = (
  definition: StandardNodeDefinition
): Record<string, unknown> | undefined => {
  const value: unknown = definition.value
  if (!value || typeof value !== 'object' || !('registry' in value)) return
  const registry = value.registry
  if (registry && typeof registry === 'object' && !Array.isArray(registry)) {
    return registry as Record<string, unknown>
  }
}

export const definitionInRegistry = (
  registry: RegisteredNodes,
  type: string
) => {
  const canonical = canonicalTypeKey(type)
  const key = Object.hasOwn(registry, type)
    ? type
    : Object.keys(registry).find((key) => canonicalTypeKey(key) === canonical)
  if (key === undefined)
    throw new Error(`Node type '${type}' is not in the child registry`)
  return registry[key]
}
