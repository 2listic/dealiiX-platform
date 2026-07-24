/**
 * Transient store for the pipeline editor: holds the pipeline as xyflow nodes/edges
 * (one node per stage, one edge per ordering dependency). Mirrors the get/set shape
 * of `nodes.svelte.ts` so `PipelineCanvas` can bind the same way, and exposes a
 * higher-level mutation + validation API plus `toPipeline()` for the orchestrator.
 */

import type { Edge, Node } from '@xyflow/svelte'
import type {
  CoralStageData,
  ExecutableStageData,
  Pipeline,
  PipelineStage,
  StageData,
} from '../types/pipelineTypes'
import type { CoralJobConfig, ExecutableJobConfig } from '../utils/sshMessages'
import type { ParameterTree } from '../types/parameterTypes'
import { isValidSlurmTime } from '../utils/slurmTime'

let nodes = $state.raw<Node[]>([])
let edges = $state.raw<Edge[]>([])
let counter = 0

const DEFAULT_CORAL_CONFIG = (
  coralBinaryPath: string,
  coralPluginPath: string
): CoralJobConfig => ({
  kind: 'coral',
  coralBinaryPath,
  coralPluginPath,
  nodes: 1,
  tasksPerNode: 4,
  timeLimit: '01:00:00',
  useMpi: false,
})

const DEFAULT_EXECUTABLE_CONFIG = (
  executablePath: string,
  parametersFileName: string
): ExecutableJobConfig => ({
  kind: 'executable',
  executablePath,
  parametersFileName,
  timeLimit: '01:00:00',
})

/** Reactive accessors used to bind the SvelteFlow canvas. */
export const getNodes = (): Node[] => nodes
export const getEdges = (): Edge[] => edges
export const setNodes = (next: Node[]): void => {
  nodes = next
}
export const setEdges = (next: Edge[]): void => {
  edges = next
}
export const getNodesSnapshot = (): Node[] =>
  $state.snapshot(nodes) as unknown as Node[]
export const getEdgesSnapshot = (): Edge[] =>
  $state.snapshot(edges) as unknown as Edge[]

export const pipelineState = {
  get nodes(): Node[] {
    return nodes
  },
  get edges(): Edge[] {
    return edges
  },

  /**
   * Adds a CORAL-graph stage node.
   * @param params.name - Display name for the stage.
   * @param params.graph - The CORAL network object (from a file or canvas snapshot).
   * @param params.coralBinaryPath - Coral binary path (captured from settings at creation).
   * @param params.coralPluginPath - Coral plugin path (captured from settings at creation).
   * @param params.position - Optional canvas position; cascades by default.
   */
  addCoralStage({
    name,
    graph,
    coralBinaryPath,
    coralPluginPath,
    position,
  }: {
    name: string
    graph: unknown
    coralBinaryPath: string
    coralPluginPath: string
    position?: { x: number; y: number }
  }): void {
    const data: CoralStageData = {
      name,
      kind: 'coral',
      graph,
      config: DEFAULT_CORAL_CONFIG(coralBinaryPath, coralPluginPath),
    }
    addStageNode('coralStage', data, position)
  },

  /**
   * Adds an executable stage node.
   * @param params.name - Display name for the stage.
   * @param params.executablePath - Binary path (captured from settings at creation).
   * @param params.parametersFileName - Params filename (extension selects JSON/PRM).
   * @param params.position - Optional canvas position; cascades by default.
   */
  addExecutableStage({
    name,
    executablePath,
    parametersFileName,
    position,
  }: {
    name: string
    executablePath: string
    parametersFileName: string
    position?: { x: number; y: number }
  }): void {
    const data: ExecutableStageData = {
      name,
      kind: 'executable',
      parameters: null,
      config: DEFAULT_EXECUTABLE_CONFIG(executablePath, parametersFileName),
    }
    addStageNode('executableStage', data, position)
  },

  /**
   * Shallow-merges a patch into a stage node's top-level data (e.g. name, executablePath).
   * @param id - The stage node id.
   * @param patch - Partial stage data to merge.
   */
  updateStageData(id: string, patch: Partial<StageData>): void {
    nodes = nodes.map((node) =>
      node.id === id
        ? { ...node, data: { ...node.data, ...patch } as StageData }
        : node
    )
  },

  /**
   * Shallow-merges a patch into a stage node's job config.
   * @param id - The stage node id.
   * @param patch - Partial job config to merge.
   */
  updateStageConfig(
    id: string,
    patch: Partial<CoralJobConfig> | Partial<ExecutableJobConfig>
  ): void {
    nodes = nodes.map((node) => {
      if (node.id !== id) return node
      const data = node.data as unknown as StageData
      return {
        ...node,
        data: { ...data, config: { ...data.config, ...patch } } as StageData,
      }
    })
  },

  /**
   * Sets the loaded parameters and filename on an executable stage.
   * @param id - The stage node id.
   * @param params.parameters - The parsed parameter tree.
   * @param params.parametersFileName - The params filename (written into config).
   */
  setStageParameters(
    id: string,
    {
      parameters,
      parametersFileName,
    }: { parameters: ParameterTree; parametersFileName: string }
  ): void {
    this.updateStageData(id, { parameters } as Partial<StageData>)
    this.updateStageConfig(id, { parametersFileName })
  },

  /**
   * Removes a stage node and any edges connected to it.
   * @param id - The stage node id to remove.
   */
  removeStage(id: string): void {
    nodes = nodes.filter((node) => node.id !== id)
    edges = edges.filter((edge) => edge.source !== id && edge.target !== id)
  },

  /** Clears all stages and edges. */
  clear(): void {
    nodes = []
    edges = []
  },

  /**
   * Builds the plain {@link Pipeline} for the orchestrator from the current canvas.
   * @returns The pipeline (stages + ordering edges).
   */
  toPipeline(): Pipeline {
    const snapshotNodes = getNodesSnapshot()
    const snapshotEdges = getEdgesSnapshot()
    const stages: PipelineStage[] = snapshotNodes.map(
      (node) =>
        ({
          id: node.id,
          ...(node.data as unknown as StageData),
        }) as PipelineStage
    )
    return {
      stages,
      edges: snapshotEdges.map((edge) => ({
        source: edge.source,
        target: edge.target,
      })),
    }
  },

  /**
   * Validation summary driving the Run button and inline issue list.
   * @returns `runnable` plus a list of human-readable `issues`.
   */
  get validation(): { runnable: boolean; issues: string[] } {
    const issues: string[] = []
    const { stages } = this.toPipeline()
    if (stages.length === 0) issues.push('Add at least one stage')

    for (const stage of stages) {
      if (stage.kind === 'coral') {
        if (!stage.graph) issues.push(`${stage.name}: no graph loaded`)
        if (!isValidSlurmTime(stage.config.timeLimit))
          issues.push(`${stage.name}: invalid time limit`)
      } else if (stage.kind === 'executable') {
        if (!stage.config.executablePath.trim())
          issues.push(`${stage.name}: no executable path`)
        if (!stage.parameters)
          issues.push(`${stage.name}: no parameters loaded`)
        if (stage.config.timeLimit && !isValidSlurmTime(stage.config.timeLimit))
          issues.push(`${stage.name}: invalid time limit`)
      }
    }
    return { runnable: issues.length === 0, issues }
  },
}

// ── Private helpers ──

/** Appends a new stage node, cascading its position when none is given. */
const addStageNode = (
  type: 'coralStage' | 'executableStage',
  data: StageData,
  position?: { x: number; y: number }
): void => {
  const index = nodes.length
  const node = {
    id: `p${counter++}`,
    type,
    position: position ?? { x: 80 + index * 60, y: 80 + index * 60 },
    data,
  } as unknown as Node
  nodes = [...nodes, node]
}
