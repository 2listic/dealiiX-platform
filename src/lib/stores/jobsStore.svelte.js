import { getJobsState, JOB_LIST_DAYS } from '../utils/sshMessages'
import { toastState } from './toastsStore.svelte'

let jobs = $state([])

/** @type {Record<number, number>} Maps scheduler job IDs to internal job IDs */
let jobIdMap = $state({})

/**
 * Store for mapping scheduler job IDs to internal jobs IDs.
 */
export const jobIdMapState = {
  get current() {
    return jobIdMap
  },
  /** Returns the next available incremental key */
  getNextKey() {
    const keys = Object.keys(jobIdMap).map(Number)
    return keys.length === 0 ? 0 : Math.max(...keys) + 1
  },
  /**
   * Adds a job ID mapping
   * @param {number} jobIdScheduler - The scheduler job ID
   * @param {number} jobIdInternal - The incremental key used as touch-dir
   */
  add(jobIdScheduler, jobIdInternal) {
    jobIdMap = { ...jobIdMap, [jobIdScheduler]: jobIdInternal }
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
    } catch (error) {
      console.error('Error updating jobs state:', error)
      toastState.add({
        message: error,
        type: 'error',
      })
    }
  },
}
