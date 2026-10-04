import type { ExecutionLocation } from '../types/settingsTypes'
import type { ParameterTree } from '../types/parameterTypes'
import {
  isStagedWorkingFileArgument,
  TypeField,
  type Argument,
  type WorkingFileReference,
} from '../types/nodeTypes'
import { getNodeData, isNodeInRegistry } from '../stores/registryStore.svelte'
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

/** A source/destination pair for a staged working file. */
export type StagedFileCopy = {
  sourcePath: string
  destinationPath: string
}

/**
 * Prepares explicit staged working-file references for one graph execution.
 * Ordinary file references keep the legacy existing-file-to-absolute-path
 * behaviour. Staged references are discovered from target argument metadata
 * reached through graph edges and are processed recursively in subnetworks.
 * @param graph - CORAL network payload about to be submitted.
 * @param location - Execution location whose filesystem is checked.
 * @param workingDirectory - Persistent source directory for the location.
 * @param runDirectory - Per-run directory used as Coral's current directory.
 * @returns A copy of the graph ready for execution.
 * @throws {Error} If a staged file is missing, has an unsafe path, or cannot be staged.
 */
export const prepareGraphFileReferences = async <T extends object>(
  graph: T,
  location: ExecutionLocation,
  workingDirectory: string,
  runDirectory: string
): Promise<T> => {
  const references: GraphValueReference[] = []
  collectGraphReferences(graph, references)

  const ordinaryValues = references
    .filter((reference) => !reference.staged)
    .map((reference) => reference.value)
  const ordinaryResolved = await resolveExistingFiles(
    ordinaryValues,
    location,
    workingDirectory
  )

  const stagedReferences = references.filter(
    (
      reference
    ): reference is GraphValueReference & {
      staged: WorkingFileReference
    } => reference.staged !== undefined
  )
  const workingBase = normalizeDirectory(workingDirectory)
  const runBase = normalizeDirectory(runDirectory)
  if (stagedReferences.length > 0 && (!workingBase || !runBase)) {
    throw new Error(
      'Cannot stage working files without configured working and run directories'
    )
  }

  const stagedPaths = stagedReferences.map((reference) => {
    const logicalPath = normalizeLogicalPath(reference.value)
    return {
      reference,
      logicalPath,
      sourcePath: joinDirectory(workingBase, logicalPath),
      destinationPath: joinDirectory(runBase, logicalPath),
    }
  })
  const existingStagedPaths = new Set(
    stagedPaths.length > 0
      ? await findExistingFiles(
          [...new Set(stagedPaths.map(({ sourcePath }) => sourcePath))],
          location
        )
      : []
  )
  const replacements = new WeakMap<object, Map<string, string>>()
  const copies = new Map<string, StagedFileCopy>()

  for (const reference of references) {
    const replacement = reference.staged
      ? undefined
      : ordinaryResolved.get(reference.value)
    if (replacement !== undefined) {
      setReplacement(replacements, reference, replacement)
    }
  }

  for (const {
    reference,
    logicalPath,
    sourcePath,
    destinationPath,
  } of stagedPaths) {
    if (existingStagedPaths.has(sourcePath)) {
      setReplacement(replacements, reference, logicalPath)
      copies.set(destinationPath, { sourcePath, destinationPath })
    } else if (reference.staged.create_if_missing) {
      // The backend/application owns default-file generation on the first run.
      setReplacement(replacements, reference, sourcePath)
    } else {
      throw new Error(
        `Staged working file is missing and create_if_missing is false: ${sourcePath}`
      )
    }
  }

  const copyList = [...copies.values()]
  if (copyList.length > 0) {
    if (location === 'local') {
      await window.electron.invoke('stage-local-files', { files: copyList })
    } else if (location === 'remote') {
      await window.electron.invoke('execute-ssh-with-key', {
        command: buildRemoteStagedFileCommand(copyList),
        rejectOnNonZeroCode: true,
      })
    }
  }

  return rewriteGraphValues(graph, replacements)
}

/**
 * Builds the server-side command used to stage remote working files.
 * @param copies - Source/destination pairs to copy on the remote host.
 * @returns A safely quoted shell command, or an empty string for no copies.
 */
export const buildRemoteStagedFileCommand = (
  copies: StagedFileCopy[]
): string => {
  return copies
    .map(
      ({ sourcePath, destinationPath }) =>
        `mkdir -p ${shellEscape(parentDirectory(destinationPath))} && cp -- ${shellEscape(sourcePath)} ${shellEscape(destinationPath)}`
    )
    .join(' && ')
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

type ProtocolNode = {
  type?: string
  value?: unknown
  arguments?: Argument[]
  inputs?: number[]
}
type ProtocolEdge = {
  source: string | number
  target: string | number
  target_input: number
}
type ProtocolGraph = {
  workflow?: {
    nodes?: Record<string, ProtocolNode>
    edges?: Record<string, ProtocolEdge>
  }
}

type GraphValueReference = {
  graph: object
  nodeId: string
  value: string
  staged?: WorkingFileReference
}

/** Collects ordinary and explicitly staged values from a graph hierarchy. */
const collectGraphReferences = (
  graph: unknown,
  references: GraphValueReference[]
): void => {
  if (!isObject(graph)) return
  const protocolGraph = graph as ProtocolGraph
  const workflow = protocolGraph.workflow
  if (!workflow?.nodes) return

  const stagedBySource = new Map<string, WorkingFileReference>()
  for (const edge of Object.values(workflow.edges ?? {})) {
    const argument = getTargetInputArgument(
      workflow.nodes[String(edge.target)],
      edge.target_input
    )
    if (!isStagedWorkingFileArgument(argument)) continue

    const sourceId = String(edge.source)
    const previous = stagedBySource.get(sourceId)
    if (previous && previous.create_if_missing !== argument.create_if_missing) {
      throw new Error(
        `Conflicting staged-file metadata for graph source node ${sourceId}`
      )
    }
    stagedBySource.set(sourceId, argument)
  }

  for (const [nodeId, node] of Object.entries(workflow.nodes)) {
    if (node.type === TypeField.CORAL_NETWORK) {
      collectGraphReferences(node.value, references)
    } else if (typeof node.value === 'string') {
      references.push({
        graph: graph as object,
        nodeId,
        value: node.value,
        staged: stagedBySource.get(nodeId),
      })
    }
  }
}

/** Finds the target argument reached by a protocol edge's target handle. */
const getTargetInputArgument = (
  targetNode: ProtocolNode | undefined,
  targetInput: number
): Argument | undefined => {
  if (!targetNode) return undefined

  let definition: { arguments?: Argument[]; inputs?: number[] } | undefined
  if (Array.isArray(targetNode.arguments) && Array.isArray(targetNode.inputs)) {
    definition = targetNode
  } else if (targetNode.type && isNodeInRegistry(targetNode.type)) {
    try {
      definition = getNodeData(targetNode.type)
    } catch {
      return undefined
    }
  }
  const argumentIndex = definition?.inputs?.[targetInput]
  return argumentIndex === undefined
    ? undefined
    : definition?.arguments?.[argumentIndex]
}

/** Stores a replacement for one node in one graph level. */
const setReplacement = (
  replacements: WeakMap<object, Map<string, string>>,
  reference: GraphValueReference,
  value: string
): void => {
  let graphReplacements = replacements.get(reference.graph)
  if (!graphReplacements) {
    graphReplacements = new Map()
    replacements.set(reference.graph, graphReplacements)
  }
  graphReplacements.set(reference.nodeId, value)
}

/** Rebuilds a graph hierarchy with execution-only file-reference replacements. */
const rewriteGraphValues = <T>(
  graph: T,
  replacements: WeakMap<object, Map<string, string>>
): T => {
  if (!isObject(graph)) return graph
  const protocolGraph = graph as ProtocolGraph
  const workflow = protocolGraph.workflow
  if (!workflow?.nodes) return graph
  const graphReplacements = replacements.get(graph as object)
  const nodes = Object.fromEntries(
    Object.entries(workflow.nodes).map(([id, node]) => {
      if (node.type === TypeField.CORAL_NETWORK) {
        return [
          id,
          { ...node, value: rewriteGraphValues(node.value, replacements) },
        ]
      }
      const replacement = graphReplacements?.get(id)
      return replacement === undefined
        ? [id, node]
        : [id, { ...node, value: replacement }]
    })
  )
  return { ...graph, workflow: { ...workflow, nodes } }
}

/** Normalizes a configured directory without removing the root slash. */
const normalizeDirectory = (directory: string): string => {
  const trimmed = directory.trim().replace(/[\\/]+$/, '')
  return trimmed || (directory.trim().startsWith('/') ? '/' : '')
}

/** Validates and normalizes a logical path relative to a working directory. */
const normalizeLogicalPath = (value: string): string => {
  const normalized = value.trim().replaceAll('\\', '/')
  if (
    !normalized ||
    normalized.startsWith('/') ||
    /^[A-Za-z]:\//.test(normalized)
  ) {
    throw new Error(
      `Staged working-file reference must be a non-empty relative path: ${value}`
    )
  }
  const parts = normalized.split('/')
  if (parts.some((part) => part === '..')) {
    throw new Error(
      `Staged working-file reference must stay inside its working directory: ${value}`
    )
  }
  const logicalPath = parts.filter((part) => part && part !== '.').join('/')
  if (!logicalPath) {
    throw new Error(
      `Staged working-file reference must be a non-empty relative path: ${value}`
    )
  }
  return logicalPath
}

/** Joins a configured absolute directory and a logical relative path. */
const joinDirectory = (directory: string, relativePath: string): string => {
  return directory === '/' ? `/${relativePath}` : `${directory}/${relativePath}`
}

/** Returns the parent directory of a POSIX path. */
const parentDirectory = (filePath: string): string => {
  const separator = filePath.lastIndexOf('/')
  return separator <= 0
    ? separator === 0
      ? '/'
      : '.'
    : filePath.slice(0, separator)
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

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
