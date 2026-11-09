/**
 * User actions on a parameter-file node, shared by its header buttons and its
 * value row: each reports failures in a toast and asks before removing
 * connections.
 *
 * The graph edits themselves live in parameterNodeCanvas.ts.
 */

import type { StandardNodeDefinition } from '../types/nodeTypes'
import { executionSelectionState } from '../stores/executionSelection.svelte'
import { parameterNodeEditorState } from '../stores/parameterNodeEditor.svelte'
import { settingsState } from '../stores/settingsStore.svelte'
import { toastState } from '../stores/toastsStore.svelte'
import {
  parameterFilePath,
  parameterFileTarget,
  writeParameterFile,
  type ParameterFileTarget,
} from './parameterFileAccess'
import {
  getParameterFileFormat,
  parseParametersFileWithFormat,
} from './parameterFileFormat'
import { findExistingFiles } from './fileReferences'
import { confirmAction } from '../stores/confirmation.svelte'
import {
  markParameterFile,
  staleParameterEdges,
  unmarkParameterFile,
} from './parameterNodeCanvas'

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
    reportOpenError(error)
    return false
  }
}

/**
 * Opens a node's file and marks the node as a parameter file. Marks it only
 * once the file opened, so a mistyped path leaves no marker. When the file is
 * missing, offers to upload a local file to the node's path.
 *
 * @param nodeId - Id of the string literal node naming the file.
 * @param data   - The node's data: its value is the file name.
 * @returns Resolves once the node is marked, or the failure was reported.
 */
export const useAsParameterFile = async (
  nodeId: string,
  data: StandardNodeDefinition
): Promise<void> => {
  const target = parameterFileTarget(
    executionSelectionState.location,
    data.value
  )
  try {
    // The file opened in the editor: mark the node.
    await parameterNodeEditorState.open(target, {
      nodeId,
      exposures: data.parameter_file?.exposures,
    })
    markParameterFile(nodeId)
  } catch (error) {
    // The read failed. If the file is missing, offer to upload one;
    // otherwise report the error.
    if (await askToUploadMissingFile(target)) {
      await uploadParameterFile(nodeId, data, target)
    } else {
      reportOpenError(error)
    }
  }
}

/**
 * Removes a node's parameter-file marker, after asking when that removes
 * connections from the graph.
 *
 * @param nodeId - Id of the parameter-file node.
 * @returns Resolves once the node is unmarked or the user declined.
 */
export const confirmUnmarkParameterFile = async (
  nodeId: string
): Promise<void> => {
  const removed = staleParameterEdges(nodeId, []).length
  if (
    removed > 0 &&
    !(await confirmAction({
      title: 'Unmark parameter file',
      message: `This removes ${removed} ${removed === 1 ? 'connection' : 'connections'} from the graph. Continue?`,
      confirmText: 'Unmark',
      confirmVariant: 'delete',
    }))
  ) {
    return
  }
  unmarkParameterFile(nodeId)
}

// ── Private helpers ──

const reportOpenError = (error: unknown): void => {
  toastState.add({
    message:
      error instanceof Error ? error.message : 'Failed to open parameters',
    type: 'error',
  })
}

/**
 * Asks whether to upload a local file to a file's path, only when the file is
 * confirmed missing: a failed read can also mean an SSH or permission error,
 * which keeps its toast.
 */
const askToUploadMissingFile = async (
  target: ParameterFileTarget
): Promise<boolean> => {
  // No working directory: the read error already says to configure one.
  if (!target.workingDirectory) return false
  let path: string
  try {
    path = parameterFilePath(target)
    // The file exists, so the read failed for another reason.
    const existing = await findExistingFiles([path], target.location)
    if (existing.length > 0) return false
  } catch {
    // An invalid name or a failed check: keep the read error.
    return false
  }
  return confirmAction({
    title: 'Parameter file not found',
    message: `Not found at ${path}. A parameter file must exist before it can be used: upload a local file to save there?`,
    confirmText: 'Upload a local file…',
    confirmVariant: 'action',
  })
}

/**
 * Saves a picked local file under the node's path, then opens it in the editor
 * and marks the node. A picked file in the other format is rejected, since the
 * node's name sets the format the backend reads.
 */
const uploadParameterFile = async (
  nodeId: string,
  data: StandardNodeDefinition,
  target: ParameterFileTarget
): Promise<void> => {
  const expected = getParameterFileFormat(target.fileName)
  const file = await pickLocalFile(`.${expected}`)
  // The picker was cancelled: leave the node unmarked.
  if (!file) return
  try {
    const content = await file.text()
    // The format is sniffed from the content, as when the file is opened.
    const { format } = parseParametersFileWithFormat(content, file.name)
    if (format !== expected) {
      throw new Error(
        `${file.name} is a ${format.toUpperCase()} file, but ${target.fileName} needs ${expected.toUpperCase()}`
      )
    }
    await writeParameterFile(target, content)
    await parameterNodeEditorState.open(target, {
      nodeId,
      exposures: data.parameter_file?.exposures,
    })
    markParameterFile(nodeId)
  } catch (error) {
    reportOpenError(error)
  }
}

/** Opens the system file picker; resolves to `null` when it is cancelled. */
const pickLocalFile = (accept: string): Promise<File | null> =>
  new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null))
    input.addEventListener('cancel', () => resolve(null))
    input.click()
  })
