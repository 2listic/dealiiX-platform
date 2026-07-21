import type {
  ParameterLeaf,
  ParameterNode,
  ParameterTree,
} from '../types/parameterTypes'
import { parametersState } from '../stores/parametersStore.svelte'
import { settingsState } from '../stores/settingsStore.svelte'
import { executionSelectionState } from '../stores/executionSelection.svelte'
import { toastState } from '../stores/toastsStore.svelte'
import {
  isExtraNode,
  isParameterLeaf,
  isParameterTree,
  parseParametersFileWithFormat,
  serializeParametersFile,
} from './parameterFileFormat'

/**
 * Absolute path of the last parameters file the user merged from or saved to.
 */
let lastParametersFilePath = ''

/**
 * Reads a parameters file and merges it onto the active location's parameter tree.
 * The existing tree is the authority for structure and metadata; the upload only
 * contributes `value` fields. When the upload contains keys absent from the template,
 * the user is prompted (via `window.confirm`) before those extra keys are included.
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
      const includeExtras = window.confirm(
        `Uploaded file contains sections not present in the template: ${preview}${suffix}.\n\nDo you want to add them to the parameters table anyway?`
      )
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

// ── Private helpers ──

function coerceUploadedLeaf(value: unknown): ParameterLeaf {
  if (isParameterLeaf(value)) {
    return { ...value, __extra: true }
  }

  return {
    value: String(value ?? ''),
    default_value: String(value ?? ''),
    documentation: 'Imported from uploaded parameter file',
    pattern: '.*',
    pattern_description: '[Text]',
    __extra: true,
  }
}

function includeExtraNode(node: unknown): ParameterNode {
  if (isParameterLeaf(node)) {
    return { ...node, __extra: true }
  }

  if (isParameterTree(node)) {
    const entries = Object.entries(node)
      .filter(([key]) => key !== '__extra')
      .map(([key, value]) => [key, includeExtraNode(value)])
    return {
      __extra: true,
      ...Object.fromEntries(entries),
    } as ParameterTree
  }

  return coerceUploadedLeaf(node)
}

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
          mergedEntries.push([key, includeExtraNode(value)])
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
