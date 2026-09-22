/** Rendering of the per-target MPI launcher into a runnable command. */

import type { MpiLauncherSettings } from '../types/settingsTypes'

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
