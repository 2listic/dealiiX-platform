/**
 * User actions on a parameter-file node, shared by its header buttons and its
 * value row: each reports failures in a toast.
 *
 * The graph edits themselves live in parameterNodeCanvas.ts.
 */

import type { StandardNodeDefinition } from '../types/nodeTypes'
import { executionSelectionState } from '../stores/executionSelection.svelte'
import { parameterNodeEditorState } from '../stores/parameterNodeEditor.svelte'
import { settingsState } from '../stores/settingsStore.svelte'
import { toastState } from '../stores/toastsStore.svelte'
import { parameterFileTarget } from './parameterFileAccess'
import { markParameterFile } from './parameterNodeCanvas'

/**
 * Returns why a parameter file cannot be opened at the active location, for a
 * disabled button's tooltip. Reactive when read inside `$derived`.
 *
 * @returns The reason, or `undefined` when the file can be opened.
 */
export const parameterFileUnavailableReason = (): string | undefined => {
  const location = executionSelectionState.location
  const workingDirectory =
    location === 'local'
      ? settingsState.local.workingDirectory
      : settingsState.remote.workingDirectory
  return workingDirectory
    ? undefined
    : `Set the ${location} working directory in Settings first`
}

/**
 * Opens a node's parameter file at the active location in the editor. Does
 * not check the file exists first: a missing file is reported in a toast.
 *
 * @param nodeId - Id of the node naming the file.
 * @param data   - The node's data: its value is the file name.
 * @returns Whether the editor opened.
 */
export const openParameterFile = async (
  nodeId: string,
  data: StandardNodeDefinition
): Promise<boolean> => {
  try {
    await parameterNodeEditorState.open(
      parameterFileTarget(executionSelectionState.location, data.value),
      { nodeId, exposures: data.parameter_file?.exposures }
    )
    return true
  } catch (error) {
    toastState.add({
      message:
        error instanceof Error ? error.message : 'Failed to open parameters',
      type: 'error',
    })
    return false
  }
}

/**
 * Opens a node's file and marks the node as a parameter file. Marks it only
 * once the file opened, so a mistyped path leaves no marker.
 *
 * @param nodeId - Id of the string literal node naming the file.
 * @param data   - The node's data: its value is the file name.
 * @returns Resolves once the editor opened and the node is marked, or the failure was reported.
 */
export const useAsParameterFile = async (
  nodeId: string,
  data: StandardNodeDefinition
): Promise<void> => {
  if (await openParameterFile(nodeId, data)) markParameterFile(nodeId)
}
