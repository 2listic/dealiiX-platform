import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import store from './storage.js'
import { serializeParametersFile } from '../../src/lib/utils/parameterFileFormat.js'
import type { ParameterTree } from '../../src/lib/types/parameterTypes.js'
import { buildLocalMpiArgs } from '../../src/lib/utils/mpiLauncher.js'
import type { MpiLauncherSettings } from '../../src/lib/types/settingsTypes.js'

const LOCAL_RUNS_KEY = 'localRuns'

export interface LocalRun {
  jobId: string
  state: 'RUNNING' | 'COMPLETED' | 'FAILED'
  start: string
  end: string
  logPath: string
  touchDir: string
}

interface CoralRunPayload {
  coralBinaryPath: string
  coralPluginPath: string
  /** Per-run directory for graph, log, and node-status files; Coral runs in it. */
  runDirectory: string
  graphPayload: unknown
  internalJobId: number | string
  mpi?: { launcher: MpiLauncherSettings; processes: number }
}

interface ExecutableRunPayload {
  executablePath: string
  /** Per-run directory for parameters and logs; the executable runs in it. */
  runDirectory: string
  parametersPayload: ParameterTree
  parametersFileName: string
  internalJobId: number | string
  mpi?: { launcher: MpiLauncherSettings; processes: number }
}

const localRuns = new Map<string, LocalRun>()

const loadLocalRuns = () => {
  const storedRuns = store.get(LOCAL_RUNS_KEY, []) as LocalRun[]
  if (!Array.isArray(storedRuns)) return
  for (const run of storedRuns) {
    if (run?.jobId != null) {
      localRuns.set(String(run.jobId), run)
    }
  }
}
loadLocalRuns()

const persistLocalRuns = () => {
  store.set(LOCAL_RUNS_KEY, Array.from(localRuns.values()))
}

const updateRun = (jobId: string, patch: Partial<LocalRun>) => {
  const current = localRuns.get(String(jobId))
  if (!current) return
  localRuns.set(String(jobId), { ...current, ...patch })
  persistLocalRuns()
}

const ensureDir = async (dirPath: string) => {
  await fs.promises.mkdir(dirPath, { recursive: true })
}

const dirExists = async (dirPath: string): Promise<boolean> => {
  try {
    return (await fs.promises.stat(dirPath)).isDirectory()
  } catch {
    return false
  }
}

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    return (await fs.promises.stat(filePath)).isFile()
  } catch {
    return false
  }
}

/**
 * Returns the subset of the given paths that are existing regular files.
 * @param filePaths - Absolute local paths to check.
 * @returns The paths that exist and are files, in input order.
 */
export const findExistingLocalFiles = async (
  filePaths: string[]
): Promise<string[]> => {
  const exists = await Promise.all(filePaths.map(fileExists))
  return filePaths.filter((_, index) => exists[index])
}

/**
 * Creates a local directory for exclusive use by a run: if the exact path
 * already exists (a slug was reused), retries with a timestamp-suffixed
 * variant instead of reusing/overwriting it, rather than blocking submission.
 * Mirrors the remote equivalent in sshMessages.ts (`ensureUniqueRemoteDir`).
 * @param dirPath - Preferred local directory path.
 * @returns The local directory path actually created (`dirPath` unless a collision occurred).
 * @throws {Error} If a free directory cannot be allocated after a few attempts.
 */
export const ensureUniqueLocalDir = async (
  dirPath: string
): Promise<string> => {
  let candidate = dirPath
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!(await dirExists(candidate))) {
      await ensureDir(candidate)
      return candidate
    }
    candidate = `${dirPath}-${Date.now()}`
  }
  throw new Error(`Could not allocate a unique directory under ${dirPath}`)
}

/**
 * @param payload - Coral run configuration.
 * @returns The internal job ID and per-run directory used for run artifacts.
 */
export const startLocalCoralRun = async ({
  coralBinaryPath,
  coralPluginPath,
  runDirectory,
  graphPayload,
  internalJobId,
  mpi,
}: CoralRunPayload): Promise<{ jobId: string; runDirectory: string }> => {
  const jobId = String(internalJobId)
  const graphPath = path.join(runDirectory, `graph-${jobId}.json`)
  const logPath = path.join(runDirectory, `local-${jobId}.out`)
  const touchDir = path.join(
    runDirectory,
    'nodes-exec-status',
    String(internalJobId)
  )

  await ensureDir(runDirectory)
  await ensureDir(path.dirname(touchDir))
  await ensureDir(touchDir)

  await fs.promises.writeFile(graphPath, JSON.stringify(graphPayload))

  const executableArgs = [
    '-p',
    coralPluginPath,
    'run',
    graphPath,
    '--touch-dir',
    touchDir,
  ]
  const invocation = mpi
    ? buildLocalMpiArgs(
        mpi.launcher,
        mpi.processes,
        coralBinaryPath,
        executableArgs
      )
    : { command: coralBinaryPath, args: executableArgs }

  const stdoutStream = fs.createWriteStream(logPath, { flags: 'a' })
  const child = spawn(invocation.command, invocation.args, {
    cwd: runDirectory,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout!.pipe(stdoutStream)
  child.stderr!.pipe(stdoutStream)

  localRuns.set(jobId, {
    jobId,
    state: 'RUNNING',
    start: new Date().toISOString(), // full UTC ISO-8601, Z suffix preserved for frontend timezone conversion
    end: '',
    logPath,
    touchDir,
  })
  persistLocalRuns()

  child.on('error', (error) => {
    stdoutStream.write(`\nProcess error: ${error.message}\n`)
    stdoutStream.end()
    updateRun(jobId, { state: 'FAILED', end: new Date().toISOString() })
  })

  child.on('close', (code) => {
    stdoutStream.end()
    updateRun(jobId, {
      state: code === 0 ? 'COMPLETED' : 'FAILED',
      end: new Date().toISOString(),
    })
  })

  return { jobId, runDirectory }
}

/**
 * @param payload - Executable run configuration.
 * @returns The internal job ID and per-run directory used for run artifacts.
 */
export const startLocalExecutableRun = async ({
  executablePath,
  runDirectory,
  parametersPayload,
  parametersFileName,
  internalJobId,
  mpi,
}: ExecutableRunPayload): Promise<{
  jobId: string
  runDirectory: string
}> => {
  const jobId = String(internalJobId)
  // runDirectory is already unique per run (allocated by the caller via
  // ensureUniqueLocalDir), so back-to-back runs never share a parameters.json.
  const parametersName = parametersFileName || 'parameters.json'
  const parametersPath = path.join(runDirectory, parametersName)
  const logPath = path.join(runDirectory, 'local.out')

  await ensureDir(path.dirname(parametersPath))
  const parametersContent = serializeParametersFile(
    parametersPayload,
    parametersFileName
  )
  await fs.promises.writeFile(parametersPath, parametersContent)

  // Bare filename relative to cwd, not a path: some deal.II programs (e.g.
  // step-70) read their dimension from the params path, so the run directory
  // must stay out of argv. Matches the remote batch script.
  const stdoutStream = fs.createWriteStream(logPath, { flags: 'a' })
  const invocation = mpi
    ? buildLocalMpiArgs(mpi.launcher, mpi.processes, executablePath, [
        parametersName,
      ])
    : { command: executablePath, args: [parametersName] }
  const child = spawn(invocation.command, invocation.args, {
    cwd: runDirectory,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout!.pipe(stdoutStream)
  child.stderr!.pipe(stdoutStream)

  localRuns.set(jobId, {
    jobId,
    state: 'RUNNING',
    start: new Date().toISOString(), // full UTC ISO-8601, Z suffix preserved for frontend timezone conversion
    end: '',
    logPath,
    touchDir: '',
  })
  persistLocalRuns()

  child.on('error', (error) => {
    stdoutStream.write(`\nProcess error: ${error.message}\n`)
    stdoutStream.end()
    updateRun(jobId, { state: 'FAILED', end: new Date().toISOString() })
  })

  child.on('close', (code) => {
    stdoutStream.end()
    updateRun(jobId, {
      state: code === 0 ? 'COMPLETED' : 'FAILED',
      end: new Date().toISOString(),
    })
  })

  return { jobId, runDirectory }
}

/**
 * @param numDays - Only include runs started within this many days.
 * @returns Table rows: first row is headers, rest are data.
 */
export const listLocalRuns = (numDays: number): string[][] => {
  const minTime = Date.now() - numDays * 24 * 60 * 60 * 1000
  const headers = ['JobID', 'State', 'Start', 'End']
  const rows = Array.from(localRuns.values())
    .filter((run) => Date.parse(run.start) >= minTime)
    .sort((a, b) => Date.parse(b.start) - Date.parse(a.start))
    .map((run) => [run.jobId, run.state, run.start, run.end])

  return [headers, ...rows]
}

/**
 * @param jobId
 * @returns State string, or empty string if not found.
 */
export const getLocalRunState = (jobId: string | number): string => {
  return localRuns.get(String(jobId))?.state ?? ''
}

/**
 * @param jobId
 * @returns Full log file contents.
 * @throws {Error} If the job has no log path.
 */
export const getLocalRunLog = async (
  jobId: string | number
): Promise<string> => {
  const run = localRuns.get(String(jobId))
  if (!run?.logPath) {
    throw new Error(`No local log available for job ${jobId}`)
  }
  return await fs.promises.readFile(run.logPath, 'utf8')
}

/**
 * @param jobIdInternal
 * @returns Newline-separated list of status filenames sorted by mtime, or empty string.
 */
export const getLocalNodeStatusFiles = async (
  jobIdInternal: string | number
): Promise<string> => {
  const run = localRuns.get(String(jobIdInternal))
  const touchDir = run?.touchDir
  if (!touchDir) return ''

  const entries = await fs.promises.readdir(touchDir)
  const withTimes = await Promise.all(
    entries.map(async (entry) => {
      const stat = await fs.promises.stat(path.join(touchDir, entry))
      return { entry, mtimeMs: stat.mtimeMs }
    })
  )

  return withTimes
    .sort((a, b) => a.mtimeMs - b.mtimeMs)
    .map(({ entry }) => entry)
    .join('\n')
}
