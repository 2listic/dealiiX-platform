/**
 * Maps a scheduler job ID to its internal tracking metadata.
 * - For remote (Slurm) runs the scheduler ID is the external Slurm job ID.
 * - For local runs the scheduler ID equals `internalId` (no external scheduler).
 */
export type JobIdEntry = {
  internalId: number
  backendKind: 'coral' | 'executable'
}

/**
 * Raw node's status values written by CORAL Backend as touch file extensions
 * (e.g. "123.running", "123.succeeded", "456.failed" where 123 and 456 are the node IDs)
 */
export enum ExecNodeStatus {
  FAILED = 'failed',
  SUCCEEDED = 'succeeded',
  RUNNING = 'running',
}

/**
 * Slurm job status values returned by `sacct -o State`
 */
export enum JobStatus {
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  CANCELLED = 'CANCELLED',
}

/**
 * Normalises a raw Slurm state string to a `JobStatus` value.
 * `sacct -o State` returns "CANCELLED by <uid>" for cancelled jobs; this strips
 * the suffix so the result matches the bare `JobStatus.CANCELLED` enum entry.
 * @param status - Raw status string from sacct or the local run tracker.
 * @returns The normalised status string.
 */
export const normalizeJobStatus = (status: string): string => {
  if (status.startsWith('CANCELLED')) return JobStatus.CANCELLED
  return status
}

/**
 * Returns true when a job status string represents a terminal state.
 * Callers that receive raw sacct output should normalise with `normalizeJobStatus` first.
 * @param status - Already-normalised status string.
 * @returns Whether the job has reached a terminal state.
 */
export const isTerminalStatus = (status: string): boolean => {
  return [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED].includes(
    status as JobStatus
  )
}
