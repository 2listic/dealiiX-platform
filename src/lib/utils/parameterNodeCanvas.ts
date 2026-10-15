/**
 * Canvas-level operations on parameter-file nodes: graph edits that change
 * which parameters a node exposes as ports.
 *
 * Handle ids, port types and exposure lookups live in parameterPorts.ts.
 */

import type { ParameterExposure } from '../types/nodeTypes'
import { getNodes, setNodes } from '../stores/nodes.svelte'
import { graphHistoryState } from '../stores/graphStack.svelte'
import { clearConnectionCache } from './connectionsValidation'

/**
 * Replaces a node's parameter exposures in the nodes store, as one undoable
 * graph edit. Does nothing when the node is not in the current graph level.
 *
 * @param nodeId    - Id of the parameter-file node.
 * @param exposures - New exposures; pass a plain snapshot, not a reactive proxy.
 * @returns {void}
 */
export const setNodeParameterExposures = (
  nodeId: string,
  exposures: ParameterExposure[]
): void => {
  if (!getNodes().some((node) => node.id === nodeId)) return
  graphHistoryState.checkpoint()
  setNodes(
    getNodes().map((node) =>
      node.id === nodeId
        ? {
            ...node,
            data: { ...node.data, parameter_file: { exposures } },
          }
        : node
    )
  )
  // Cached connection checks may refer to handles that came or went.
  clearConnectionCache()
}
