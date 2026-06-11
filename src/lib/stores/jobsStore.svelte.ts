import { fetchRemoteJobs, JOB_LIST_DAYS } from '../utils/sshMessages'
import { settingsState } from './settingsStore.svelte'
import { toastState } from './toastsStore.svelte'
import type { JobIdEntry } from '../types/jobTypes'

/**
 * Maps scheduler job IDs to { internalId, backendKind } entries.
 *
 * - For remote (Slurm) runs the key is the external scheduler ID (e.g. 55) and
 *   internalId is the touch-dir counter allocated before submission.
 * - For local runs there is no external scheduler, so the key equals internalId
 *   (the circular mapping is harmless; backendKind is the only useful field).
 */
let jobIdMap = $state<Record<string, JobIdEntry>>({})

/**
 * 2D array mirroring the format returned by list-local-runs / sacct:
 *   row 0 → headers ['JobID', 'State', 'Start', 'End']
 *   row n → [id, state, isoStart, isoEnd]
 *
 * Persisted to electron-store under 'jobs' so the table survives cold restarts
 * without requiring an immediate SSH connection or IPC call.
 */
let jobs = $state<string[][]>([])

// Load initial values from electron-store.
// jobIdMap entries that pre-date the { internalId, backendKind } shape (old
// format stored a bare number) are discarded so the store always has a uniform
// type — no inline migration guards elsewhere.
const loadStore = async (): Promise<void> => {
  if (!window.electron?.store) {
    console.warn('Electron store not available (e.g., dev:vite mode)')
    return
  }
  const rawMap = await window.electron.store.get('jobIdMap', {})
  if (isValidJobIdMap(rawMap)) {
    jobIdMap = rawMap as Record<string, JobIdEntry>
  } else {
    await window.electron.store.set('jobIdMap', {})
  }
  jobs = await window.electron.store.get('jobs', [])
}
loadStore()

/**
 * Returns true only if every value in the map has the current { internalId, backendKind } shape.
 * @param map - The raw value loaded from electron-store.
 * @returns Whether the map conforms to the expected `Record<string, JobIdEntry>` shape.
 */
const isValidJobIdMap = (map: unknown): boolean => {
  if (!map || typeof map !== 'object') return false
  return Object.values(map as Record<string, unknown>).every(
    (v) =>
      v !== null &&
      typeof v === 'object' &&
      typeof (v as JobIdEntry).internalId === 'number' &&
      ((v as JobIdEntry).backendKind === 'coral' ||
        (v as JobIdEntry).backendKind === 'executable')
  )
}

/**
 * Store for mapping scheduler job IDs to internal job metadata.
 * Used by JobsTable to resolve the touch-dir path and to gate the Nodes Status button.
 *
 * Scheduler IDs are accepted as `number | string` throughout because call sites produce
 * them in different forms: remote paths parse a string out of sbatch stdout via regex;
 * local paths receive a number over IPC. JS object keys are always strings internally,
 * so both forms resolve to the same slot (e.g. `obj[123]` and `obj["123"]` are identical).
 * The read path (JobsTable) always has strings since the job list is `string[][]`.
 */
export const jobIdMapState = {
  get current(): Record<string, JobIdEntry> {
    return jobIdMap
  },
  /**
   * Returns the next available internal job ID (0, 1, 2, ...).
   * @returns The next integer ID to use for a new job.
   */
  getNextKey(): number {
    const ids = Object.values(jobIdMap).map((v) => v.internalId)
    if (ids.length === 0) return 0
    return Math.max(...ids) + 1
  },
  /**
   * Records a new job ID mapping.
   * @param jobIdScheduler - Slurm ID for remote jobs; equals internalJobId for local jobs.
   * @param jobIdInternal - The touch-dir counter used in nodes-exec-status/<id>/.
   * @param backendKind - Backend used for this run.
   */
  async add(
    jobIdScheduler: number | string,
    jobIdInternal: number,
    backendKind: 'coral' | 'executable'
  ): Promise<void> {
    jobIdMap[jobIdScheduler] = { internalId: jobIdInternal, backendKind }
    await window.electron?.store?.set('jobIdMap', $state.snapshot(jobIdMap))
  },
  /**
   * @param jobIdScheduler - The scheduler job ID to look up.
   * @returns The internal job ID, or undefined if not found.
   */
  getJobIdInternal(jobIdScheduler: string): number | undefined {
    return jobIdMap[jobIdScheduler]?.internalId
  },
  /**
   * @param jobIdScheduler - The scheduler job ID to look up.
   * @returns The backend kind, or undefined if not found.
   */
  getJobBackendKind(
    jobIdScheduler: string
  ): 'coral' | 'executable' | undefined {
    return jobIdMap[jobIdScheduler]?.backendKind
  },
}

/**
 * Store for the job list details displayed in JobsTable.
 * Content differs by execution location:
 *   - local  → IPC list local runs
 *   - remote → SSH sacct query
 */
export const jobsState = {
  get current(): string[][] {
    return jobs
  },
  get isEmpty(): boolean {
    if (jobs.length <= 1) return true
    return jobs[1].length === 1
  },
  get oneOrLess(): boolean {
    return jobs.length <= 2
  },
  set current(value: string[][]) {
    jobs = value
  },
  /** Refreshes the job list from the appropriate source for the current execution location. */
  async update(): Promise<void> {
    try {
      const isLocal = settingsState.execution.location === 'local'
      jobs = isLocal
        ? await window.electron.invoke('list-local-runs', {
            numDays: JOB_LIST_DAYS,
          })
        : await fetchRemoteJobs(JOB_LIST_DAYS)
      await window.electron?.store?.set('jobs', $state.snapshot(jobs))
    } catch (error) {
      console.error('Error updating jobs state:', error)
      toastState.add({
        message:
          error instanceof Error ? error.message : 'Failed to refresh job list',
        type: 'error',
      })
    }
  },
}
