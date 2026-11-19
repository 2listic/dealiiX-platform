import type { ParameterNode, ParameterTree } from '../types/parameterTypes'
import type { ExecutionLocation } from '../types/settingsTypes'
import { parametersState } from '../stores/parametersStore.svelte'
import { settingsState } from '../stores/settingsStore.svelte'
import { executionSelectionState } from '../stores/executionSelection.svelte'
import { toastState } from '../stores/toastsStore.svelte'
import { confirmAction } from '../stores/confirmation.svelte'
import {
  isExtraNode,
  isParameterLeaf,
  markAsExtra,
  parseParametersFileWithFormat,
  serializeParametersFile,
} from './parameterFileFormat'
import {
  parameterFileTarget,
  readParameterFile,
  writeParameterFile,
  type ParameterFileTarget,
} from './parameterFileAccess'

/**
 * Absolute path of the last parameters file the user merged from or saved to.
 */
let lastParametersFilePath = ''

/**
 * Reads a parameters file and merges it onto the active location's parameter tree.
 * The existing tree is the authority for structure and metadata; the upload only
 * contributes `value` fields. When the upload contains keys absent from the template,
 * the user is asked (via `confirmAction`) before those extra keys are included.
 *
 * @param file - The user-selected parameters file (JSON or PRM).
 * @returns A promise that resolves once the merge has been applied (or aborted on error).
 */
export async function mergeParametersFromFile(file: File): Promise<void> {
  try {
    const { data: uploadedTree } = parseParametersFileWithFormat(
      await file.text(),
      file.name
    )
    lastParametersFilePath = window.electron?.getFilePath?.(file) ?? ''

    const baseTemplate = parametersState.snapshot
    if (!baseTemplate) return
    const initialMerge = mergeParametersTemplate(baseTemplate, uploadedTree)
    let merged = initialMerge.merged
    const { extraPaths } = initialMerge

    if (extraPaths.length > 0) {
      const preview = extraPaths.slice(0, 5).join(', ')
      const suffix =
        extraPaths.length > 5 ? `, and ${extraPaths.length - 5} more` : ''
      const includeExtras = await confirmAction({
        title: 'Sections not in the template',
        message: `The uploaded file contains sections not present in the template: ${preview}${suffix}. Do you want to add them to the parameters table anyway?`,
        confirmText: 'Add them',
        confirmVariant: 'action',
      })
      if (includeExtras) {
        // Second merge pass with includeExtras=true to include the extra keys.
        merged = mergeParametersTemplate(
          baseTemplate,
          uploadedTree,
          '',
          true
        ).merged
        toastState.add({
          message: 'Extra sections were added to the parameters table',
          type: 'info',
          timeout: 8000,
        })
      } else {
        toastState.add({
          message:
            'Extra sections were ignored and only template entries were loaded',
          type: 'info',
          timeout: 8000,
        })
      }
    }

    parametersState.value = merged
  } catch {
    toastState.add({ message: 'Invalid parameters file', type: 'error' })
  }
}

/**
 * Downloads the active location's parameter tree as a JSON or PRM file.
 *
 * @returns A promise that resolves once the save dialog closes or the download starts.
 */
export async function downloadParameters(): Promise<void> {
  const snapshot = parametersState.snapshot
  if (!snapshot) return

  const defaultPath =
    lastParametersFilePath ||
    settingsState.getParametersFileName(executionSelectionState.location) ||
    'template_parameters.json'

  if (window.electron?.invoke) {
    const result = await window.electron.invoke('save-parameters-file', {
      defaultPath,
      parameters: snapshot,
      title: 'Save Parameters File',
    })
    if (!result?.canceled && result?.filePath) {
      lastParametersFilePath = result.filePath
      toastState.add({
        message: `Parameters saved to ${result.filePath}`,
        type: 'success',
      })
    }
    return
  }

  const content = serializeParametersFile(snapshot, defaultPath)
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download =
    defaultPath.split(/[/\\]/).pop() || 'template_parameters.json'
  anchor.click()
  URL.revokeObjectURL(url)
}

/**
 * Merges the values of a parameters file in a working directory onto a template,
 * trying each file name in turn. Keys the template lacks are kept, flagged `__extra`.
 *
 * @param location         - Execution location the working directory belongs to.
 * @param workingDirectory - Working directory to look in.
 * @param fileNames        - Candidate file names, relative to the working directory.
 * @param template         - Tree giving the structure and metadata.
 * @returns The merged tree and the path read, or null when no candidate could be read.
 */
export async function mergeWorkingDirectoryParameters(
  location: ExecutionLocation,
  workingDirectory: string,
  fileNames: string[],
  template: ParameterTree
): Promise<{ parameters: ParameterTree; resolvedPath: string } | null> {
  for (const fileName of new Set(fileNames.filter(Boolean))) {
    const target: ParameterFileTarget = { location, workingDirectory, fileName }
    let content
    try {
      content = await readParameterFile(target)
    } catch {
      // Missing or unreadable: try the next name.
      continue
    }
    // Parse outside the try, so a malformed file is reported, not skipped.
    const { data } = parseParametersFileWithFormat(content.content, fileName)
    return {
      parameters: mergeParametersTemplate(template, data, '', true).merged,
      resolvedPath: content.resolvedPath,
    }
  }
  return null
}

/**
 * Replaces the active location's values with those of its parameters file in the
 * working directory, after confirmation. Entries missing from the file keep their
 * current values, since the pristine template is not kept after a probe.
 *
 * @returns A promise that resolves once the values are reloaded, or nothing was found.
 */
export async function reloadParametersFromWorkingDirectory(): Promise<void> {
  const current = parametersState.value
  if (!current) return
  const location = executionSelectionState.location
  const fileName = settingsState.getParametersFileName(location)
  const { workingDirectory } = parameterFileTarget(location, fileName)
  if (
    !(await confirmAction({
      message: `Replace the values in the app with those of ${fileName} in the working directory?`,
      confirmText: 'Replace',
      confirmVariant: 'action',
    }))
  ) {
    return
  }

  try {
    const result = await mergeWorkingDirectoryParameters(
      location,
      workingDirectory,
      [fileName],
      current
    )
    if (!result) {
      toastState.add({
        message: `Could not read ${fileName} in ${workingDirectory || 'the working directory'}`,
        type: 'error',
      })
      return
    }
    parametersState.value = result.parameters
    toastState.add({
      message: `Loaded values from ${result.resolvedPath}`,
      type: 'success',
    })
  } catch (error) {
    toastState.add({
      message:
        error instanceof Error ? error.message : 'Failed to reload parameters',
      type: 'error',
    })
  }
}

/**
 * Writes the active location's parameter tree to its parameters file in the
 * working directory, overwriting it. Runs keep using their own copy in the run folder.
 *
 * @returns A promise that resolves once the file is written or the error toasted.
 */
export async function saveParametersToWorkingDirectory(): Promise<void> {
  const snapshot = parametersState.snapshot
  if (!snapshot) return
  const location = executionSelectionState.location
  const target = parameterFileTarget(
    location,
    settingsState.getParametersFileName(location)
  )
  try {
    await writeParameterFile(
      target,
      serializeParametersFile(snapshot, target.fileName)
    )
    toastState.add({
      message: `Parameters saved to ${target.workingDirectory}/${target.fileName}`,
      type: 'success',
    })
  } catch (error) {
    toastState.add({
      message:
        error instanceof Error ? error.message : 'Failed to save parameters',
      type: 'error',
    })
  }
}

// ── Private helpers ──

/**
 * Merges an uploaded file onto the canonical template tree.
 * The template is the authority for structure and metadata; the upload only contributes `value` fields.
 * Designed to be called twice from `mergeParametersFromFile` when extra keys are detected: first with
 * `includeExtras=false` (dry run), then with `includeExtras=true` if the user confirms.
 * @param template      - Canonical parameter tree (authority for structure and metadata).
 * @param uploaded      - Parsed content of the user's file (untrusted, arbitrary shape).
 * @param currentPath   - Dot-separated path of the current subtree for building `extraPaths`. Pass `''` at root.
 * @param includeExtras - Whether to include keys not present in the template.
 * @returns Merged tree and list of dotted paths that were in the upload but not the template.
 */
function mergeParametersTemplate(
  template: ParameterTree,
  uploaded: unknown,
  currentPath = '',
  includeExtras = false
): { merged: ParameterTree; extraPaths: string[] } {
  const extraPaths: string[] = []
  // Phase 1: walk every key in the template, taking values from the upload when present.
  const mergedEntries: [string, ParameterNode][] = Object.entries(template)
    .filter(([key]) => key !== '__extra')
    .map(([key, templateValue]) => {
      const path = currentPath ? `${currentPath}.${key}` : key
      const uploadedValue =
        uploaded && typeof uploaded === 'object' && key in uploaded
          ? (uploaded as Record<string, unknown>)[key]
          : undefined

      if (isParameterLeaf(templateValue)) {
        // Uploaded is a full leaf (JSON format): take its value, keep template metadata.
        if (uploadedValue && isParameterLeaf(uploadedValue)) {
          return [key, { ...templateValue, value: uploadedValue.value }]
        }
        // Uploaded is a bare primitive (PRM format): stringify it into the template leaf.
        if (
          uploadedValue !== undefined &&
          (typeof uploadedValue !== 'object' || uploadedValue === null)
        ) {
          return [key, { ...templateValue, value: String(uploadedValue) }]
        }
        // No uploaded value: keep the template default unchanged.
        return [key, { ...templateValue }]
      }

      const nestedUploaded =
        uploadedValue && typeof uploadedValue === 'object' ? uploadedValue : {}
      const nested = mergeParametersTemplate(
        templateValue as ParameterTree,
        nestedUploaded,
        path,
        includeExtras
      )
      // Bubble up extra paths from nested levels.
      extraPaths.push(...nested.extraPaths)
      // Preserve __extra flag if the template subtree was itself already extra.
      return [
        key,
        isExtraNode(templateValue)
          ? { __extra: true, ...nested.merged }
          : nested.merged,
      ]
    })

  // Phase 2: find keys in the upload that don't exist in the template.
  // Phase 1 only walks template keys, so this second pass is needed to catch upload-only keys.
  if (uploaded && typeof uploaded === 'object') {
    for (const [key, value] of Object.entries(
      uploaded as Record<string, unknown>
    )) {
      if (key === '__extra') continue
      if (!(key in template)) {
        extraPaths.push(currentPath ? `${currentPath}.${key}` : key)
        if (includeExtras) {
          mergedEntries.push([key, markAsExtra(value)])
        }
      }
    }
  }

  return {
    merged: {
      ...(isExtraNode(template) ? { __extra: true } : {}),
      ...Object.fromEntries(mergedEntries),
    } as ParameterTree,
    extraPaths,
  }
}
