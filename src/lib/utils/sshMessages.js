import { concatState } from '../stores/concatState.svelte'
import { jobsState } from '../stores/jobsStore.svelte'
import { toastState } from '../stores/toastsStore.svelte'
import { parseGraph } from './graphParser'
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
    const parsedGraph = parseGraph(nodes, edges)
    // @ts-ignore
    const resultExport = await window.electron.invoke('export-graph-ssh', {
      graph: parsedGraph
    })
    console.log('SSH Connection Result:', resultExport)

    // @ts-ignore
    const resultExecute = await window.electron.invoke('execute-ssh-with-key', {
      // command: 'sbatch --wrap="sleep 20" --output=hello.out',
      command:
        'sbatch --chdir=/shared-data --wrap="/app/build/dealii_backend.g run /shared-data/graph.json"',
    })
    console.log('SSH Connection Result:', resultExecute)
    toastState.add({ message: resultExecute })

    const jobId = resultExecute.match(/\d+/)[0]
    if (!jobId) throw new Error('Job ID not found')
    const sacctCommand = `sacct -j ${jobId} -n -X -P -o State`
    // poll immediately then every 5 secs for 1 day
    const finalState = await jobPolling(
      jobId,
      sacctCommand,
      10 * 1000,
      24 * 60 * 60 * 1000
    )
    toastState.add({
      message: `Job id ${jobId}: ${finalState}`,
      type: finalState === COMPLETED ? 'success' : 'error',
    })
  } catch (error) {
    toastState.add({
      message: error,
      type: 'error',
    })
  }
}

const COMPLETED = 'COMPLETED'
const FAILED = 'FAILED'
const PENDING = 'PENDING'
const RUNNING = 'RUNNING'

/**
 * Polls the status of a job by executing an SSH command at regular intervals.
 *
 * @async
 * @param {string} jobId - The ID of the job to poll.
 * @param {string} command - The SSH command to execute for polling.
 * @param {number} interval - The interval (in milliseconds) between polling attempts.
 * @param {number} [timeout] - The maximum time (in milliseconds) to wait for the job to complete. If not provided, the function will poll indefinitely.
 * @returns {Promise<string>} - A promise that resolves to the job status ('COMPLETED' or 'FAILED') when the job is finished.
 * @throws {Error} - Throws an error if there is a polling error or if the job times out.
 */
const jobPolling = async (jobId, command, interval, timeout) => {
  await delay(5000) // wait few secs for job to be submitted then start polling

  const start = Date.now()
  while (true) {
    try {
      // @ts-ignore
      const result = await window.electron.invoke('execute-ssh-with-key', {
        command: command,
      })
      console.log(result)

      const cleaned = result.trim()
      if ([COMPLETED, FAILED, PENDING, RUNNING].includes(cleaned)) {
        await jobsState.update()

        if ([COMPLETED, FAILED].includes(cleaned)) {
          return cleaned
        }
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
const JOB_LIST_DAYS = 1

/**
 * Retrieves the state of jobs from the last specified number of days.
 *
 * @async
 * @param {number} numDays - The number of days to look back for job states.
 * @returns {Promise<Array<Array<string>>>} - A promise that resolves to a 2D array of job states, where each inner array represents a job with its details.
 * @throws {Error} - Throws an error if the SSH command execution fails or if the result contains an error.
 */
const getJobsState = async (numDays) => {
  const startDate = new Date(Date.now() - numDays * 24 * 60 * 60 * 1000)
  const startDateIso = startDate.toISOString().split('T')[0]
  // sacct -X (no duplicate steps), -P (parse with pipes), -S (start date), -o (output fields)
  const command = `sacct -X -P -S ${startDateIso} -o JobID,State,Start,End`
  // const command = `sacct -X -P -S 2025-09-29T10:10:00 -o JobID,State,Start,End`
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
    return []
  }
}

/**
 * Opens a new browser window with the specified URL.
 * @async
 * @param {string} url - The URL to open in the new window
 * @returns {Promise<void>} Resolves when the operation is complete
 * @throws Will display error messages via toast notifications if opening fails
 */
async function openNewWindow(url) {
  try {
    //@ts-ignore
    const result = await window.electron.invoke('open-external-url', url)
    if (result.success) {
      toastState.add({ message: 'New window opened' })
    } else {
      toastState.add({
        message: `Failed to open new window: ${result.error}`,
        type: 'error',
      })
    }
  } catch (error) {
    toastState.add({
      message: `Catched, failed to open new window: ${error}`,
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
  openNewWindow,
}
