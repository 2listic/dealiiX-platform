/** Rendering of the per-target MPI launcher into a runnable command. */

import type { MpiLauncherSettings } from '../types/settingsTypes'

const splitArguments = (value: string): string[] => {
  const args: string[] = []
  const matcher = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^']*)'|(\S+)/g
  for (const match of value.matchAll(matcher)) {
    args.push((match[1] ?? match[2] ?? match[3]).replaceAll('\\\\"', '"'))
  }
  return args
}

/**
 * Renders a launcher into the command prefix that precedes the binary in a
 * batch script.
 *
 * @param launcher - The target's launcher settings.
 * @returns The launcher command, e.g. `srun --mpi=pmix`.
 */
export const buildMpiLauncherCommand = (
  launcher: MpiLauncherSettings
): string => {
  const extraArgs = launcher.extraArgs?.trim()

  // No rank count either way: under Slurm both launchers take it from the allocation.
  return extraArgs ? `${launcher.kind} ${extraArgs}` : launcher.kind
}

/** Builds argv for an MPI process launched directly on the local machine. */
export const buildLocalMpiArgs = (
  launcher: MpiLauncherSettings,
  processes: number,
  executable: string,
  executableArgs: string[]
): { command: string; args: string[] } => {
  if (launcher.kind !== 'mpirun') {
    throw new Error('Local MPI execution requires the mpirun launcher')
  }
  if (!Number.isInteger(processes) || processes < 1) {
    throw new Error('Local MPI execution requires at least one process')
  }

  return {
    command: launcher.kind,
    args: [
      ...splitArguments(launcher.extraArgs?.trim() ?? ''),
      '-np',
      String(processes),
      executable,
      ...executableArgs,
    ],
  }
}
