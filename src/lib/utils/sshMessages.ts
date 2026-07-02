/**
 * SSH and Slurm job orchestration for remote graph execution.
 * Builds and uploads the graph JSON and sbatch script, submits the job,
 * polls for completion, and reports results via toast notifications.
 *
 * Two entry points depending on the execution mode:
 * exportAndEvalCoralGraph(nodes, edges, config?) and
 * exportAndEvalExecutable(config?)
 */

import type { Edge, Node } from '@xyflow/svelte'
import { concatState } from '../stores/concatState.svelte'
import { jobIdMapState, jobsState } from '../stores/jobsStore.svelte'
import { toastState } from '../stores/toastsStore.svelte'
import { parseGraphWithQualifiedIds } from './graphParser'
import {
  JobStatus,
  normalizeJobStatus,
  isTerminalStatus,
} from '../types/jobTypes'
import type { ParameterTree } from '../types/parameterTypes'
// The `?raw` Vite suffix imports the file contents as a plain string at build time.
// It works identically in dev, built app, and packaged Electron binaries.
// Docs: https://vite.dev/guide/assets#importing-asset-as-string
import defaultSbatchTemplate from '../templates/sbatch.template.sh?raw'
import defaultSbatchMpiTemplate from '../templates/sbatch-mpi.template.sh?raw'
import { settingsState } from '../stores/settingsStore.svelte'
import { parametersState } from '../stores/parametersStore.svelte'
import { serializeParametersFile } from './parameterFileFormat'
import { buildDirName } from './slugify'

/**
 * Executes a test SSH command using password authentication.
 * Sends a hardcoded "Hello from Electron!" command to localhost with root credentials.
 * @returns Resolves when the command execution completes.
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
  toastState.add({ message: 'Command was sent' })
}

/**
 * Executes a test SSH command using key-based authentication.
 * Runs "whoami && ls -a" on the configured remote server and displays results in the panel.
 * @returns Resolves when the command execution completes.
 */
export const executeWithKey = async (): Promise<void> => {
  console.log('command', concatState.command)
  const result = await window.electron.invoke('execute-ssh-with-key', {
    command: 'whoami && ls -a',
  })
  console.log('SSH Connection Result:', result)
  toastState.add({ message: 'Command was sent' })
}

export type CoralJobConfig = {
  kind: 'coral'
  /** Remote/local path to the coral binary (captured at stage creation, not read from settings at submit). */
  coralBinaryPath: string
  /** Remote/local path to the coral plugin (captured at stage creation, not read from settings at submit). */
  coralPluginPath: string
  nodes: number
  tasksPerNode: number
  timeLimit: string
  useMpi: boolean
}

export type ExecutableJobConfig = {
  kind: 'executable'
  /** Path of the binary to run (captured at stage creation, not read from settings at submit). */
  executablePath: string
  /** Params filename (extension selects JSON/PRM); captured at stage creation. */
  parametersFileName: string
  timeLimit?: string
}

export type JobConfig = CoralJobConfig | ExecutableJobConfig

/**
 * Exports a computational graph to the remote server and executes it via Slurm.
 * Polls the job status until completion and displays results via toast notifications.
 * @param nodes - Array of nodes (must be snapshots, not reactive)
 * @param edges - Array of edges (must be snapshots, not reactive)
 * @param config - Optional job configuration for template placeholders
 * @param runName - Optional user-supplied name; slugified into the run's output folder (remote only).
 * @returns Resolves when the job completes or fails.
 * @throws {Error} Throws if export, execution, or polling fails.
 * @remarks Callers should pass snapshots using $state.snapshot() or snapshot()
 */
export const exportAndEvalCoralGraph = async (
  nodes: Node[],
  edges: Edge[],
  config: CoralJobConfig,
  runName?: string
): Promise<void> => {
  const { location } = settingsState.execution
  if (location === 'local') {
    await exportAndEvalGraphLocal(nodes, edges, config)
  } else if (location === 'remote') {
    await exportAndEvalGraphRemote(nodes, edges, config, runName)
  }
}

export const exportAndEvalExecutable = async (
  config: ExecutableJobConfig,
  runName?: string
): Promise<void> => {
  const { location } = settingsState.execution
  if (location === 'local') {
    await exportAndEvalExecutableLocal(config)
  } else if (location === 'remote') {
    await exportAndEvalExecutableRemote(config, runName)
  }
}

const exportAndEvalGraphRemote = async (
  nodes: Node[],
  edges: Edge[],
  config: CoralJobConfig,
  runName?: string
): Promise<void> => {
  // Parse the canvas once without MPI; the submit primitive injects the MPI block.
  const graph = buildGraphPayload(nodes, edges, false)
  // Give every single remote run a unique, legible subdir so back-to-back runs
  // don't clobber the shared graph.json/job.sh (the batch script reads
  // <wd>/graph.json by absolute path at Slurm runtime, not at submit). Same
  // isolation pipeline stages already have.
  const runDir = await ensureUniqueRemoteDir(
    `${settingsState.remote.workingDirectory}/${buildDirName('run', runName)}`
  )
  const jobId = await submitCoralStageRemote({
    graph,
    stageDir: runDir,
    config,
    dependencyJobIds: [],
  })
  toastState.add({ message: `Submitted job ${jobId}` })

  // poll every 10 secs for 1 day, finally display final status
  const finalState = await jobPolling(jobId, 10 * 1000, 24 * 60 * 60 * 1000)
  toastState.add({
    message: `Job id ${jobId}: ${finalState}`,
    type: finalState === JobStatus.COMPLETED ? 'success' : 'error',
  })
}

/**
 * Builds, uploads, and submits a single CORAL-graph stage as one Slurm job, with
 * optional `afterok` dependencies, and returns its Slurm job id without polling.
 * @param params.graph - The CORAL network object (MPI block injected here from config).
 * @param params.stageDir - Remote directory used as the job working directory.
 * @param params.config - Per-stage Coral job config (MPI, nodes, time limit).
 * @param params.dependencyJobIds - Slurm ids this stage must wait for (afterok).
 * @returns The submitted Slurm job id.
 * @throws {Error} If sbatch does not return a job id.
 */
export const submitCoralStageRemote = async ({
  graph,
  stageDir,
  config,
  dependencyJobIds,
}: {
  graph: object
  stageDir: string
  config: CoralJobConfig
  dependencyJobIds: string[]
}): Promise<string> => {
  const useMpi = config.useMpi
  const internalJobId = jobIdMapState.getNextKey()

  await ensureRemoteDir(stageDir)
  await uploadFileSsh(
    JSON.stringify(withMpiPlugin(graph, useMpi)),
    `${stageDir}/graph.json`
  )
  const batchScript = buildBatchScript(useMpi, internalJobId, stageDir, config)
  await uploadFileSsh(batchScript, `${stageDir}/job.sh`)

  const jobId = await submitSbatch(`${stageDir}/job.sh`, dependencyJobIds)
  await jobIdMapState.add(jobId, internalJobId, 'coral', stageDir)
  return jobId
}

const exportAndEvalGraphLocal = async (
  nodes: Node[],
  edges: Edge[],
  config: CoralJobConfig
): Promise<void> => {
  const useMpi = config.useMpi
  const internalJobId = jobIdMapState.getNextKey()
  const graphPayload = buildGraphPayload(nodes, edges, useMpi)

  const resultExecute = await window.electron.invoke('start-local-coral-run', {
    coralBinaryPath: config.coralBinaryPath,
    coralPluginPath: config.coralPluginPath,
    workingDirectory: settingsState.local.workingDirectory,
    graphPayload,
    internalJobId,
  })

  const jobId = String(resultExecute.jobId)
  // Local runs resolve via the in-process localRuns registry (absolute paths),
  // not getJobWorkingDirectory, so the recorded workingDirectory is remote-only.
  // Pass '' to make that explicit rather than implying local resolves through it.
  await jobIdMapState.add(jobId, internalJobId, 'coral', '')
  toastState.add({ message: `Started local Coral run ${jobId}` })

  const finalState = await localJobPolling(jobId, 1000, 24 * 60 * 60 * 1000)
  await jobsState.update()
  toastState.add({
    message: `Job id ${jobId}: ${finalState}`,
    type: finalState === JobStatus.COMPLETED ? 'success' : 'error',
  })
}

const getExecutableParametersPayload = () => {
  const parametersPayload = parametersState.snapshot
  if (!parametersPayload) {
    throw new Error(
      'Executable backend requires a synchronized parameters template before execution'
    )
  }
  return parametersPayload
}

const exportAndEvalExecutableLocal = async (
  config: ExecutableJobConfig
): Promise<void> => {
  const internalJobId = jobIdMapState.getNextKey()
  await window.electron.invoke('start-local-executable-run', {
    executablePath: config.executablePath,
    workingDirectory: settingsState.local.workingDirectory,
    parametersPayload: getExecutableParametersPayload(),
    parametersFileName: config.parametersFileName,
    internalJobId,
  })

  // local runs have no external scheduler ID — both keys are the same internalJobId.
  // Local resolves via the in-process localRuns registry, not getJobWorkingDirectory.
  await jobIdMapState.add(internalJobId, internalJobId, 'executable', '')
  toastState.add({ message: `Started local executable run ${internalJobId}` })

  const finalState = await localJobPolling(
    String(internalJobId),
    1000,
    24 * 60 * 60 * 1000
  )
  await jobsState.update()
  toastState.add({
    message: `Job id ${internalJobId}: ${finalState}`,
    type: finalState === JobStatus.COMPLETED ? 'success' : 'error',
  })
}

const exportAndEvalExecutableRemote = async (
  config: ExecutableJobConfig,
  runName?: string
): Promise<void> => {
  // Unique, legible per-run subdir so back-to-back runs don't clobber a shared job.sh.
  const runDir = await ensureUniqueRemoteDir(
    `${settingsState.remote.workingDirectory}/${buildDirName('run', runName)}`
  )

  const jobId = await submitExecutableStageRemote({
    parameters: getExecutableParametersPayload(),
    stageDir: runDir,
    config,
    dependencyJobIds: [],
  })
  toastState.add({ message: `Submitted job ${jobId}` })

  const finalState = await jobPolling(jobId, 10 * 1000, 24 * 60 * 60 * 1000)
  toastState.add({
    message: `Job id ${jobId}: ${finalState}`,
    type: finalState === JobStatus.COMPLETED ? 'success' : 'error',
  })
}

/**
 * Builds, uploads, and submits a single executable stage as one Slurm job, with
 * optional `afterok` dependencies, and returns its Slurm job id without polling.
 * @param params.parameters - Parameter tree serialized to the params file.
 * @param params.stageDir - Remote directory used as the job working directory.
 * @param params.config - Per-stage executable job config (executablePath, parametersFileName, time limit).
 * @param params.dependencyJobIds - Slurm ids this stage must wait for (afterok).
 * @returns The submitted Slurm job id.
 * @throws {Error} If sbatch does not return a job id.
 */
export const submitExecutableStageRemote = async ({
  parameters,
  stageDir,
  config,
  dependencyJobIds,
}: {
  parameters: ParameterTree
  stageDir: string
  config: ExecutableJobConfig
  dependencyJobIds: string[]
}): Promise<string> => {
  const internalJobId = jobIdMapState.getNextKey()
  const { executablePath, parametersFileName } = config

  await ensureRemoteDir(stageDir)
  await uploadFileSsh(
    serializeParametersFile(parameters, parametersFileName),
    `${stageDir}/${parametersFileName}`
  )
  const batchScript = buildExecutableBatchScript(
    internalJobId,
    stageDir,
    executablePath,
    parametersFileName,
    config
  )
  await uploadFileSsh(batchScript, `${stageDir}/job.sh`)

  const jobId = await submitSbatch(`${stageDir}/job.sh`, dependencyJobIds)
  await jobIdMapState.add(jobId, internalJobId, 'executable', stageDir)
  return jobId
}

/**
 * Injects the MPI plugin block into a CORAL network object when MPI is enabled.
 * The plugin block tells CORAL to initialise MPI with the given thread cap.
 * @param network - A CORAL network object (already in protocol form).
 * @param useMpi - Whether to prepend the MPI plugin block.
 * @returns The network unchanged, or a copy with the MPI plugin block prepended.
 */
export const withMpiPlugin = (network: object, useMpi: boolean): object => {
  if (!useMpi) return network
  return {
    plugin: { MPI: { enabled: true, max_num_threads: 1 } },
    ...network,
  }
}

/**
 * Builds the graph payload to upload from canvas nodes/edges, injecting the MPI
 * plugin block when MPI is enabled.
 * @param nodes - Canvas nodes (snapshots).
 * @param edges - Canvas edges (snapshots).
 * @param useMpi - Whether to inject the MPI plugin block.
 * @returns The CORAL network object ready to upload.
 */
export const buildGraphPayload = (
  nodes: Node[],
  edges: Edge[],
  useMpi: boolean
): object => withMpiPlugin(parseGraphWithQualifiedIds(nodes, edges), useMpi)

/**
 * Builds the batch script content from the appropriate template, replacing all placeholders.
 * {{WORKING_DIRECTORY}}, {{CORAL_BINARY_PATH}}, {{CORAL_PLUGIN_PATH}}, and {{TIME_LIMIT}} apply to both templates.
 * {{NODES}} and {{NTASKS_PER_NODE}} apply only to the MPI template.
 * @param useMpi - Whether to use the MPI template.
 * @param internalJobId - The internal job id for the `--job-name`.
 * @param workingDirectory - The job working directory (flows from stageDir, not config).
 * @param config - The complete coral job config (carries coralBinaryPath/coralPluginPath).
 */
const buildBatchScript = (
  useMpi: boolean,
  internalJobId: number,
  workingDirectory: string,
  config: CoralJobConfig
): string => {
  const template = useMpi ? defaultSbatchMpiTemplate : defaultSbatchTemplate
  let script = template
    .replaceAll('{{INTERNAL_JOB_ID}}', String(internalJobId))
    .replaceAll('{{TIME_LIMIT}}', config.timeLimit)
    .replaceAll('{{WORKING_DIRECTORY}}', workingDirectory)
    .replaceAll('{{CORAL_BINARY_PATH}}', config.coralBinaryPath)
    .replaceAll('{{CORAL_PLUGIN_PATH}}', config.coralPluginPath)
  if (useMpi) {
    script = script
      .replaceAll('{{NODES}}', String(config.nodes))
      .replaceAll('{{NTASKS_PER_NODE}}', String(config.tasksPerNode))
  }

  console.log('Generated script:', script)

  return script
}

const shellQuoteForScript = (value: string): string => {
  return `"${String(value).replaceAll('"', '\\"')}"`
}

const shellEscape = (value: string): string => {
  return `'${String(value).replaceAll("'", `'\\''`)}'`
}

const buildExecutableBatchScript = (
  internalJobId: number,
  workingDirectory: string,
  executablePath: string,
  parametersFileName: string,
  config?: ExecutableJobConfig
): string => {
  const timeLimit = config?.timeLimit ?? '01:00:00'

  // Pass the parameters file as a bare name (the job already chdir's into the
  // working directory). This keeps the volatile directory path — e.g. the
  // pipeline's `pipeline-<timestamp>/stage-<id>` — out of the executable's argv.
  // Some deal.II programs (e.g. step-70) sniff their dimension from the file path,
  // so a stray digit in the directory name would otherwise change the run.
  return `#!/bin/bash
#SBATCH --chdir=${workingDirectory}
#SBATCH --output=${workingDirectory}/slurm-%j.out
#SBATCH --job-name=executable-${internalJobId}
#SBATCH --time=${timeLimit}

${shellQuoteForScript(executablePath)} ${shellQuoteForScript(parametersFileName)}
`
}

/** Creates a remote directory (and parents) so SFTP uploads into it succeed. */
const ensureRemoteDir = async (dir: string): Promise<void> => {
  await window.electron.invoke('execute-ssh-with-key', {
    command: `mkdir -p ${shellEscape(dir)}`,
    rejectOnNonZeroCode: true,
  })
}

/**
 * Creates a remote directory for exclusive use by a run/pipeline: if the exact
 * path already exists (a slug was reused), retries with a timestamp-suffixed
 * variant instead of reusing/overwriting it, rather than blocking submission.
 * @param dir - Preferred remote directory path.
 * @returns The remote directory path actually created (`dir` unless a collision occurred).
 * @throws {Error} If a free directory cannot be allocated after a few attempts.
 */
export const ensureUniqueRemoteDir = async (dir: string): Promise<string> => {
  let candidate = dir
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await window.electron.invoke('execute-ssh-with-key', {
      command: `test -d ${shellEscape(candidate)} && echo EXISTS || mkdir -p ${shellEscape(candidate)}`,
      rejectOnNonZeroCode: true,
    })
    if (!result.includes('EXISTS')) return candidate
    candidate = `${dir}-${Date.now()}`
  }
  throw new Error(`Could not allocate a unique directory under ${dir}`)
}

/**
 * Submits a previously-uploaded job script via `sbatch --parsable`, optionally
 * chaining it after other jobs. `--kill-on-invalid-dep=yes` makes Slurm cascade a
 * cancellation to this job (and its descendants) if an upstream dependency fails.
 * @param jobScriptPath - Remote path of the uploaded sbatch script.
 * @param dependencyJobIds - Slurm ids this job must wait for (afterok); empty for none.
 * @returns The submitted Slurm job id.
 * @throws {Error} If sbatch does not return a job id.
 */
const submitSbatch = async (
  jobScriptPath: string,
  dependencyJobIds: string[]
): Promise<string> => {
  const dependencyFlag =
    dependencyJobIds.length > 0
      ? ` --dependency=afterok:${dependencyJobIds.join(':')}`
      : ''
  const command = `sbatch --parsable --kill-on-invalid-dep=yes${dependencyFlag} ${shellEscape(jobScriptPath)}`
  const result = await window.electron.invoke('execute-ssh-with-key', {
    command,
    rejectOnNonZeroCode: true,
  })
  const jobId = result.match(/\d+/)?.[0]
  if (!jobId)
    throw new Error(`sbatch did not return a job ID. Output: "${result}"`)
  return jobId
}

/** Uploads a string as a file to the remote server via SSH. */
const uploadFileSsh = async (
  content: string,
  remotePath: string
): Promise<void> => {
  // console.log(`[uploadFileSsh] uploading to ${remotePath}:`, content)
  const result = await window.electron.invoke('upload-file-ssh', {
    content,
    remotePath,
  })
  console.log(`[uploadFileSsh] result for ${remotePath}:`, result)
}

/**
 * Polls the status of a job by executing an SSH command at regular intervals.
 * @param jobId - The ID of the job to poll.
 * @param interval - The interval (in milliseconds) between polling attempts.
 * @param timeout - The maximum time (in milliseconds) to wait for the job to complete. If not provided, the function will poll indefinitely.
 * @returns A promise that resolves to the job status ('COMPLETED' or 'FAILED') when the job is finished.
 * @throws {Error} Throws an error if there is a polling error or if the job times out.
 */
export const jobPolling = async (
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

      const cleaned = normalizeJobStatus(result.trim())
      if (Object.values(JobStatus).includes(cleaned as JobStatus)) {
        await jobsState.update()

        // stop polling on any terminal state and return it
        if (isTerminalStatus(cleaned)) {
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
 * @param ms - The delay duration in milliseconds.
 * @returns A promise that resolves after the specified delay.
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
      if (isTerminalStatus(cleaned)) {
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
 * Fetches the job list from the remote Slurm scheduler via SSH sacct.
 * @param numDays - How many days back to query.
 * @returns 2D array: row 0 is headers, rows 1+ are job fields.
 * @throws {Error} Throws if the SSH command fails or returns an error string.
 * @example
 * const jobs = await fetchRemoteJobs(7)
 * // [['JobID','State','Start','End'], ['55','COMPLETED','2026-02-09T08:20:39','...']]
 */
export const fetchRemoteJobs = async (numDays: number): Promise<string[][]> => {
  const startDate = new Date(Date.now() - numDays * 24 * 60 * 60 * 1000)
  const startDateIso = startDate.toISOString().split('T')[0]
  // sacct -X (no duplicate steps), -P (parse with pipes), -S (start date), -o (output fields)
  const command = `sacct -X -P -S ${startDateIso} -o JobID,State,Start,End`
  // const command = `sacct -X -P -S 2025-09-29T10:10:00 -o JobID,State,Start,End`

  const result = await window.electron.invoke('execute-ssh-with-key', {
    command,
    rejectOnNonZeroCode: true,
  })

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
 * @param jobId - The ID of the Slurm job
 * @returns A promise that resolves to the content of the file
 */
export const getOutFileContent = async (
  jobId: string | number
): Promise<string> => {
  const execution = settingsState.execution
  if (execution.location === 'local') {
    return await window.electron.invoke('get-local-run-log', { jobId })
  }

  // Resolve the job's own directory (every run/stage gets one), falling back
  // to global settings only for jobs recorded before per-run directories existed.
  const outputDirectory =
    jobIdMapState.getJobWorkingDirectory(String(jobId)) ??
    execution.remote.workingDirectory
  const command = `cat ${shellEscape(`${outputDirectory}/slurm-${jobId}.out`)}`
  return await window.electron.invoke('execute-ssh-with-key', {
    command: command,
  })
}

/**
 * Retrieves the execution status of nodes for a given touch-dir key.
 * @param jobIdInternal - The touch-dir name equivalent to the internal job ID
 * @returns A promise that resolves to a Map where
 * keys are the qualified node IDs and values are arrays of status strings
 * @example
 * const statuses = await getNodesExecutionStatus(42)
 * // Map { '9' => ['running', 'succeeded'], '12_1' => ['running', 'failed'], '12_2' => ['running'] }
 */
export const getNodesExecutionStatus = async (
  jobIdInternal: number
): Promise<Map<string, string[]>> => {
  const execution = settingsState.execution
  // Use the job's own backend kind / directory (a pipeline can mix kinds and dirs),
  // falling back to the global settings for jobs predating per-job tracking.
  const entry = jobIdMapState.getEntryByInternal(jobIdInternal)
  const backendKind = entry?.backendKind ?? execution.backendKind
  if (backendKind === 'executable') {
    return new Map<string, string[]>()
  }
  // define the command to list the files in the touch-dir
  let output = ''
  if (execution.location === 'local') {
    output = await window.electron.invoke('get-local-node-status-files', {
      jobIdInternal,
    })
  } else if (execution.location === 'remote') {
    const statusDirectory =
      entry?.workingDirectory ?? execution.remote.workingDirectory
    try {
      output = await window.electron.invoke('execute-ssh-with-key', {
        command: `ls -tr ${shellEscape(`${statusDirectory}/nodes-exec-status/${jobIdInternal}`)}`,
        rejectOnNonZeroCode: true,
      })
    } catch {
      // status directory not yet created — job is still starting
      return new Map()
    }
  }

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
 * @param url - The URL to open in the new window
 * @returns Resolves when the operation is complete
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
