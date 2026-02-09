/**
 * Raw status values written by CORAL as touch file extensions
 * (e.g. "123.running", "123.succeeded", "456.failed")
 */
export enum ExecNodeStatus {
  FAILED = 'failed',
  SUCCEEDED = 'succeeded',
  RUNNING = 'running',
}
