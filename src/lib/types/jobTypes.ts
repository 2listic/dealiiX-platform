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
}
