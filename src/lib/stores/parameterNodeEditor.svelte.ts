import type { ParameterFileFormat } from '../utils/parameterFileFormat'
import {
  parseParametersFileWithFormat,
  serializeParametersFile,
} from '../utils/parameterFileFormat'
import type { ParameterTree } from '../types/parameterTypes'
import type { ParameterExposure } from '../types/nodeTypes'
import {
  readParameterFile,
  writeParameterFile,
  type ParameterFileTarget,
} from '../utils/parameterFileAccess'
import { clearConnectionCache } from '../utils/connectionsValidation'
import { getNodes, setNodes } from './nodes.svelte'
import { graphHistoryState } from './graphStack.svelte'

export type ParameterFileDocument = {
  nodeId: string
  target: ParameterFileTarget
  resolvedPath: string
  format: ParameterFileFormat
  parameters: ParameterTree
  edited: boolean
  saving: boolean
  exposures: ParameterExposure[]
}

export type ParameterNodeEditorOptions = {
  nodeId: string
  exposures?: ParameterExposure[]
}

let document = $state<ParameterFileDocument | null>(null)
let opening = $state(false)

export const parameterNodeEditorState = {
  get document() {
    return document
  },
  get isOpen() {
    return document !== null
  },
  get opening() {
    return opening
  },
  /**
   * Reads and parses a parameter file and makes it the open document, which
   * makes App show the editor in place of the canvas.
   *
   * @param target - Where the file lives.
   * @param options - Id of the node that opened the file and its current exposures (copied).
   * @returns Resolves once the document is open.
   * @throws If the file cannot be read or parsed; the previous document is kept.
   */
  async open(
    target: ParameterFileTarget,
    options: ParameterNodeEditorOptions
  ): Promise<void> {
    opening = true
    try {
      const loaded = await readParameterFile(target)
      const parsed = parseParametersFileWithFormat(
        loaded.content,
        target.fileName
      )
      document = {
        nodeId: options.nodeId,
        target,
        resolvedPath: loaded.resolvedPath,
        format: parsed.format,
        parameters: parsed.data,
        edited: false,
        saving: false,
        exposures: (options.exposures ?? []).map((exposure) => ({
          ...exposure,
          path: [...exposure.path],
        })),
      }
    } finally {
      opening = false
    }
  },
  updateExposures(exposures: ParameterExposure[]): void {
    if (!document) return
    document.exposures = exposures.map((exposure) => ({
      ...exposure,
      path: [...exposure.path],
    }))
    setNodeExposures(document.nodeId, document.exposures)
  },
  replaceParameters(parameters: ParameterTree): void {
    if (!document) return
    document.parameters = parameters
    document.edited = true
  },
  markEdited(): void {
    if (document) document.edited = true
  },
  async save(): Promise<void> {
    if (!document) return
    document.saving = true
    try {
      const content = serializeParametersFile(
        document.parameters,
        document.format === 'prm' ? 'parameters.prm' : 'parameters.json'
      )
      await writeParameterFile(document.target, content)
      document.edited = false
    } finally {
      if (document) document.saving = false
    }
  },
  close(): void {
    document = null
  },
}

// ── Private helpers ──

// Writes through the nodes store, which holds the graph level the editor was
// opened from: the canvas is unmounted while the editor is open.
const setNodeExposures = (
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
            data: {
              ...node.data,
              parameter_file: { exposures: $state.snapshot(exposures) },
            },
          }
        : node
    )
  )
  clearConnectionCache()
}
