import { getJobsState, JOB_LIST_DAYS } from '../utils/sshMessages'

let jobs = $state([])

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
    jobs = await getJobsState(JOB_LIST_DAYS)
  },
}
