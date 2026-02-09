import type { Edge, Node } from '@xyflow/svelte'
import { concatState } from '../stores/concatState.svelte'
import { jobIdMapState, jobsState } from '../stores/jobsStore.svelte'
import { toastState } from '../stores/toastsStore.svelte'
import { parseGraph } from './graphParser'
import { setPanelContent } from './panelContent.js'
import { JobStatus } from '../types/executionStatus'

/**
 * Executes a test SSH command using password authentication.
 * Sends a hardcoded "Hello from Electron!" command to localhost with root credentials.
 * @returns {Promise<void>} Resolves when the command execution completes.
 */
export const executeWithPassword = async (): Promise<void> => {
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

/**
 * Executes a test SSH command using key-based authentication.
 * Runs "whoami && ls -a" on the configured remote server and displays results in the panel.
 * @returns {Promise<void>} Resolves when the command execution completes.
 */
export const executeWithKey = async (): Promise<void> => {
  console.log('command', concatState.command)
  const result = await window.electron.invoke('execute-ssh-with-key', {
    command: 'whoami && ls -a',
  })
  console.log('SSH Connection Result:', result)
  setPanelContent(result)
  toastState.add({ message: 'Command was sent' })
}

/**
 * Exports a computational graph to the remote server and executes it via Slurm.
 * Polls the job status until completion and displays results via toast notifications.
 * @param {Node[]} nodes - The array of nodes representing the computational graph.
 * @param {Edge[]} edges - The array of edges connecting the nodes in the graph.
 * @returns {Promise<void>} Resolves when the job completes or fails.
 * @throws {Error} Throws if export, execution, or polling fails.
 */
export const exportAndEvalGraph = async (
  nodes: Node[],
  edges: Edge[]
): Promise<void> => {
  // parse graph
  const parsedGraph = parseGraph(nodes, edges)

  // export graph
  const resultExport = await window.electron.invoke('export-graph-ssh', {
    graph: parsedGraph,
  })
  console.log('SSH Connection Result:', resultExport)

  // get next available internal job Id and use it as name of the directory where nodes' execution status will be placed
  const internalJobId = jobIdMapState.getNextKey()

  // execute graph
  // const sbatchCommand = 'sbatch --wrap="sleep 20" --output=hello.out'
  const sbatchCommand = `sbatch --chdir=/app/shared-data --wrap="/app/build/dealii_backend.g run /app/shared-data/graph.json --touch-dir ${internalJobId}"`
  const resultExecute = await window.electron.invoke('execute-ssh-with-key', {
    command: sbatchCommand,
  })
  console.log('SSH Connection Result:', resultExecute)
  toastState.add({ message: resultExecute })

  // get job id and store mapping
  const jobId = resultExecute.match(/\d+/)[0]
  if (!jobId) throw new Error('Job ID not found')
  await jobIdMapState.add(jobId, internalJobId)

  // poll immediately then every 10 secs for 1 day
  const finalState = await jobPolling(jobId, 10 * 1000, 24 * 60 * 60 * 1000)

  // message to user
  toastState.add({
    message: `Job id ${jobId}: ${finalState}`,
    type: finalState === JobStatus.COMPLETED ? 'success' : 'error',
  })
}

/**
 * Polls the status of a job by executing an SSH command at regular intervals.
 * @param {string} jobId - The ID of the job to poll.
 * @param {number} interval - The interval (in milliseconds) between polling attempts.
 * @param {number} [timeout] - The maximum time (in milliseconds) to wait for the job to complete. If not provided, the function will poll indefinitely.
 * @returns {Promise<string>} A promise that resolves to the job status ('COMPLETED' or 'FAILED') when the job is finished.
 * @throws {Error} Throws an error if there is a polling error or if the job times out.
 */
const jobPolling = async (
  jobId: string,
  interval: number,
  timeout?: number
): Promise<string> => {
  await delay(5000) // wait few secs for job to be submitted then start polling

  const start = Date.now()
  const sacctCommand = `sacct -j ${jobId} -n -X -P -o State`
  while (true) {
    try {
      const result = await window.electron.invoke('execute-ssh-with-key', {
        command: sacctCommand,
      })
      console.log(result)

      const cleaned = result.trim()
      if (Object.values(JobStatus).includes(cleaned as JobStatus)) {
        await jobsState.update()

        // if completed or failed stop polling and return the final status
        if (
          [JobStatus.COMPLETED, JobStatus.FAILED].includes(cleaned as JobStatus)
        ) {
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

/**
 * Delays execution for a specified duration.
 * @param {number} ms - The delay duration in milliseconds.
 * @returns {Promise<void>} A promise that resolves after the specified delay.
 */
const delay = (ms: number): Promise<void> => {
  return new Promise((res) => setTimeout(res, ms))
}

export const JOB_DATE_INDEX = [2, 3]
export const JOB_LIST_DAYS = 7

/**
 * Retrieves the state of jobs from the last specified number of days.
 * @param {number} numDays - The number of days to look back for job states.
 * @returns {Promise<string[][]>} A promise that resolves to a 2D array of job states, where each inner array represents a job with its details.
 * @throws {Error} Throws if the SSH command execution fails or if the result contains an error.
 * @example
 * const jobs = await getJobsState(7)
 * // [['JobID', 'State', 'Start', 'End'], ['55', 'COMPLETED', '2026-02-09T08:20:39', '2026-02-09T08:21:40'], ...]
 */
export const getJobsState = async (numDays: number): Promise<string[][]> => {
  const startDate = new Date(Date.now() - numDays * 24 * 60 * 60 * 1000)
  const startDateIso = startDate.toISOString().split('T')[0]
  // sacct -X (no duplicate steps), -P (parse with pipes), -S (start date), -o (output fields)
  const command = `sacct -X -P -S ${startDateIso} -o JobID,State,Start,End`
  // const command = `sacct -X -P -S 2025-09-29T10:10:00 -o JobID,State,Start,End`

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
  // Convert each job row string into an array of fields
  const parsedJobs = resultJobs.map((line: string) => line.split('|'))

  return parsedJobs
}

/**
 * Retrieves the content of the .out file for a specific job ID.
 * @param {string | number} jobId - The ID of the Slurm job
 * @returns {Promise<string>} A promise that resolves to the content of the file
 */
export const getOutFileContent = async (
  jobId: string | number
): Promise<string> => {
  const command = `cat /app/shared-data/slurm-${jobId}.out`
  return await window.electron.invoke('execute-ssh-with-key', {
    command: command,
  })
}

/**
 * Retrieves the execution status of nodes for a given touch-dir key.
 * @param {number} jobIdInternal - The touch-dir name equivalent to the internal job ID
 * @returns {Promise<Map<number, string[]>>} A promise that resolves to a Map where keys are node IDs and values are arrays of status strings
 * @example
 * const statuses = await getNodesExecutionStatus(42)
 * // Map { 9 => ['running', 'succeeded'], 12 => ['running', 'failed'], 15 => ['running'] }
 */
export const getNodesExecutionStatus = async (
  jobIdInternal: number
): Promise<Map<number, string[]>> => {
  // define the command to list the files in the touch-dir
  const command = `ls -tr /app/shared-data/${jobIdInternal}`

  // get the raw output string with lines in format "nodeId.status"
  const output = await window.electron.invoke('execute-ssh-with-key', {
    command: command,
  })

  // parse output into a Map where key is node ID and value is array of status strings
  const result = new Map<number, string[]>()
  const trimmed = output.trim()

  if (!trimmed) return result

  for (const line of trimmed.split('\n')) {
    const [nodeId, status] = line.split('.')
    const id = parseInt(nodeId, 10)

    if (!result.has(id)) {
      result.set(id, [])
    }
    result.get(id)!.push(status)
  }

  return result
}

/**
 * Opens a new browser window with the specified URL.
 * @param {string} url - The URL to open in the new window
 * @returns {Promise<void>} Resolves when the operation is complete
 * @throws Will display error messages via toast notifications if opening fails
 */
export async function openNewWindow(url: string): Promise<void> {
  try {
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
