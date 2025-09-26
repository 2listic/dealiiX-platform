import { concatState } from '../stores/concatState.svelte'
import { jobsState } from '../stores/jobsStore.svelte'
import { toastState } from '../stores/toastsStore.svelte'
import { setPanelContent } from './panelContent.js'

const executeWithPassword = async () => {
  // @ts-ignore
  const result = await window.electron.invoke(
    'execute-ssh-command-with-password',
    {
      host: 'localhost',
      username: 'root',
      password: 'root',
      command: 'echo "Hello from Electron!"',
    }
  )
  console.log('SSH Command Result:', result)
  setPanelContent(result)
  toastState.add({ message: 'Command was sent' })
}

const executeWithKey = async () => {
  console.log('command', concatState.command)
  // @ts-ignore
  const result = await window.electron.invoke('execute-ssh-with-key', {
    command: 'whoami && ls -a',
  })
  console.log('SSH Connection Result:', result)
  setPanelContent(result)
  toastState.add({ message: 'Command was sent' })
}

const exportAndEvalGraph = async (nodes, edges) => {
  try {
    // @ts-ignore
    const resultExport = await window.electron.invoke('export-graph-ssh', {
      nodes: nodes,
      edges: edges,
    })
    console.log('SSH Connection Result:', resultExport)

    // @ts-ignore
    const resultExecute = await window.electron.invoke('execute-ssh-with-key', {
      // command: 'sbatch --wrap="echo Hello from $(hostname)" --output=hello.out',
      // command: 'sbatch --wrap="sleep 15" --output=hello.out',
      // command: 'sbatch --wrap="cat /root/graph.json" --output=hello.out'
      command: 'sbatch --wrap="/app/build/dealii_backend.g /root/graph.json"',
    })
    console.log('SSH Connection Result:', resultExecute)
    toastState.add({ message: resultExecute })

    const jobId = resultExecute.match(/\d+/)[0]
    if (!jobId) throw new Error('Job ID not found')
    const sacctCommand = `sacct -j ${jobId} -n -X -P -o State`
    // poll immediately then every 5 secs for 1 day
    await jobPolling(jobId, sacctCommand, 5 * 1000, 24 * 60 * 60 * 1000)
  } catch (error) {
    toastState.add({
      message: error,
      type: 'error',
    })
  }
}

const COMPLETED = 'COMPLETED'
const FAILED = 'FAILED'

const jobPolling = async (jobId, command, interval, timeout) => {
  await delay(2000) // wait 2 secs for job to be submitted then start polling
  const start = Date.now()
  while (true) {
    try {
      await jobsState.update()
      // @ts-ignore
      const result = await window.electron.invoke('execute-ssh-with-key', {
        command: command,
      })
      console.log(result)
      const cleaned = result.trim()
      if (cleaned && (cleaned === COMPLETED || cleaned === FAILED)) {
        toastState.add({
          message: `Job id ${jobId}: ${cleaned}`,
          type: cleaned === COMPLETED ? 'success' : 'error',
        })
        return
      }
    } catch (e) {
      throw new Error(`Job ${jobId} polling error: ${e}`)
    }
    const now = Date.now()
    if (timeout && now - start > timeout) {
      throw new Error(`Job ${jobId} polling timed out after ${timeout} ms`)
    }
    // Wait before the next attempt
    await delay(interval)
  }
}

const delay = (ms) => new Promise((res) => setTimeout(res, ms))

const JOB_DATE_INDEX = [2, 3]
const JOB_LIST_DAYS = 30

const getJobsState = async () => {
  const startDate = new Date(Date.now() - JOB_LIST_DAYS * 24 * 60 * 60 * 1000) // 30 days ago
  const startDateIso = startDate.toISOString().split('T')[0]
  // sacct -X (no duplicate steps), -P (parse with pipes), -S (start date), -o (output fields)
  const command = `sacct -X -P -S ${startDateIso} -o JobID,State,Start,End`
  // const command = `sacct -X -P -S 2025-09-25T16:54:30 -o JobID,State,Start,End`
  try {
    // @ts-ignore
    const result = await window.electron.invoke('execute-ssh-with-key', {
      command: command,
    })
    if (result.includes('error')) throw new Error(result)
    // Split sacct output string into an array and revert order (new jobs first)
    const resultJobs = result.split('\n').reverse()
    resultJobs.shift() // remove first empty element
    // Move the last element (the headers) back to the front
    const last = resultJobs.pop()
    resultJobs.unshift(last)
    // Convert each job row string into a nested array of fields
    const parsedJobs = resultJobs.map((line) => line.split('|'))
    return parsedJobs
  } catch (error) {
    toastState.add({
      message: error,
      type: 'error',
    })
  }
}

export {
  executeWithPassword,
  executeWithKey,
  exportAndEvalGraph,
  JOB_DATE_INDEX,
  JOB_LIST_DAYS,
  getJobsState,
}
