import type { Edge, Node } from '@xyflow/svelte'
import { concatState } from '../stores/concatState.svelte'
import { jobIdMapState, jobsState } from '../stores/jobsStore.svelte'
import { toastState } from '../stores/toastsStore.svelte'
import { parseGraphWithQualifiedIds } from './graphParser'
import { setPanelContent } from './panelContent.js'
import { JobStatus } from '../types/executionStatus'
// The `?raw` Vite suffix imports the file contents as a plain string at build time.
// It works identically in dev, built app, and packaged Electron binaries.
// Docs: https://vite.dev/guide/assets#importing-asset-as-string
import defaultSbatchTemplate from '../templates/sbatch.template.sh?raw'
import defaultSbatchMpiTemplate from '../templates/sbatch-mpi.template.sh?raw'
import { settingsState, USE_MPI } from '../stores/settingsStore.svelte'
import { parametersState } from '../stores/parametersStore.svelte'

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

export type JobConfig = {
  nodes: number
  tasksPerNode: number
  timeLimit: string
  uploadGraph: boolean
  uploadParameters: boolean
}

/**
 * Exports a computational graph to the remote server and executes it via Slurm.
 * Polls the job status until completion and displays results via toast notifications.
 * @param {Node[]} nodes - Array of nodes (must be snapshots, not reactive)
 * @param {Edge[]} edges - Array of edges (must be snapshots, not reactive)
 * @param {JobConfig} [config] - Optional job configuration for template placeholders
 * @returns {Promise<void>} Resolves when the job completes or fails.
 * @throws {Error} Throws if export, execution, or polling fails.
 * @remarks Callers should pass snapshots using $state.snapshot() or snapshot()
 */
export const exportAndEvalGraph = async (
  nodes: Node[],
  edges: Edge[],
  config?: JobConfig
): Promise<void> => {
  const execution = settingsState.current.execution
  if (execution.backendKind !== 'coral') {
    throw new Error('Only Coral execution is supported in the current run path')
  }

  if (execution.location === 'local') {
    await exportAndEvalGraphLocal(nodes, edges, config)
    return
  }

  await exportAndEvalGraphRemote(nodes, edges, config)
}

const exportAndEvalGraphRemote = async (
  nodes: Node[],
  edges: Edge[],
  config?: JobConfig
): Promise<void> => {
  const useMpi = settingsState.getKey(USE_MPI) ?? false
  const uploadGraph = config?.uploadGraph ?? true
  const uploadParameters = config?.uploadParameters ?? false

  // build and upload graph JSON (MPI plugin block injected when MPI is enabled)
  if (uploadGraph) {
    const graphPayload = buildGraphPayload(nodes, edges, useMpi)
    await uploadFileSsh(
      JSON.stringify(graphPayload),
      '/app/shared-data/graph.json'
    )
  }

  // upload parameters JSON if enabled
  if (uploadParameters) {
    const params = parametersState.snapshot
    if (params) {
      await uploadFileSsh(
        JSON.stringify(params, null, 2),
        '/app/shared-data/template_parameters.json'
      )
    }
  }

  // build and upload batch script
  const internalJobId = jobIdMapState.getNextKey()
  const batchScript = buildBatchScript(useMpi, internalJobId, config)
  await uploadFileSsh(batchScript, '/app/shared-data/job.sh')

  // submit job
  const resultExecute = await window.electron.invoke('execute-ssh-with-key', {
    command: 'sbatch /app/shared-data/job.sh',
  })
  console.log('SSH Connection Result:', resultExecute)
  toastState.add({ message: resultExecute })

  // get job id and store mapping
  const jobId = resultExecute.match(/\d+/)[0]
  if (!jobId) throw new Error('Job ID not found')
  await jobIdMapState.add(jobId, internalJobId)

  // poll every 10 secs for 1 day, finally display final status
  const finalState = await jobPolling(jobId, 10 * 1000, 24 * 60 * 60 * 1000)
  toastState.add({
    message: `Job id ${jobId}: ${finalState}`,
    type: finalState === JobStatus.COMPLETED ? 'success' : 'error',
  })
}

const exportAndEvalGraphLocal = async (
  nodes: Node[],
  edges: Edge[],
  config?: JobConfig
): Promise<void> => {
  const useMpi = settingsState.getKey(USE_MPI) ?? false
  const uploadGraph = config?.uploadGraph ?? true
  const uploadParameters = config?.uploadParameters ?? false
  const internalJobId = jobIdMapState.getNextKey()
  const graphPayload = buildGraphPayload(nodes, edges, useMpi)
  const parametersPayload = uploadParameters ? parametersState.snapshot : null
  const localSettings = settingsState.current.execution.local

  const resultExecute = await window.electron.invoke('start-local-coral-run', {
    coralBinaryPath: localSettings.coralBinaryPath,
    coralPluginPath: localSettings.coralPluginPath,
    workingDirectory: localSettings.workingDirectory,
    graphPayload,
    parametersPayload,
    internalJobId,
    uploadGraph,
    uploadParameters,
  })

  const jobId = String(resultExecute.jobId)
  await jobIdMapState.add(Number(jobId), internalJobId)
  toastState.add({ message: `Started local Coral run ${jobId}` })

  const finalState = await localJobPolling(
    jobId,
    1000,
    24 * 60 * 60 * 1000
  )
  await jobsState.update()
  toastState.add({
    message: `Job id ${jobId}: ${finalState}`,
    type: finalState === JobStatus.COMPLETED ? 'success' : 'error',
  })
}

/**
 * Builds the graph payload to upload, injecting the MPI plugin block when MPI is enabled.
 * The plugin block tells CORAL to initialise MPI with the given thread cap.
 */
export const buildGraphPayload = (
  nodes: Node[],
  edges: Edge[],
  useMpi: boolean
) => {
  const parsedGraph = parseGraphWithQualifiedIds(nodes, edges)
  if (!useMpi) return parsedGraph
  return {
    plugin: { MPI: { enabled: true, max_num_threads: 1 } },
    ...parsedGraph,
  }
}

/**
 * Builds the batch script content from the appropriate template, replacing all placeholders.
 * {{TIME_LIMIT}} applies to both MPI and non-MPI templates.
 * {{NODES}} and {{NTASKS_PER_NODE}} apply only to the MPI template.
 * Falls back to sensible defaults if config is not provided.
 */
const buildBatchScript = (
  useMpi: boolean,
  internalJobId: number,
  config?: JobConfig
): string => {
  const template = useMpi ? defaultSbatchMpiTemplate : defaultSbatchTemplate
  let script = template
    .replaceAll('{{INTERNAL_JOB_ID}}', String(internalJobId))
    .replaceAll('{{TIME_LIMIT}}', config?.timeLimit ?? '01:00:00')
  if (useMpi) {
    script = script
      .replaceAll('{{NODES}}', String(config?.nodes ?? 1))
      .replaceAll('{{NTASKS_PER_NODE}}', String(config?.tasksPerNode ?? 4))
  }

  // Build the run/input-parameters flags based on config switches
  const uploadGraph = config?.uploadGraph ?? true
  const uploadParameters = config?.uploadParameters ?? false
  const runFlag = uploadGraph ? 'run /app/shared-data/graph.json' : 'run'
  const paramsFlag = uploadParameters
    ? ' -input-parameters /app/shared-data/template_parameters.json'
    : ''
  script = script.replaceAll('{{RUN_FLAGS}}', runFlag + paramsFlag)

  console.log('Generated script:', script)

  return script
}

/** Uploads a string as a file to the remote server via SSH. */
const uploadFileSsh = async (
  content: string,
  remotePath: string
): Promise<void> => {
  const result = await window.electron.invoke('upload-file-ssh', {
    content,
    remotePath,
  })
  console.log('SSH upload result:', result)
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

const localJobPolling = async (
  jobId: string,
  interval: number,
  timeout?: number
): Promise<string> => {
  const start = Date.now()
  while (true) {
    const state = await window.electron.invoke('get-local-run-state', { jobId })
    const cleaned = String(state || '').trim()
    if (Object.values(JobStatus).includes(cleaned as JobStatus)) {
      if (
        [JobStatus.COMPLETED, JobStatus.FAILED].includes(cleaned as JobStatus)
      ) {
        return cleaned
      }
    }

    const now = Date.now()
    if (timeout && now - start > timeout) {
      throw new Error(`Job ${jobId} polling timed out after ${timeout} ms`)
    }
    await delay(interval)
  }
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
  const execution = settingsState.current.execution
  if (execution.backendKind === 'coral' && execution.location === 'local') {
    return await window.electron.invoke('list-local-runs', { numDays })
  }

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
  const execution = settingsState.current.execution
  if (execution.backendKind === 'coral' && execution.location === 'local') {
    return await window.electron.invoke('get-local-run-log', { jobId })
  }

  const command = `cat /app/shared-data/slurm-${jobId}.out`
  return await window.electron.invoke('execute-ssh-with-key', {
    command: command,
  })
}

/**
 * Retrieves the execution status of nodes for a given touch-dir key.
 * @param {number} jobIdInternal - The touch-dir name equivalent to the internal job ID
 * @returns {Promise<Map<string, string[]>>} A promise that resolves to a Map where
 * keys are the qualified node IDs and values are arrays of status strings
 * @example
 * const statuses = await getNodesExecutionStatus(42)
 * // Map { '9' => ['running', 'succeeded'], '12_1' => ['running', 'failed'], '12_2' => ['running'] }
 */
export const getNodesExecutionStatus = async (
  jobIdInternal: number
): Promise<Map<string, string[]>> => {
  const execution = settingsState.current.execution
  // define the command to list the files in the touch-dir
  const output =
    execution.backendKind === 'coral' && execution.location === 'local'
      ? await window.electron.invoke('get-local-node-status-files', {
          jobIdInternal,
        })
      : await window.electron.invoke('execute-ssh-with-key', {
          command: `ls -tr /app/shared-data/nodes-exec-status/${jobIdInternal}`,
        })

  // parse output into a Map where key is node ID and value is array of status strings
  const result = new Map<string, string[]>()
  const trimmed = output.trim()

  if (!trimmed) return result

  for (const line of trimmed.split('\n')) {
    const [nodeId, status] = line.split('.')

    if (!result.has(nodeId)) {
      result.set(nodeId, [])
    }
    result.get(nodeId)!.push(status)
  }
  console.log('getNodesExecutionStatus', result)

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
