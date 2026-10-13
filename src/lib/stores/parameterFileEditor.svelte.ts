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

export type ParameterFileDocument = {
  target: ParameterFileTarget
  resolvedPath: string
  format: ParameterFileFormat
  parameters: ParameterTree
  dirty: boolean
  saving: boolean
  exposures: ParameterExposure[]
}

export type ParameterFileEditorOptions = {
  exposures?: ParameterExposure[]
  onExposureChange?: (_exposures: ParameterExposure[]) => void
}

let document = $state<ParameterFileDocument | null>(null)
let opening = $state(false)
let exposureChangeHandler:
  | ((_exposures: ParameterExposure[]) => void)
  | undefined

export const parameterFileEditorState = {
  get document() {
    return document
  },
  get isOpen() {
    return document !== null
  },
  get opening() {
    return opening
  },
  async open(
    target: ParameterFileTarget,
    options: ParameterFileEditorOptions = {}
  ): Promise<void> {
    opening = true
    try {
      const loaded = await readParameterFile(target)
      const parsed = parseParametersFileWithFormat(
        loaded.content,
        target.fileName
      )
      document = {
        target,
        resolvedPath: loaded.resolvedPath,
        format: parsed.format,
        parameters: parsed.data,
        dirty: false,
        saving: false,
        exposures: (options.exposures ?? []).map((exposure) => ({
          ...exposure,
          path: [...exposure.path],
        })),
      }
      exposureChangeHandler = options.onExposureChange
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
    exposureChangeHandler?.(document.exposures)
  },
  replaceParameters(parameters: ParameterTree): void {
    if (!document) return
    document.parameters = parameters
    document.dirty = true
  },
  markDirty(): void {
    if (document) document.dirty = true
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
      document.dirty = false
    } finally {
      if (document) document.saving = false
    }
  },
  close(): void {
    document = null
    exposureChangeHandler = undefined
  },
}
