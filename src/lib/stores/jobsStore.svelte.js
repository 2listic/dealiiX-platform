import { getJobsState, JOB_LIST_DAYS } from '../utils/sshMessages'
import { toastState } from './toastsStore.svelte'

/** @type {Record<number, number>} Maps scheduler job IDs to internal job IDs */
let jobIdMap = $state({})

let jobs = $state([])

// Load initial values from electron-store
const loadStore = async () => {
  if (window.electron?.store) {
    jobIdMap = await window.electron.store.get('jobIdMap', {})
    jobs = await window.electron.store.get('jobs', [])
  } else {
    console.warn('Electron store not available (e.g., dev:vite mode)')
  }
}
loadStore()

/**
 * Store for mapping scheduler job IDs to internal jobs IDs.
 */
export const jobIdMapState = {
  get current() {
    return jobIdMap
  },
  /** Returns the next available internal job ID (0, 1, 2, ...) */
  getNextKey() {
    const values = Object.values(jobIdMap)
    if (values.length === 0) return 0
    return Math.max(...values) + 1
  },
  /**
   * Adds a job ID mapping
   * @param {number} jobIdScheduler - The scheduler job ID
   * @param {number} jobIdInternal - The incremental key used as touch-dir
   */
  async add(jobIdScheduler, jobIdInternal) {
    jobIdMap[jobIdScheduler] = jobIdInternal
    await window.electron?.store?.set('jobIdMap', $state.snapshot(jobIdMap))
  },
  /**
   * Gets the internal job ID for a given scheduler job ID
   * @param {number} jobIdScheduler - The scheduler job ID
   * @returns {number | undefined} The internal jobs IDs or undefined if not found
   */
  getJobIdInternal(jobIdScheduler) {
    return jobIdMap[jobIdScheduler]
  },
}

export const jobsState = {
  get current() {
    return jobs
  },
  get isEmpty() {
    if (jobs.length <= 1) return true // jobs were not retrieved at all
    // check if first job is empty
    return jobs[1].length === 1
  },
  get oneOrLess() {
    return jobs.length <= 2
  },
  set current(value) {
    jobs = value
  },
  async update() {
    try {
      jobs = await getJobsState(JOB_LIST_DAYS)
      await window.electron?.store?.set('jobs', $state.snapshot(jobs))
    } catch (error) {
      console.error('Error updating jobs state:', error)
      toastState.add({
        message: error,
        type: 'error',
      })
    }
  },
}
