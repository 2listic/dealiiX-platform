import { execFile } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { open, readFile, realpath, rename, rm, stat } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import {
  BrowserWindow,
  dialog,
  ipcMain,
  type OpenDialogOptions,
} from 'electron/main'
import Ajv2020 from 'ajv/dist/2020.js'
import {
  executionVersion,
  type ExecutionReply,
  type ExecutionRequest,
  type RegistryDocument,
} from '../../src/lib/types/executionService.js'
import type { ParameterTree } from '../../src/lib/types/parameterTypes.js'
import type {
  BackendSettingsDocument,
  SettingsDraft,
  SettingsTarget,
} from '../../src/lib/types/settingsFile.js'
import { pickSettingsFile } from './settingsFiles.js'

const terminal = new Set(['succeeded', 'failed', 'cancelled'])
const mutations = new Set([
  'configure',
  'submit',
  'cancel',
  'pause',
  'resume',
  'replay',
])

export type BackendLaunch = { command: string[]; configuration: string }

type BackendSession = {
  launch: BackendLaunch
  operations: NonNullable<RegistryDocument['__backend']['operations']>
  revision?: string
  identity?: SettingsTarget
  watched: Set<string>
}

const newSession = (launch: BackendLaunch): BackendSession => ({
  launch,
  operations: [],
  watched: new Set(),
})

const acceptRegistry = (
  session: BackendSession,
  registry: RegistryDocument
): BackendSession => {
  const { id, configuration_digest, operations } = registry.__backend
  const revision = `${id}:${configuration_digest}`
  const next =
    session.revision && session.revision !== revision
      ? newSession(session.launch)
      : session
  next.revision = revision
  next.identity = registry.__backend
  next.operations = operations ?? []
  return next
}

const profileRevision = (path: string, text: string): string =>
  createHash('sha256').update(path).update('\0').update(text).digest('hex')

function requireSettingsTarget(target: SettingsTarget, active: SettingsTarget) {
  const qualified = ({ id, plugin }: SettingsTarget) =>
    plugin ? `${id}/${plugin}` : id
  if (target.id !== active.id || target.plugin !== active.plugin)
    throw new Error(
      `Settings target ${qualified(target)}. The active backend is ${qualified(active)}.`
    )
  if (target.version !== undefined && target.version !== active.version)
    throw new Error(`Settings require backend version ${target.version}.`)
  for (const plugin of target.plugins ?? []) {
    if (
      !active.plugins?.some(
        ({ id, version }) =>
          id === plugin.id &&
          (plugin.version === undefined || version === plugin.version)
      )
    )
      throw new Error(`Settings require backend plugin ${plugin.id}.`)
  }
}

type BackendControl = {
  importSettings(document: unknown): SettingsDraft
  switchBackend(
    backend: BackendLaunch | undefined,
    persist: () => void
  ): Promise<RegistryDocument | null>
}

/**
 * Registers the JSON bridge for the root workflow backend.
 * @param appPath - Application root containing the protocol schemas.
 * @param startup - Root command and configuration selected at startup.
 * @returns The control for validating and switching the active backend.
 * @throws If the bundled schemas are invalid.
 */
export function registerWorkflowService(
  appPath: string,
  startup?: BackendLaunch
): BackendControl {
  let active = startup && newSession(startup)
  let switching = false
  let pendingMutations = 0
  ipcMain.handle('workflow:enabled', () => Boolean(active))

  const ajv = new Ajv2020({ strictTypes: false })
  const schemaDirectory = join(appPath, 'schemas')
  let serviceId: string | undefined
  let parametersId: string | undefined
  let backendSettingsId: string | undefined
  for (const file of readdirSync(schemaDirectory)) {
    if (!file.endsWith('.schema.json')) continue
    const schema = JSON.parse(readFileSync(join(schemaDirectory, file), 'utf8'))
    ajv.addSchema(schema)
    if (file === 'execution-service.schema.json') serviceId = schema.$id
    if (file === 'parameters.schema.json') parametersId = schema.$id
    if (file === 'backend-settings.schema.json') backendSettingsId = schema.$id
  }
  if (!serviceId || !parametersId || !backendSettingsId)
    throw new Error('Missing workflow or settings schemas')
  const requestSchema = ajv.getSchema<ExecutionRequest>(
    `${serviceId}#/$defs/request`
  )
  const responseSchema = ajv.getSchema<ExecutionReply>(
    `${serviceId}#/$defs/response`
  )
  const parametersSchema = ajv.getSchema<ParameterTree>(parametersId)
  const backendSettingsSchema =
    ajv.getSchema<BackendSettingsDocument>(backendSettingsId)
  if (
    !requestSchema ||
    !responseSchema ||
    !parametersSchema ||
    !backendSettingsSchema
  )
    throw new Error('Missing workflow or settings schemas')

  const isBackendSettings = (
    document: unknown
  ): document is BackendSettingsDocument =>
    backendSettingsSchema(document) === true
  const isParameters = (document: unknown): document is ParameterTree =>
    parametersSchema(document) === true

  const parseProfile = (document: unknown) => {
    if (isBackendSettings(document)) return document
    if (isParameters(document)) return { configuration: document }
    throw new Error('This backend profile is not a valid settings document')
  }

  const checkImportTarget = (session: BackendSession, target: unknown) => {
    if (target === undefined) return
    const header = { backend: target, configuration: {} }
    if (!isBackendSettings(header))
      throw new Error('Invalid backend settings identity.')
    if (!session.identity)
      throw new Error('Wait for the active backend registry to load.')
    requireSettingsTarget(header.backend, session.identity)
  }

  const importSettings = (document: unknown): SettingsDraft => {
    if (!isBackendSettings(document))
      throw new Error(
        'Choose frontend settings or a backend settings file with a valid identity and configuration.'
      )
    if (!active)
      throw new Error('Wait for the active backend registry to load.')
    checkImportTarget(active, document.backend)
    return { parameters: document.configuration, target: document.backend }
  }

  ipcMain.handle('workflow:import-configuration', async (event) => {
    const session = active
    if (!session?.identity)
      throw new Error('Wait for the active backend registry to load.')
    const selected = await pickSettingsFile(
      event,
      'Import backend settings',
      dirname(session.launch.configuration)
    )
    if (!selected) return null
    if (session !== active)
      throw new Error('The active backend has changed. Reopen Settings.')
    return importSettings(selected.document)
  })

  ipcMain.handle('workflow:open', async (event): Promise<string | null> => {
    const session = active
    if (!session) throw new Error('No workflow backend is configured')
    const options: OpenDialogOptions = {
      title: 'Open workflow',
      defaultPath: dirname(session.launch.configuration),
      properties: ['openFile'],
      filters: [{ name: 'Workflow JSON', extensions: ['json'] }],
    }
    const parent = BrowserWindow.fromWebContents(event.sender)
    const { canceled, filePaths } = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options)
    if (session !== active) return null
    return canceled || !filePaths[0] ? null : readFile(filePaths[0], 'utf8')
  })

  const call = async (
    { command, configuration }: BackendLaunch,
    request: ExecutionRequest
  ): Promise<ExecutionReply> => {
    const stdout = await new Promise<string>((resolve, reject) => {
      const child = execFile(
        command[0],
        [...command.slice(1), '--configuration', configuration, 'exchange'],
        { timeout: 180_000, maxBuffer: 16 * 1024 * 1024 },
        (error, stdout) => {
          if (error) reject(error)
          else resolve(stdout)
        }
      )
      child.stdin?.on('error', reject)
      child.stdin?.end(JSON.stringify(request))
    })
    const document: unknown = JSON.parse(stdout)
    if (!responseSchema(document)) {
      throw new Error('The backend returned an invalid execution response')
    }
    const response = document as ExecutionReply
    if ('result' in response && response.operation !== request.operation) {
      throw new Error('The backend replied to a different operation')
    }
    return response
  }

  const describe = async (launch: BackendLaunch): Promise<RegistryDocument> => {
    const reply = await call(launch, {
      version: executionVersion,
      operation: 'describe',
    })
    if ('error' in reply)
      throw new Error(`${reply.error.code}: ${reply.error.message}`)
    if (reply.operation !== 'describe')
      throw new Error('Expected the backend registry')
    return reply.result
  }

  ipcMain.handle('workflow:read-configuration', async () => {
    const session = active
    if (!session) throw new Error('No workflow backend is configured')
    if (session.operations.includes('configure'))
      throw new Error('The backend manages configuration through the protocol')
    const path = await realpath(session.launch.configuration)
    const text = await readFile(path, 'utf8')
    if (session !== active) throw new Error('The active backend has changed')
    const profile = parseProfile(JSON.parse(text))
    if ('backend' in profile && session.identity)
      requireSettingsTarget(profile.backend, session.identity)
    return {
      parameters: profile.configuration,
      revision: profileRevision(path, text),
    }
  })

  ipcMain.handle(
    'workflow:save-configuration',
    async (_event, parameters: unknown, revision: unknown, target: unknown) => {
      const session = active
      if (!session) throw new Error('No workflow backend is configured')
      if (session.operations.includes('configure'))
        throw new Error(
          'The backend manages configuration through the protocol'
        )
      if (switching || pendingMutations)
        throw new Error('Wait for the current backend operation to finish')
      if (typeof revision !== 'string' || !parametersSchema(parameters))
        throw new Error('Invalid backend profile parameters')
      checkImportTarget(session, target)
      switching = true
      try {
        const path = await realpath(session.launch.configuration)
        const requireRevision = async () => {
          const currentPath = await realpath(session.launch.configuration)
          const text = await readFile(currentPath, 'utf8')
          if (profileRevision(currentPath, text) !== revision)
            throw new Error(
              'The backend profile changed on disk. Open Settings again.'
            )
          return text
        }
        const previous = parseProfile(JSON.parse(await requireRevision()))
        if ('backend' in previous && session.identity)
          requireSettingsTarget(previous.backend, session.identity)
        const document =
          'backend' in previous
            ? { backend: previous.backend, configuration: parameters }
            : parameters
        const candidate = join(
          dirname(path),
          `.${basename(path)}-${randomUUID()}.json`
        )
        const mode = (await stat(path)).mode & 0o777
        const file = await open(candidate, 'wx', mode)
        try {
          try {
            await file.writeFile(`${JSON.stringify(document, null, 2)}\n`)
          } finally {
            await file.close()
          }
          const registry = await describe({
            ...session.launch,
            configuration: candidate,
          })
          if ('backend' in previous)
            requireSettingsTarget(previous.backend, registry.__backend)
          await requireRevision()
          await rename(candidate, path)
          active = acceptRegistry(session, registry)
          return registry
        } finally {
          await rm(candidate, { force: true })
        }
      } finally {
        switching = false
      }
    }
  )

  const watch = (session: BackendSession, run_id: string) => {
    const { watched } = session
    if (!session.operations.includes('status') || watched.has(run_id)) return
    watched.add(run_id)
    const tick = async () => {
      if (session !== active || !session.operations.includes('status')) {
        watched.delete(run_id)
        return
      }
      try {
        const response = await call(session.launch, {
          version: executionVersion,
          operation: 'status',
          run_id,
        })
        if (session !== active) return
        for (const window of BrowserWindow.getAllWindows()) {
          window.webContents.send('workflow:status', response)
        }
        if (
          'error' in response ||
          (response.operation === 'status' &&
            terminal.has(response.result.state))
        ) {
          watched.delete(run_id)
          return
        }
      } catch {
        // A temporary transport failure leaves the run active on the backend.
      }
      if (session === active) setTimeout(() => void tick(), 750).unref()
    }
    setTimeout(() => void tick(), 250).unref()
  }

  ipcMain.handle(
    'workflow:exchange',
    async (
      _event,
      document: unknown,
      target: unknown
    ): Promise<ExecutionReply> => {
      if (!requestSchema(document)) {
        return {
          version: executionVersion,
          error: {
            code: 'invalid_request',
            message: ajv.errorsText(requestSchema.errors),
          },
        }
      }
      const request = document as ExecutionRequest
      const errorReply = (code: string, message: string): ExecutionReply => ({
        version: executionVersion,
        operation: request.operation,
        error: { code, message },
      })
      const session = active
      if (!session)
        return errorReply(
          'backend_unavailable',
          'No workflow backend is configured'
        )
      if (request.operation === 'configure') {
        try {
          checkImportTarget(session, target)
        } catch (error) {
          return errorReply(
            'incompatible_backend',
            error instanceof Error ? error.message : String(error)
          )
        }
      }
      const mutation = mutations.has(request.operation)
      if (switching && mutation)
        return errorReply('backend_busy', 'Settings are updating the backend')
      if (mutation) pendingMutations++
      try {
        const response = await call(session.launch, request)
        if (session !== active)
          return errorReply('backend_changed', 'The active backend has changed')
        if (
          'result' in response &&
          (response.operation === 'describe' ||
            response.operation === 'configure')
        )
          active = acceptRegistry(session, response.result)
        if (
          'result' in response &&
          (response.operation === 'submit' ||
            response.operation === 'replay' ||
            response.operation === 'pause' ||
            response.operation === 'resume' ||
            response.operation === 'status') &&
          !terminal.has(response.result.state)
        ) {
          watch(session, response.result.run_id)
        }
        return response
      } catch (error) {
        return errorReply('backend_unavailable', String(error))
      } finally {
        if (mutation) pendingMutations--
      }
    }
  )
  return {
    importSettings,
    async switchBackend(backend, persist) {
      if (switching || pendingMutations)
        throw new Error('Wait for the current backend operation to finish')
      switching = true
      try {
        const unchanged =
          backend &&
          active?.launch.configuration === backend.configuration &&
          active.launch.command.length === backend.command.length &&
          active.launch.command.every(
            (argument, index) => argument === backend.command[index]
          )
        const candidate = backend
          ? unchanged
            ? active
            : newSession(backend)
          : undefined
        const registry = candidate ? await describe(candidate.launch) : null
        persist()
        active =
          candidate && registry
            ? acceptRegistry(candidate, registry)
            : undefined
        return registry
      } finally {
        switching = false
      }
    },
  }
}
