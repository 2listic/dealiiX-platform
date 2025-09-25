let jobs = $state([])

export const jobsState = {
  get current() {
    return jobs
  },
  get isEmpty() {
    if (jobs.length === 0) return true // jobs were not retrieved at all
    // check if first job is empty
    return jobs[1].length === 1
  },
  set current(value) {
    jobs = value
  },
}

let isJobListExpanded = $state(false)

export const jobsListState = {
  get isExpanded() {
    return isJobListExpanded
  },
  toggle() {
    isJobListExpanded = !isJobListExpanded
  },
}
