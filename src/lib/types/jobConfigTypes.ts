/**
 * Run-mechanics config for submitting a job: what belongs to the job itself
 * (resources, time limit, executable path, params filename).
 */

/** The resources an MPI run needs, shared by every backend kind that can be launched under MPI. */
export type MpiResourceConfig = {
  /** Whether to request MPI resources and launch the job through the configured MPI launcher. */
  useMpi: boolean
  /** Number of nodes to request remotely (`#SBATCH --nodes`); local runs use one host. */
  nodes: number
  /**
   * Ranks per node remotely (`#SBATCH --ntasks-per-node`); local runs use this
   * existing field as the single-host process count passed to `mpirun -np`.
   */
  tasksPerNode: number
}

/** Submit config for a CORAL graph run (single run or `coralStage` pipeline stage). */
export type CoralJobConfig = MpiResourceConfig & {
  /** Slurm wall-clock limit; ignored by local runs. */
  timeLimit: string
}

/**
 * Submit config for an executable run (single run or `executableStage` pipeline stage).
 * `useMpi` here is the user's assertion that the binary calls `MPI_Init` itself —
 * the app supplies only the launcher and cannot verify the other half.
 */
export type ExecutableJobConfig = MpiResourceConfig & {
  /** Path of the binary to run; per stage, since each executable stage runs its own program. */
  executablePath: string
  /** Params filename (extension selects JSON/PRM); captured at stage creation. */
  parametersFileName: string
  /** Slurm wall-clock limit; ignored by local runs. */
  timeLimit: string
}
