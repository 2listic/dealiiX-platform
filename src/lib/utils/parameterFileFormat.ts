import type { ParameterLeaf, ParameterTree } from '../types/parameterTypes'

export type ParameterFileFormat = 'json' | 'prm'
export type ParsedParametersFile = {
  data: ParameterTree
  format: ParameterFileFormat
}

const PRM_EXTENSION_RE = /\.prm$/i
const JSON_EXTENSION_RE = /\.json$/i
const PARAMETER_EXTENSION_RE = /\.(json|prm)$/i

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

export const isParameterLeaf = (value: unknown): value is ParameterLeaf => {
  return (
    isRecord(value) &&
    'value' in value &&
    'default_value' in value &&
    'pattern_description' in value
  )
}

export const getParameterFileFormat = (
  fileName: string | undefined
): ParameterFileFormat => {
  return fileName && PRM_EXTENSION_RE.test(fileName) ? 'prm' : 'json'
}

export const withParameterFileFormat = (
  fileName: string | undefined,
  format: ParameterFileFormat
): string => {
  const target = fileName?.trim() || `parameters.${format}`
  return PARAMETER_EXTENSION_RE.test(target)
    ? target.replace(PARAMETER_EXTENSION_RE, `.${format}`)
    : `${target}.${format}`
}

export const normalizeParameterFileName = (
  fileName: string | undefined,
  format: ParameterFileFormat
): string => {
  const trimmed = fileName?.trim() ?? ''
  const basename = trimmed.split(/[/\\]/).pop()
  return withParameterFileFormat(basename || undefined, format)
}

export const getParameterProbeFileNames = (
  fileName: string | undefined
): string[] => {
  const primary = fileName?.trim() || 'parameters.json'
  const alternateFormat =
    getParameterFileFormat(primary) === 'json' ? 'prm' : 'json'
  return Array.from(
    new Set([primary, withParameterFileFormat(primary, alternateFormat)])
  )
}

export const getParameterFileFilters = () => [
  { name: 'Parameter files', extensions: ['json', 'prm'] },
  { name: 'JSON', extensions: ['json'] },
  { name: 'PRM', extensions: ['prm'] },
]

const createImportedLeaf = (
  value: string,
  documentation: string
): ParameterLeaf => ({
  value,
  default_value: value,
  documentation,
  pattern: '.*',
  pattern_description: '[Text]',
})

export const parsePrmParameters = (content: string): ParameterTree => {
  const root: ParameterTree = {}
  const stack: ParameterTree[] = [root]
  const comments: string[] = []
  const lines = content.replace(/\r\n?/g, '\n').split('\n')

  lines.forEach((line, index) => {
    const lineNumber = index + 1
    const trimmed = line.trim()

    if (!trimmed) {
      if (comments.length > 0 && comments[comments.length - 1] !== '') {
        comments.push('')
      }
      return
    }

    if (trimmed.startsWith('#')) {
      comments.push(trimmed.slice(1).trimStart())
      return
    }

    const subsectionMatch = trimmed.match(/^subsection\s+(.+)$/)
    if (subsectionMatch) {
      const name = subsectionMatch[1].trim()
      if (!name) {
        throw new Error(`Invalid PRM subsection name at line ${lineNumber}`)
      }

      const parent = stack[stack.length - 1]
      const existing = parent[name]
      if (existing !== undefined && !isParameterTree(existing)) {
        throw new Error(
          `PRM subsection "${name}" conflicts with a parameter at line ${lineNumber}`
        )
      }

      const section = (existing as ParameterTree | undefined) ?? {}
      parent[name] = section
      stack.push(section)
      comments.length = 0
      return
    }

    if (trimmed === 'end') {
      if (stack.length === 1) {
        throw new Error(`Unexpected PRM end at line ${lineNumber}`)
      }
      stack.pop()
      comments.length = 0
      return
    }

    const setMatch = trimmed.match(/^set\s+(.+?)\s*=\s*(.*)$/)
    if (setMatch) {
      const name = setMatch[1].trim()
      if (!name) {
        throw new Error(`Invalid PRM parameter name at line ${lineNumber}`)
      }

      stack[stack.length - 1][name] = createImportedLeaf(
        setMatch[2].trim(),
        comments.join('\n').trim()
      )
      comments.length = 0
      return
    }

    throw new Error(`Unsupported PRM syntax at line ${lineNumber}: ${line}`)
  })

  if (stack.length !== 1) {
    throw new Error('PRM file ended before all subsections were closed')
  }

  return root
}

export const parseParametersFileWithFormat = (
  content: string,
  fileName?: string
): ParsedParametersFile => {
  const trimmed = content.trimStart()
  const looksJson = trimmed.startsWith('{') || trimmed.startsWith('[')
  if (looksJson || JSON_EXTENSION_RE.test(fileName ?? '')) {
    try {
      return {
        data: coerceParameterTree(JSON.parse(content)),
        format: 'json',
      }
    } catch (error) {
      if (looksJson) {
        throw error
      }
    }
  }

  return {
    data: parsePrmParameters(content),
    format: 'prm',
  }
}

export const parseParametersFile = (
  content: string,
  fileName?: string
): ParameterTree => {
  return parseParametersFileWithFormat(content, fileName).data
}

const isParameterTree = (value: unknown): value is ParameterTree => {
  return isRecord(value) && !Array.isArray(value) && !isParameterLeaf(value)
}

const leafValue = (leaf: ParameterLeaf): string => {
  return String(leaf.value ?? '')
}

const formatDocumentation = (
  documentation: string,
  indent: string
): string[] => {
  if (!documentation.trim()) return []
  return documentation.split('\n').map((line) => {
    return line ? `${indent}# ${line}` : `${indent}#`
  })
}

const serializePrmTree = (tree: ParameterTree, depth = 0): string[] => {
  const indent = '  '.repeat(depth)
  const entries = Object.entries(tree).filter(([key]) => key !== '__extra')
  const leafNameWidth = entries.reduce((width, [key, value]) => {
    return isParameterLeaf(value) ? Math.max(width, key.length) : width
  }, 0)
  const lines: string[] = []

  entries.forEach(([key, value], index) => {
    if (index > 0) {
      lines.push('')
    }

    if (isParameterLeaf(value)) {
      lines.push(...formatDocumentation(value.documentation, indent))
      lines.push(
        `${indent}set ${key.padEnd(leafNameWidth)} = ${leafValue(value)}`
      )
      return
    }

    if (isParameterTree(value)) {
      lines.push(`${indent}subsection ${key}`)
      lines.push(...serializePrmTree(value, depth + 1))
      lines.push(`${indent}end`)
    }
  })

  return lines
}

export const stringifyPrmParameters = (tree: ParameterTree): string => {
  const lines = ['# Listing of Parameters', '# ---------------------']
  const body = serializePrmTree(tree)
  if (body.length > 0) {
    lines.push(...body)
  }
  return `${lines.join('\n')}\n`
}

export const stringifyParametersFile = (
  tree: ParameterTree,
  fileName?: string
): string => {
  return getParameterFileFormat(fileName) === 'prm'
    ? stringifyPrmParameters(tree)
    : JSON.stringify(tree, null, 2)
}

export const coerceParameterTree = (value: unknown): ParameterTree => {
  if (!isParameterTree(value)) {
    throw new Error('Parameters file must contain an object at the top level')
  }
  return value
}
