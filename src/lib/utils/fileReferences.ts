import type { ExecutionLocation } from '../types/settingsTypes'
import type { ParameterTree } from '../types/parameterTypes'
import { TypeField } from '../types/nodeTypes'
import { isParameterLeaf } from './parameterFileFormat'
import { shellEscape } from './shellEscape'

/**
 * Replaces each literal node value naming an existing file in the working
 * directory with that file's absolute path, so a run can reference inputs by
 * name while executing in its own run directory. Nested subnetworks are
 * included; every other field is left unchanged.
 * @param graph - CORAL network payload about to be submitted.
 * @param location - Execution location whose filesystem is checked.
 * @param workingDirectory - The location's configured working directory.
 * @returns A copy of the graph with existing input files as absolute paths.
 * @throws {Error} If the file check fails (IPC or SSH error).
 */
export const resolveGraphFileReferences = async <T extends object>(
  graph: T,
  location: ExecutionLocation,
  workingDirectory: string
): Promise<T> => {
  const values: string[] = []
  mapGraphValues(graph, (value) => {
    values.push(value)
    return value
  })
  const resolved = await resolveExistingFiles(
    values,
    location,
    workingDirectory
  )
  return mapGraphValues(graph, (value) => resolved.get(value) ?? value)
}

/**
 * Replaces each parameter value naming an existing file in the working
 * directory with that file's absolute path. Only leaf `value` fields are
 * considered; defaults, documentation and patterns are left unchanged.
 * @param tree - Parameter tree about to be written for a run.
 * @param location - Execution location whose filesystem is checked.
 * @param workingDirectory - The location's configured working directory.
 * @returns A copy of the tree with existing input files as absolute paths.
 * @throws {Error} If the file check fails (IPC or SSH error).
 */
export const resolveParameterFileReferences = async (
  tree: ParameterTree,
  location: ExecutionLocation,
  workingDirectory: string
): Promise<ParameterTree> => {
  const values: string[] = []
  mapParameterValues(tree, (value) => {
    values.push(value)
    return value
  })
  const resolved = await resolveExistingFiles(
    values,
    location,
    workingDirectory
  )
  return mapParameterValues(tree, (value) => resolved.get(value) ?? value)
}

// ── Private helpers ──

type ProtocolNode = { type?: string; value?: unknown }
type ProtocolGraph = { workflow?: { nodes?: Record<string, ProtocolNode> } }

/** Rebuilds a graph with `mapValue` applied to every literal node value, recursing into subnetworks. */
const mapGraphValues = <T>(
  graph: T,
  mapValue: (value: string) => string
): T => {
  const workflow = (graph as ProtocolGraph).workflow
  if (!workflow?.nodes) return graph

  const nodes = Object.fromEntries(
    Object.entries(workflow.nodes).map(([id, node]) => {
      if (node.type === TypeField.CORAL_NETWORK) {
        return [id, { ...node, value: mapGraphValues(node.value, mapValue) }]
      }
      if (typeof node.value === 'string') {
        return [id, { ...node, value: mapValue(node.value) }]
      }
      return [id, node]
    })
  )
  return { ...graph, workflow: { ...workflow, nodes } }
}

/** Rebuilds a parameter tree with `mapValue` applied to every leaf `value`. */
const mapParameterValues = (
  tree: ParameterTree,
  mapValue: (value: string) => string
): ParameterTree => {
  return Object.fromEntries(
    Object.entries(tree).map(([key, node]) => {
      if (isParameterLeaf(node)) {
        return [key, { ...node, value: mapValue(node.value) }]
      }
      if (typeof node === 'object' && node !== null) {
        return [key, mapParameterValues(node, mapValue)]
      }
      // The `__extra` flag.
      return [key, node]
    })
  ) as ParameterTree
}

/** Maps each value naming an existing file in `workingDirectory` to that file's absolute path. */
const resolveExistingFiles = async (
  values: string[],
  location: ExecutionLocation,
  workingDirectory: string
): Promise<Map<string, string>> => {
  const baseDirectory = workingDirectory.trim().replace(/\/+$/, '')
  if (!baseDirectory) return new Map()

  const candidates = new Map<string, string>()
  for (const value of values) {
    // Absolute paths already point where they should.
    if (!value.trim() || value.startsWith('/')) continue
    candidates.set(value, `${baseDirectory}/${value}`)
  }
  if (candidates.size === 0) return new Map()

  const existing = new Set(
    await findExistingFiles([...new Set(candidates.values())], location)
  )
  return new Map([...candidates].filter(([, path]) => existing.has(path)))
}

/** Returns the subset of `paths` that are regular files at `location`, in one round trip. */
const findExistingFiles = async (
  paths: string[],
  location: ExecutionLocation
): Promise<string[]> => {
  if (location === 'local') {
    return await window.electron.invoke('find-existing-local-files', { paths })
  } else if (location === 'remote') {
    // A single command for all paths: one SSH connection per path would trip
    // sshd's MaxStartups limit on large graphs or parameter trees.
    const output: string = await window.electron.invoke(
      'execute-ssh-with-key',
      {
        command: `for p in ${paths.map(shellEscape).join(' ')}; do [ -f "$p" ] && printf '%s\\n' "$p"; done; exit 0`,
        rejectOnNonZeroCode: true,
      }
    )
    // stdout and stderr arrive merged, so keep only lines echoing a requested path.
    const requested = new Set(paths)
    return output.split('\n').filter((line) => requested.has(line))
  }
  return []
}
