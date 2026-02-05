import { getJobsState, JOB_LIST_DAYS } from '../utils/sshMessages'
import { toastState } from './toastsStore.svelte'

let jobs = $state([])

/** @type {Record<number, string>} Maps incremental keys to Slurm job IDs */
let jobIdMap = $state({})

/**
 * Store for mapping incremental touch-dir keys to Slurm job IDs.
 * Used to correlate node execution status directories with their jobs.
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
   * @param {number} key - The incremental key used as touch-dir
   * @param {string} jobId - The Slurm job ID
   */
  add(key, jobId) {
    jobIdMap = { ...jobIdMap, [key]: jobId }
    // console.log('jobIdMapState', $state.snapshot(jobIdMapState))
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
