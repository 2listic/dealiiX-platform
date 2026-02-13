import type { NodeData, RegisteredNodes } from '../types/nodeTypes'

/**
 * Filters a registry object, separating valid nodes from non-compliant ones.
 * A valid node must be a non-null object with `node_type`, `arguments`, `inputs`, and `outputs`.
 * @param registry - Raw dictionary that may contain both valid node entries and non-compliant nodes
 * @returns Tuple of [filtered valid registry, list of skipped keys]
 */
export const filterValidNodes = (
  registry: Record<string, unknown>
): [RegisteredNodes, string[]] => {
  const skipped: string[] = []
  const filtered: RegisteredNodes = {}
  for (const [key, value] of Object.entries(registry)) {
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
    filtered[key] = value as NodeData
  }
  return [filtered, skipped]
}
