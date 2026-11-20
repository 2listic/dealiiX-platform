import type { Edge } from '@xyflow/svelte'
import type { NetworkEdge } from '../types/nodeTypes'

const PARAMETER_INPUT_PREFIX = 'parameter-input-'
const PARAMETER_OUTPUT_PREFIX = 'parameter-output-'

/**
 * Parses an ordinary handle id to its port index.
 * @param handleId - Handle id of the form `input-<n>` or `output-<n>`.
 * @returns The index, or `NaN` for any other id, a parameter handle included.
 */
export const handleIdToIndex = (handleId: string): number => {
  const match = /^(?:input|output)-(\d+)$/.exec(handleId)
  return match ? Number(match[1]) : Number.NaN
}

/**
 * Returns the handle id a canvas edge uses at one of its ends.
 * @param edge - Canvas edge.
 * @param end - The end to read: `'source'` or `'target'`.
 * @returns The edge's handle id at that end, or the node's first handle
 *   (`output-0` / `input-0`) when the edge has none.
 */
export const edgeHandle = (
  edge: Pick<Edge, 'sourceHandle' | 'targetHandle'>,
  end: 'source' | 'target'
): string => {
  const handle = end === 'source' ? edge.sourceHandle : edge.targetHandle
  return handle || `${end === 'source' ? 'output' : 'input'}-0`
}

/**
 * Returns the canvas handle ids of a protocol edge.
 * @param edge - Protocol edge; its `source_handle` / `target_handle` take
 *   precedence over its port indexes.
 * @returns The source and target handle ids.
 */
export const protocolEdgeHandles = (
  edge: NetworkEdge
): { sourceHandle: string; targetHandle: string } => ({
  sourceHandle: edge.source_handle ?? `output-${edge.source_output ?? 0}`,
  targetHandle: edge.target_handle ?? `input-${edge.target_input ?? 0}`,
})

/**
 * Creates the stable handle id of a parameter port.
 * @param direction - `'input'` or `'output'`.
 * @param path - Section names followed by the entry name.
 * @returns The handle id.
 */
export const parameterHandle = (
  direction: 'input' | 'output',
  path: string[]
): string => {
  const prefix =
    direction === 'input' ? PARAMETER_INPUT_PREFIX : PARAMETER_OUTPUT_PREFIX
  return `${prefix}${encodeURIComponent(JSON.stringify(path))}`
}

/**
 * Decodes a parameter handle id.
 * @param handle - Any handle id.
 * @returns The port's direction and parameter path, or null for an ordinary
 *   or malformed handle.
 */
export const parameterHandlePath = (
  handle: string | null | undefined
): { direction: 'input' | 'output'; path: string[] } | null => {
  if (!handle) return null
  const prefix = handle.startsWith(PARAMETER_INPUT_PREFIX)
    ? PARAMETER_INPUT_PREFIX
    : handle.startsWith(PARAMETER_OUTPUT_PREFIX)
      ? PARAMETER_OUTPUT_PREFIX
      : null
  if (!prefix) return null

  try {
    const path = JSON.parse(decodeURIComponent(handle.slice(prefix.length)))
    if (
      !Array.isArray(path) ||
      !path.every((part) => typeof part === 'string')
    ) {
      return null
    }
    return {
      direction: prefix === PARAMETER_INPUT_PREFIX ? 'input' : 'output',
      path,
    }
  } catch {
    return null
  }
}

/**
 * Whether a handle id belongs to a parameter port.
 * @param handle - Any handle id.
 * @returns True for a well-formed parameter handle.
 */
export const isParameterHandle = (handle: string | null | undefined): boolean =>
  parameterHandlePath(handle) !== null
