import type { ParameterFileFormat } from '../utils/parameterFileFormat'
import {
  parseParametersFileWithFormat,
  serializeParametersFile,
} from '../utils/parameterFileFormat'
import type { ParameterTree } from '../types/parameterTypes'
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
}

let document = $state<ParameterFileDocument | null>(null)
let opening = $state(false)

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
  async open(target: ParameterFileTarget): Promise<void> {
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
      }
    } finally {
      opening = false
    }
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
  },
}
