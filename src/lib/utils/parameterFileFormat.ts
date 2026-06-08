import type { ParameterLeaf, ParameterTree } from '../types/parameterTypes'

export type ParameterFileFormat = 'json' | 'prm'
export type ParsedParametersFile = {
  data: ParameterTree
  format: ParameterFileFormat
}

const PRM_EXTENSION_RE = /\.prm$/i
const JSON_EXTENSION_RE = /\.json$/i
const PARAMETER_EXTENSION_RE = /\.(json|prm)$/i

export const isParameterLeaf = (value: unknown): value is ParameterLeaf => {
  return (
    typeof value === 'object' &&
    value !== null &&
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

/**
 * Returns `fileName` with its extension replaced by the format's canonical extension.
 * Appends the extension if none is present. Defaults to `parameters.<format>` when `fileName` is absent.
 *
 * @param fileName - Filename to modify (path components are preserved).
 * @param format   - Target format determining the output extension.
 */
export const replaceExtension = (
  fileName: string | undefined,
  format: ParameterFileFormat
): string => {
  const target = fileName?.trim() || `parameters.${format}`
  return PARAMETER_EXTENSION_RE.test(target)
    ? target.replace(PARAMETER_EXTENSION_RE, `.${format}`)
    : `${target}.${format}`
}

/**
 * Strips the path from `fileName` and normalises its extension to match `format`.
 *
 * @param fileName - File path or bare name to normalise.
 * @param format   - Target format determining the output extension.
 */
export const normalizeParameterFileName = (
  fileName: string | undefined,
  format: ParameterFileFormat
): string => {
  const trimmed = fileName?.trim() ?? ''
  const basename = trimmed.split(/[/\\]/).pop()
  return replaceExtension(basename || undefined, format)
}

/**
 * Returns the ordered list of candidate filenames to try when probing an executable
 * for its parameters template. JSON is always tried first because it carries richer
 * metadata (validation patterns, default values) than PRM.
 *
 * @param fileName - Configured parameters filename. Defaults to `"parameters.json"`.
 * @returns `[jsonCandidate, prmCandidate]` derived from `fileName`'s basename.
 */
export const getParameterProbeFileNames = (
  fileName: string | undefined
): string[] => {
  const primary = fileName?.trim() || 'parameters.json'
  return [replaceExtension(primary, 'json'), replaceExtension(primary, 'prm')]
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

/**
 * Parses a deal.II `.prm` file into a `ParameterTree`.
 *
 * The format consists of `subsection` / `end` blocks for nesting,
 * `set <name> = <value>` entries for leaf parameters, and `#`-prefixed
 * comment lines that become each leaf's `documentation` field.
 * Inline `# …` suffixes on `set` lines (e.g. `# default: 0`) are stripped
 * to match deal.II's own `ParameterHandler` behaviour.
 *
 * @param content - Raw `.prm` file text (any line ending).
 * @returns The parsed `ParameterTree` with all subsections and leaf values.
 * @throws If the file contains unknown syntax, mismatched `subsection`/`end`
 *         pairs, name collisions, or an empty parameter or subsection name.
 */
export const parsePrmParameters = (content: string): ParameterTree => {
  // root is the top-level tree that will be returned.
  const root: ParameterTree = {}

  // stack tracks the current nesting path. stack[0] is always root.
  // Each 'subsection' pushes a new object; each 'end' pops it.
  // stack.length - 1 is the current depth; stack[stack.length - 1] is the active node.
  const stack: ParameterTree[] = [root]

  // comments accumulates consecutive '#' lines immediately before a 'set' or 'subsection'.
  // Stored without the leading '#' and flushed (reset to []) after each value or section.
  const comments: string[] = []

  // Normalise line endings to '\n' (Windows PRM files use '\r\n').
  const lines = content.replace(/\r\n?/g, '\n').split('\n')

  lines.forEach((line, index) => {
    const lineNumber = index + 1
    const trimmed = line.trim()

    // ── Blank line ──────────────────────────────────────────────────────────
    if (!trimmed) {
      // A blank line separates comment paragraphs. Push an empty string as a
      // paragraph separator only if there are already comments and the last
      // line is not already a separator, to avoid duplicates.
      if (comments.length > 0 && comments[comments.length - 1] !== '') {
        comments.push('')
      }
      return
    }

    // ── Full-line comment (# …) ──────────────────────────────────────────────
    if (trimmed.startsWith('#')) {
      // Strip the '#' and one optional leading space; accumulate for the next entry.
      comments.push(trimmed.slice(1).trimStart())
      return
    }

    // ── subsection <name> ────────────────────────────────────────────────────
    const subsectionMatch = trimmed.match(/^subsection\s+(.+)$/)
    if (subsectionMatch) {
      const name = subsectionMatch[1].trim()
      if (!name) {
        throw new Error(`Invalid PRM subsection name at line ${lineNumber}`)
      }

      const parent = stack[stack.length - 1]
      const existing = parent[name]

      // deal.II allows re-opening a subsection that already exists (two-stage
      // parsing: the first pass may create it, the second pass re-enters it).
      // Guard against a name collision where a 'set' already claimed the key.
      if (existing !== undefined && !isParameterTree(existing)) {
        throw new Error(
          `PRM subsection "${name}" conflicts with a parameter at line ${lineNumber}`
        )
      }

      // Reuse the existing section object if present, otherwise create a new one.
      const section = (existing as ParameterTree | undefined) ?? {}
      parent[name] = section
      // Descend: make the new section the active node.
      stack.push(section)
      comments.length = 0
      return
    }

    // ── end ──────────────────────────────────────────────────────────────────
    if (trimmed === 'end') {
      // Popping the root would mean there is an unmatched 'end'.
      if (stack.length === 1) {
        throw new Error(`Unexpected PRM end at line ${lineNumber}`)
      }
      // Ascend: return to the parent section.
      stack.pop()
      comments.length = 0
      return
    }

    // ── set <name> = <value> ─────────────────────────────────────────────────
    // The name can contain spaces (e.g. 'set Function expression = …').
    // The lazy (.+?) stops at the first ' =' to avoid greedily eating the '='.
    const setMatch = trimmed.match(/^set\s+(.+?)\s*=\s*(.*)$/)
    if (setMatch) {
      const name = setMatch[1].trim()
      if (!name) {
        throw new Error(`Invalid PRM parameter name at line ${lineNumber}`)
      }

      // deal.II treats '#' as an inline comment character: everything from
      // the first '#' onward is documentation, not part of the value.
      // Example: "t < 0.5 ? 6.28 : -6.28 # default: 0" → "t < 0.5 ? 6.28 : -6.28"
      const rawValue = setMatch[2]
      const hashPos = rawValue.indexOf('#')
      const value = (
        hashPos >= 0 ? rawValue.slice(0, hashPos) : rawValue
      ).trim()

      // Join accumulated comment lines into a single documentation string and
      // store the leaf in the currently active section (top of stack).
      stack[stack.length - 1][name] = createImportedLeaf(
        value,
        comments.join('\n').trim()
      )
      comments.length = 0
      return
    }

    throw new Error(`Unsupported PRM syntax at line ${lineNumber}: ${line}`)
  })

  // After processing every line the stack should be back to just [root].
  // A non-empty stack means one or more 'subsection' blocks were never closed.
  if (stack.length !== 1) {
    throw new Error('PRM file ended before all subsections were closed')
  }

  return root
}

/**
 * Parses a parameter file and returns the tree together with the detected format.
 * Content sniffing takes precedence over the filename extension.
 *
 * @param content  - Raw file text to parse.
 * @param fileName - Optional filename used as a hint when content sniffing is inconclusive.
 * @returns Parsed ParameterTree and the detected format.
 * @throws If the content looks like JSON (starts with `{` or `[`) but fails to parse.
 */
export const parseParametersFileWithFormat = (
  content: string,
  fileName?: string
): ParsedParametersFile => {
  const trimmed = content.trimStart()

  // Content sniffing takes priority: JSON-looking content must parse as valid JSON.
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const parsed = JSON.parse(content)
    if (!isParameterTree(parsed)) {
      throw new Error('Parameters file must contain an object at the top level')
    }
    return { data: parsed, format: 'json' }
  }

  // Extension hint: try JSON but silently fall back to PRM if the content is not JSON.
  if (JSON_EXTENSION_RE.test(fileName ?? '')) {
    try {
      const parsed = JSON.parse(content)
      if (isParameterTree(parsed)) {
        return { data: parsed, format: 'json' }
      }
    } catch {
      // Content is not JSON despite the .json extension — fall through to PRM.
    }
  }

  return {
    data: parsePrmParameters(content),
    format: 'prm',
  }
}

export const isParameterTree = (value: unknown): value is ParameterTree => {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !isParameterLeaf(value)
  )
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

/**
 * Serialises a ParameterTree to deal.II PRM text format.
 * The two-line header matches the standard deal.II output so the file is
 * accepted by executables that validate the header.
 */
export const stringifyPrmParameters = (tree: ParameterTree): string => {
  const lines = ['# Listing of Parameters', '# ---------------------']
  const body = serializePrmTree(tree)
  if (body.length > 0) {
    lines.push(...body)
  }
  return `${lines.join('\n')}\n`
}

/**
 * Serialises a ParameterTree to JSON or PRM text.
 * Format is derived from `fileName`'s extension: `.prm` → PRM, otherwise JSON.
 * When `fileName` is absent, JSON is used as the default.
 */
export const serializeParametersFile = (
  tree: ParameterTree,
  fileName?: string
): string => {
  return getParameterFileFormat(fileName) === 'prm'
    ? stringifyPrmParameters(tree)
    : JSON.stringify(tree, null, 2)
}
