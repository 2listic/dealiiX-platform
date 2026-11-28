import { settingsState } from '../stores/settingsStore.svelte'
import { toastState } from '../stores/toastsStore.svelte'

import { concatState } from '../stores/concatState.svelte'
import { jobIdMapState } from '../stores/jobsStore.svelte'
import type { ExecutionLocation } from '../types/settingsTypes'
import { shellEscape } from '../utils/shellEscape'

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

export const JOB_DATE_INDEX = [2, 3]
export const JOB_LIST_DAYS = 30

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
 * @param location - Where the job ran (`local`/`remote`).
 * @param jobId - The ID of the Slurm job
 * @returns A promise that resolves to the content of the file
 */
export const getOutFileContent = async (
  location: ExecutionLocation,
  jobId: string | number
): Promise<string> => {
  if (location === 'local') {
    return await window.electron.invoke('get-local-run-log', { jobId })
  }

  // Resolve the job's own directory (every run/stage gets one), falling back
  // to global settings only for jobs recorded before per-run directories existed.
  const outputDirectory =
    jobIdMapState.getJobWorkingDirectory(String(jobId)) ??
    settingsState.remote.workingDirectory
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
  location: ExecutionLocation,
  jobIdInternal: number
): Promise<Map<string, string[]>> => {
  // Use the job's own backend kind / directory (a pipeline can mix kinds and dirs).
  // Node status is a coral-only concept, so default the legacy no-entry case to
  // 'coral' (an executable job short-circuits to an empty map).
  const entry = jobIdMapState.getEntryByInternal(jobIdInternal)
  const backendKind = entry?.backendKind ?? 'coral'
  if (backendKind === 'executable') {
    return new Map<string, string[]>()
  }
  // define the command to list the files in the touch-dir
  let output = ''
  if (location === 'local') {
    output = await window.electron.invoke('get-local-node-status-files', {
      jobIdInternal,
    })
  } else if (location === 'remote') {
    const statusDirectory =
      entry?.workingDirectory ?? settingsState.remote.workingDirectory
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
