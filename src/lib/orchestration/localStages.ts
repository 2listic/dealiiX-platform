/**
 * Local launch of a single pipeline stage, split in two so a local scheduler can
 * check and record every stage when the pipeline is submitted (like `sbatch`)
 * and start each one later, once its parents have completed.
 */

import { jobIdMapState } from '../stores/jobsStore.svelte'
import { settingsState } from '../stores/settingsStore.svelte'
import type { PipelineStage } from '../types/pipelineTypes'
import type { MpiResourceConfig } from '../types/jobConfigTypes'
import type { MpiLauncherSettings } from '../types/settingsTypes'
import {
  resolveGraphFileReferences,
  resolveParameterFileReferences,
} from '../utils/fileReferences'
import { withMpiPlugin } from '../utils/sshMessages'

/** A stage checked and recorded at submit, ready to be started. */
export type PreparedLocalStage = {
  /** Internal job id, which is also the local run's job id. */
  key: string
  channel: 'start-local-coral-run' | 'start-local-executable-run'
  payload: object
}

/**
 * Checks a stage's binaries exist locally, resolves its file references, and
 * records its job id, without starting anything.
 *
 * @param stage - The pipeline stage to prepare.
 * @param stageDir - Absolute local directory the stage runs in.
 * @returns The job id and the start payload for {@link startPreparedStage}.
 * @throws {Error} If a binary is missing, an executable stage has no parameters, or the stage type is unknown.
 */
export const prepareStageLocal = async (
  stage: PipelineStage,
  stageDir: string
): Promise<PreparedLocalStage> => {
  const workingDirectory = settingsState.local.workingDirectory
  const mpi = localMpi(stage.config)

  let backendKind: 'coral' | 'executable'
  let channel: PreparedLocalStage['channel']
  let payload: object
  if (stage.type === 'coralStage') {
    const { coralBinaryPath, coralPluginPath } = stage.config
    await assertLocalFilesExist(stage.name, [coralBinaryPath, coralPluginPath])
    backendKind = 'coral'
    channel = 'start-local-coral-run'
    payload = {
      coralBinaryPath,
      coralPluginPath,
      runDirectory: stageDir,
      graphPayload: await prepareLocalStageGraph(
        stage.graph as object,
        stage.config.useMpi,
        workingDirectory
      ),
      mpi,
    }
  } else if (stage.type === 'executableStage') {
    if (!stage.parameters)
      throw new Error(
        `Executable stage "${stage.name}" has no parameters loaded`
      )
    await assertLocalFilesExist(stage.name, [stage.config.executablePath])
    backendKind = 'executable'
    channel = 'start-local-executable-run'
    payload = {
      executablePath: stage.config.executablePath,
      runDirectory: stageDir,
      parametersPayload: await resolveParameterFileReferences(
        stage.parameters,
        'local',
        workingDirectory
      ),
      parametersFileName: stage.config.parametersFileName,
      mpi,
    }
  } else {
    throw new Error(
      `Unknown stage type for stage ${(stage as { id: string }).id}`
    )
  }

  // No await between allocating and recording: `add` writes the in-memory map
  // before its first await, so stages submitted one after another never share
  // a key. A shared key would make Electron overwrite one run with the other.
  const internalJobId = jobIdMapState.getNextKey()
  await jobIdMapState.add(internalJobId, internalJobId, backendKind, stageDir)

  return {
    key: String(internalJobId),
    channel,
    payload: { ...payload, internalJobId },
  }
}

/**
 * Starts a prepared stage as a local process.
 *
 * @param prepared - The stage returned by {@link prepareStageLocal}.
 * @returns Resolves once the process is spawned, not when it finishes.
 * @throws {Error} If the start IPC fails.
 */
export const startPreparedStage = async (
  prepared: PreparedLocalStage
): Promise<void> => {
  await window.electron.invoke(prepared.channel, prepared.payload)
}

// ── Private helpers ──

/** The graph a local Coral stage runs: MPI plugin block plus resolved file references. */
const prepareLocalStageGraph = async (
  graph: object,
  useMpi: boolean,
  workingDirectory: string
): Promise<object> =>
  await resolveGraphFileReferences(
    withMpiPlugin(graph, useMpi),
    'local',
    workingDirectory
  )

/** The local MPI launch for a stage: the configured launcher and its process count. */
const localMpi = (
  config: MpiResourceConfig
): { launcher: MpiLauncherSettings; processes: number } | undefined => {
  if (!config.useMpi) return undefined
  // Copied field by field: the settings proxy can't cross the IPC boundary.
  const { kind, extraArgs } = settingsState.local.mpiLauncher
  return { launcher: { kind, extraArgs }, processes: config.tasksPerNode }
}

/** Throws naming the stage if any absolute path is not an existing local file; bare command names are left to `PATH`. */
const assertLocalFilesExist = async (
  stageName: string,
  paths: string[]
): Promise<void> => {
  const absolute = paths.filter((p) => p.startsWith('/'))
  if (absolute.length === 0) return
  const existing: string[] = await window.electron.invoke(
    'find-existing-local-files',
    { paths: absolute }
  )
  const missing = absolute.filter((p) => !existing.includes(p))
  if (missing.length > 0)
    throw new Error(`${stageName}: not found locally: ${missing.join(', ')}`)
}
