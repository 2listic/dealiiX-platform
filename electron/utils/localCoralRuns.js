import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import store from './storage.js'

const LOCAL_RUNS_KEY = 'localRuns'

/** @type {Map<string, any>} */
const localRuns = new Map()

const loadLocalRuns = () => {
  const storedRuns = store.get(LOCAL_RUNS_KEY, [])
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

const updateRun = (jobId, patch) => {
  const current = localRuns.get(String(jobId))
  if (!current) return
  localRuns.set(String(jobId), { ...current, ...patch })
  persistLocalRuns()
}

const ensureDir = async (dirPath) => {
  await fs.promises.mkdir(dirPath, { recursive: true })
}

export const startLocalCoralRun = async ({
  coralBinaryPath,
  coralPluginPath,
  workingDirectory,
  graphPayload,
  parametersPayload,
  internalJobId,
  uploadGraph,
  uploadParameters,
}) => {
  const jobId = String(internalJobId)
  const graphPath = path.join(workingDirectory, `graph-${jobId}.json`)
  const parametersPath = path.join(
    workingDirectory,
    `template_parameters-${jobId}.json`
  )
  const logPath = path.join(workingDirectory, `local-${jobId}.out`)
  const touchDir = path.join(
    workingDirectory,
    'nodes-exec-status',
    String(internalJobId)
  )

  await ensureDir(workingDirectory)
  await ensureDir(path.dirname(touchDir))
  await ensureDir(touchDir)

  if (uploadGraph) {
    await fs.promises.writeFile(graphPath, JSON.stringify(graphPayload))
  }
  if (uploadParameters && parametersPayload) {
    await fs.promises.writeFile(
      parametersPath,
      JSON.stringify(parametersPayload, null, 2)
    )
  }

  const args = ['-p', coralPluginPath, 'run']
  if (uploadGraph) {
    args.push(graphPath)
  }
  if (uploadParameters && parametersPayload) {
    args.push('-input-parameters', parametersPath)
  }
  args.push('--touch-dir', touchDir)

  const stdoutStream = fs.createWriteStream(logPath, { flags: 'a' })
  const child = spawn(coralBinaryPath, args, {
    cwd: workingDirectory,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout.pipe(stdoutStream)
  child.stderr.pipe(stdoutStream)

  localRuns.set(jobId, {
    jobId,
    state: 'RUNNING',
    start: new Date().toISOString(),
    end: '',
    logPath,
    touchDir,
  })
  persistLocalRuns()

  child.on('error', (error) => {
    stdoutStream.write(`\nProcess error: ${error.message}\n`)
    stdoutStream.end()
    updateRun(jobId, {
      state: 'FAILED',
      end: new Date().toISOString(),
    })
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

export const startLocalExecutableRun = async ({
  executablePath,
  workingDirectory,
  parametersPayload,
  parametersFileName,
  internalJobId,
}) => {
  const jobId = String(internalJobId)
  const parametersPath = path.join(
    workingDirectory,
    parametersFileName || `template_parameters-${jobId}.json`
  )
  const logPath = path.join(workingDirectory, `local-${jobId}.out`)

  await ensureDir(workingDirectory)
  await fs.promises.writeFile(
    parametersPath,
    JSON.stringify(parametersPayload, null, 2)
  )

  const stdoutStream = fs.createWriteStream(logPath, { flags: 'a' })
  const child = spawn(executablePath, [parametersPath], {
    cwd: workingDirectory,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  child.stdout.pipe(stdoutStream)
  child.stderr.pipe(stdoutStream)

  localRuns.set(jobId, {
    jobId,
    state: 'RUNNING',
    start: new Date().toISOString(),
    end: '',
    logPath,
    touchDir: '',
  })
  persistLocalRuns()

  child.on('error', (error) => {
    stdoutStream.write(`\nProcess error: ${error.message}\n`)
    stdoutStream.end()
    updateRun(jobId, {
      state: 'FAILED',
      end: new Date().toISOString(),
    })
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

export const listLocalRuns = (numDays) => {
  const minTime = Date.now() - numDays * 24 * 60 * 60 * 1000
  const headers = ['JobID', 'State', 'Start', 'End']
  const rows = Array.from(localRuns.values())
    .filter((run) => Date.parse(run.start) >= minTime)
    .sort((a, b) => Date.parse(b.start) - Date.parse(a.start))
    .map((run) => [run.jobId, run.state, run.start, run.end])

  return [headers, ...rows]
}

export const getLocalRunState = (jobId) => {
  return localRuns.get(String(jobId))?.state ?? ''
}

export const getLocalRunLog = async (jobId) => {
  const run = localRuns.get(String(jobId))
  if (!run?.logPath) {
    throw new Error(`No local log available for job ${jobId}`)
  }
  return await fs.promises.readFile(run.logPath, 'utf8')
}

export const getLocalNodeStatusFiles = async (jobIdInternal) => {
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
