let jobs = $state([])

export const jobsState = {
  get current() {
    return jobs
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
