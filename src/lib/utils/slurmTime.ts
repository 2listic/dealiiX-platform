/**
 * Validation for the Slurm `--time` limit value, shared by the single-run job
 * config modal and the pipeline stage nodes.
 */

// Slurm --time accepted formats: minutes | minutes:seconds | hours:minutes:seconds
// | days-hours | days-hours:minutes | days-hours:minutes:seconds | 0
// See: https://slurm.schedmd.com/sbatch.html#OPT_time
const SLURM_TIME_PATTERN =
  /^(\d+|\d+:\d{2}(:\d{2})?|\d+-\d{2}(:\d{2}(:\d{2})?)?)$/

/** Human-readable hint describing the accepted Slurm `--time` formats. */
export const SLURM_TIME_HINT =
  'Use: minutes, minutes:seconds, HH:MM:SS, D-HH, D-HH:MM, D-HH:MM:SS'

/**
 * Checks whether a string is a valid Slurm `--time` value.
 * @param value - The time-limit string to validate.
 * @returns True if the value matches an accepted Slurm `--time` format.
 */
export const isValidSlurmTime = (value: string): boolean =>
  SLURM_TIME_PATTERN.test(value)
