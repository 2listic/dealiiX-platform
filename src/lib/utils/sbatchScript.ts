/**
 * Construction of the sbatch scripts submitted to Slurm. One builder covers
 * every case — coral or executable, MPI or serial — since with a launcher
 * prefix the scripts differ only by resource directives and the command.
 */

import type { MpiLauncherSettings } from '../types/settingsTypes'
import { buildMpiLauncherCommand } from './mpiLauncher'

/** The resources and launcher an MPI job needs; absent for a serial job. */
export type SbatchMpiResources = {
  nodes: number
  tasksPerNode: number
  launcher: MpiLauncherSettings
}

export type SbatchScriptOptions = {
  /** Value of `#SBATCH --job-name`. */
  jobName: string
  /** Directory the job chdir's into and writes its `slurm-%j.out` to. */
  runDirectory: string
  timeLimit: string
  /** The command line to run, already shell-quoted by the caller. */
  command: string
  /** MPI resources and launcher, or null for a serial job. */
  mpi: SbatchMpiResources | null
}

/** Quotes a complete command line for use as a single shell argument. */
const shellQuote = (value: string): string => {
  return `'${value.replaceAll("'", `'\\''`)}'`
}

/**
 * Builds the content of an sbatch script.
 *
 * @param options - Job name, run directory, time limit, command, and MPI resources.
 * @returns The script content, ready to upload as `job.sh`.
 */
export const buildSbatchScript = ({
  jobName,
  runDirectory,
  timeLimit,
  command,
  mpi,
}: SbatchScriptOptions): string => {
  const directives = [
    `#SBATCH --chdir=${runDirectory}`,
    `#SBATCH --output=${runDirectory}/slurm-%j.out`,
    `#SBATCH --job-name=${jobName}`,
  ]

  if (mpi) {
    directives.push(`#SBATCH --nodes=${mpi.nodes}`)
    directives.push(`#SBATCH --ntasks-per-node=${mpi.tasksPerNode}`)
  }

  // Last so the rank directives above stay adjacent, matching the previous templates.
  directives.push(`#SBATCH --time=${timeLimit}`)

  const launcher = mpi ? `${buildMpiLauncherCommand(mpi.launcher)} ` : ''
  const fullCommand = `${launcher}${command}`

  return `#!/bin/bash
${directives.join('\n')}

printf '%s\\n' ${shellQuote(`Command: ${fullCommand}`)}
${fullCommand}
`
}
