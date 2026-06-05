import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import store from './storage.js'
import { serializeParametersFile } from '../../src/lib/utils/parameterFileFormat.js'
import type { ParameterTree } from '../../src/lib/types/parameterTypes.js'

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
  workingDirectory: string
  graphPayload: unknown
  internalJobId: number | string
}

interface ExecutableRunPayload {
  executablePath: string
  workingDirectory: string
  parametersPayload: ParameterTree
  parametersFileName: string
  internalJobId: number | string
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

/**
 * @param payload - Coral run configuration.
 * @returns The internal job ID of the spawned process.
 */
export const startLocalCoralRun = async ({
  coralBinaryPath,
  coralPluginPath,
  workingDirectory,
  graphPayload,
  internalJobId,
}: CoralRunPayload): Promise<{ jobId: string }> => {
  const jobId = String(internalJobId)
  const graphPath = path.join(workingDirectory, `graph-${jobId}.json`)
  const logPath = path.join(workingDirectory, `local-${jobId}.out`)
  const touchDir = path.join(
    workingDirectory,
    'nodes-exec-status',
    String(internalJobId)
  )

  await ensureDir(workingDirectory)
  await ensureDir(path.dirname(touchDir))
  await ensureDir(touchDir)

  await fs.promises.writeFile(graphPath, JSON.stringify(graphPayload))

  const args = [
    '-p',
    coralPluginPath,
    'run',
    graphPath,
    '--touch-dir',
    touchDir,
  ]

  const stdoutStream = fs.createWriteStream(logPath, { flags: 'a' })
  const child = spawn(coralBinaryPath, args, {
    cwd: workingDirectory,
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

  return { jobId }
}

/**
 * @param payload - Executable run configuration.
 * @returns The internal job ID of the spawned process.
 */
export const startLocalExecutableRun = async ({
  executablePath,
  workingDirectory,
  parametersPayload,
  parametersFileName,
  internalJobId,
}: ExecutableRunPayload): Promise<{ jobId: string }> => {
  const jobId = String(internalJobId)
  const parametersPath = path.join(
    workingDirectory,
    parametersFileName || `template_parameters-${jobId}.json`
  )
  const logPath = path.join(workingDirectory, `local-${jobId}.out`)

  await ensureDir(workingDirectory)
  const parametersContent = serializeParametersFile(
    parametersPayload,
    parametersFileName
  )
  await fs.promises.writeFile(parametersPath, parametersContent)

  const stdoutStream = fs.createWriteStream(logPath, { flags: 'a' })
  const child = spawn(executablePath, [parametersPath], {
    cwd: workingDirectory,
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

  return { jobId }
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
