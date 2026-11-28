import type { ParameterFileFormat } from '../parameters/parameterFileFormat'
import type { ParameterTree } from '../types/parameterTypes'
import type { ParameterExposure } from '../types/nodeTypes'
import {
  loadParameterFile,
  saveParameterFile,
  type ParameterFileTarget,
} from '../parameters/parameterFileAccess'
import {
  saveNodeConfiguration,
  setNodeParameterExposures,
} from '../parameters/parameterNodeCanvas'

type ParameterDocument = {
  nodeId: string
  parameters: ParameterTree
  edited: boolean
  saving: boolean
  exposures: ParameterExposure[]
}

type ParameterFileDocument = ParameterDocument & {
  kind: 'file'
  target: ParameterFileTarget
  resolvedPath: string
  format: ParameterFileFormat
}

type ConfigurationDocument = ParameterDocument & {
  kind: 'configuration'
  name: string
  configurationExposable?: boolean
}

export type ParameterNodeEditorOptions = {
  nodeId: string
  exposures?: ParameterExposure[]
  configurationExposable?: boolean
}

let document = $state<ParameterFileDocument | ConfigurationDocument | null>(
  null
)
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
      const loaded = await loadParameterFile(target)
      document = {
        kind: 'file',
        nodeId: options.nodeId,
        target,
        resolvedPath: loaded.resolvedPath,
        format: loaded.format,
        parameters: loaded.parameters,
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
  openConfiguration(
    name: string,
    parameters: ParameterTree,
    {
      nodeId,
      exposures = [],
      configurationExposable,
    }: ParameterNodeEditorOptions
  ): void {
    document = {
      kind: 'configuration',
      name,
      nodeId,
      configurationExposable,
      parameters: structuredClone(parameters),
      exposures: structuredClone(exposures),
      edited: false,
      saving: false,
    }
  },
  updateExposures(exposures: ParameterExposure[]): void {
    if (!document) return
    document.exposures = exposures.map((exposure) => ({
      ...exposure,
      path: [...exposure.path],
    }))
    // Through the nodes store, which holds the graph level the editor was
    // opened from: the canvas is unmounted while the editor is open.
    setNodeParameterExposures(
      document.nodeId,
      $state.snapshot(document.exposures),
      document.kind === 'file' ? 'parameter_file' : 'configuration_exposures'
    )
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
      if (document.kind === 'file') {
        await saveParameterFile(
          document.target,
          document.parameters,
          document.format
        )
      } else {
        saveNodeConfiguration(
          document.nodeId,
          $state.snapshot(document.parameters)
        )
      }
      document.edited = false
    } finally {
      if (document) document.saving = false
    }
  },
  close(): void {
    document = null
  },
}
