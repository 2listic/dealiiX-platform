/**
 * Canvas-level operations on parameter-file nodes: graph edits that mark a
 * node as a parameter file and change which parameters it exposes as ports.
 *
 * Handle ids, port types and exposure lookups live in parameterPorts.ts.
 */

import type { Edge } from '@xyflow/svelte'
import type {
  ParameterExposure,
  ParameterFileMetadata,
} from '../types/nodeTypes'
import { getEdges, getNodes, setEdges, setNodes } from '../stores/nodes.svelte'
import { graphHistoryState } from '../stores/graphStack.svelte'
import { clearConnectionCache } from './connectionsValidation'
import { findParameterExposure, parameterHandlePath } from './parameterPorts'

/**
 * Returns the edges attached to parameter handles of a node that the given
 * exposures would no longer provide.
 *
 * @param nodeId    - Id of the parameter-file node.
 * @param exposures - The exposures the node would have.
 * @returns The edges that would be left without a handle.
 */
export const staleParameterEdges = (
  nodeId: string,
  exposures: ParameterExposure[]
): Edge[] => getEdges().filter((edge) => isStale(edge, nodeId, exposures))

/**
 * Replaces a node's parameter exposures in the nodes store and removes the
 * edges whose parameter handle disappears, as one undoable graph edit. Does
 * nothing when the node is not in the current graph level.
 *
 * @param nodeId    - Id of the parameter-file node.
 * @param exposures - New exposures; pass a plain snapshot, not a reactive proxy.
 * @returns {void}
 */
export const setNodeParameterExposures = (
  nodeId: string,
  exposures: ParameterExposure[]
): void => replaceParameterFile(nodeId, { exposures })

/**
 * Marks a node as a parameter file with no exposed parameters, as one
 * undoable graph edit. Does nothing when the node is not in the current
 * graph level.
 *
 * @param nodeId - Id of the string literal node naming the file.
 * @returns {void}
 */
export const markParameterFile = (nodeId: string): void =>
  replaceParameterFile(nodeId, { exposures: [] })

/**
 * Removes a node's parameter-file marker, and the edges attached to its
 * parameter handles, as one undoable graph edit. Does nothing when the node
 * is not in the current graph level. `staleParameterEdges(nodeId, [])` lists
 * the edges this removes.
 *
 * @param nodeId - Id of the parameter-file node.
 * @returns {void}
 */
export const unmarkParameterFile = (nodeId: string): void =>
  replaceParameterFile(nodeId, undefined)

// ── Private helpers ──

/** Writes or removes a node's `parameter_file` and drops the edges left without a handle. */
const replaceParameterFile = (
  nodeId: string,
  parameterFile: ParameterFileMetadata | undefined
): void => {
  if (!getNodes().some((node) => node.id === nodeId)) return
  graphHistoryState.checkpoint()
  setNodes(
    getNodes().map((node) => {
      if (node.id !== nodeId) return node
      const { parameter_file: _previous, ...data } = node.data
      return {
        ...node,
        data: parameterFile ? { ...data, parameter_file: parameterFile } : data,
      }
    })
  )
  const exposures = parameterFile?.exposures ?? []
  setEdges(getEdges().filter((edge) => !isStale(edge, nodeId, exposures)))
  // Cached connection checks may refer to handles that came or went.
  clearConnectionCache()
}

const isStale = (
  edge: Edge,
  nodeId: string,
  exposures: ParameterExposure[]
): boolean => {
  const target =
    edge.target === nodeId ? parameterHandlePath(edge.targetHandle) : null
  if (target?.direction === 'input') {
    return !findParameterExposure(exposures, target.path)?.input
  }
  const source =
    edge.source === nodeId ? parameterHandlePath(edge.sourceHandle) : null
  if (source?.direction === 'output') {
    return !findParameterExposure(exposures, source.path)?.output
  }
  return false
}
