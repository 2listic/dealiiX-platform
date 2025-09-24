let jobs = $state([])

export const jobsState = {
  get current() {
    return jobs
  },
  set current(value) {
    jobs = value
  },
}
