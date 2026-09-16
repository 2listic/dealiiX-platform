/**
 * Run-mechanics config for submitting a job: the complete, serializable argument
 * bag a single run or pipeline stage needs at submit time (paths, resources,
 * params filename), independent of the settings store.
 */

/** The resources an MPI run needs, shared by every backend kind that can be launched under MPI. */
export type MpiResourceConfig = {
  /** Whether to request MPI resources and launch the job through `mpirun`. */
  useMpi: boolean
  /** Number of nodes to request (`#SBATCH --nodes`). */
  nodes: number
  /** Ranks per node (`#SBATCH --ntasks-per-node`). */
  tasksPerNode: number
}

/** Submit config for a CORAL graph run (single run or `coralStage` pipeline stage). */
export type CoralJobConfig = MpiResourceConfig & {
  /** Remote/local path to the coral binary (captured at stage creation, not read from settings at submit). */
  coralBinaryPath: string
  /** Remote/local path to the coral plugin (captured at stage creation, not read from settings at submit). */
  coralPluginPath: string
  timeLimit: string
}

/**
 * Submit config for an executable run (single run or `executableStage` pipeline stage).
 * `useMpi` here is the user's assertion that the binary calls `MPI_Init` itself —
 * the app supplies only the launcher and cannot verify the other half.
 */
export type ExecutableJobConfig = MpiResourceConfig & {
  /** Path of the binary to run (captured at stage creation, not read from settings at submit). */
  executablePath: string
  /** Params filename (extension selects JSON/PRM); captured at stage creation. */
  parametersFileName: string
  timeLimit?: string
}
