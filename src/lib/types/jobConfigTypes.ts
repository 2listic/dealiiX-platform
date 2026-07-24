/**
 * Run-mechanics config for submitting a job: the complete, serializable argument
 * bag a single run or pipeline stage needs at submit time (paths, resources,
 * params filename), independent of the settings store.
 */

/** Submit config for a CORAL graph run (single run or `coralStage` pipeline stage). */
export type CoralJobConfig = {
  /** Remote/local path to the coral binary (captured at stage creation, not read from settings at submit). */
  coralBinaryPath: string
  /** Remote/local path to the coral plugin (captured at stage creation, not read from settings at submit). */
  coralPluginPath: string
  nodes: number
  tasksPerNode: number
  timeLimit: string
  useMpi: boolean
}

/** Submit config for an executable run (single run or `executableStage` pipeline stage). */
export type ExecutableJobConfig = {
  /** Path of the binary to run (captured at stage creation, not read from settings at submit). */
  executablePath: string
  /** Params filename (extension selects JSON/PRM); captured at stage creation. */
  parametersFileName: string
  timeLimit?: string
}
