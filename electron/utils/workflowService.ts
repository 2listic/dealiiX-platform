import { execFile } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, isAbsolute, join } from 'node:path'
import {
  BrowserWindow,
  dialog,
  ipcMain,
  type OpenDialogOptions,
} from 'electron/main'
import { shell } from 'electron'
import Ajv2020 from 'ajv/dist/2020.js'
import {
  executionVersion,
  type ExecutionReply,
  type ExecutionRequest,
} from '../../src/lib/types/executionService.js'

const terminal = new Set(['succeeded', 'failed', 'cancelled'])

/**
 * Registers the JSON bridge for the configured workflow backend.
 * @param appPath - Application root containing the protocol schemas.
 * @returns Whether a workflow backend is configured.
 * @throws If the configured command, paths or bundled schemas are invalid.
 */
export function registerWorkflowService(appPath: string): boolean {
  const spec = process.env.DEALIIX_BACKEND_COMMAND
  const configuration = process.env.DEALIIX_CONFIGURATION
  ipcMain.handle('workflow:enabled', () => Boolean(spec && configuration))
  if (!spec || !configuration) return false
  const command: unknown = JSON.parse(spec)
  if (
    !Array.isArray(command) ||
    command.length === 0 ||
    !command.every((argument) => typeof argument === 'string') ||
    !isAbsolute(command[0]) ||
    !isAbsolute(configuration)
  ) {
    throw new Error('Set an absolute backend command and configuration path')
  }

  const ajv = new Ajv2020({ strictTypes: false })
  const schemaDirectory = join(appPath, 'schemas')
  let serviceId: string | undefined
  for (const file of readdirSync(schemaDirectory)) {
    if (!file.endsWith('.schema.json')) continue
    const schema = JSON.parse(readFileSync(join(schemaDirectory, file), 'utf8'))
    ajv.addSchema(schema)
    if (file === 'execution-service.schema.json') serviceId = schema.$id
  }
  const requestSchema = ajv.getSchema<ExecutionRequest>(
    `${serviceId}#/$defs/request`
  )
  const responseSchema = ajv.getSchema<ExecutionReply>(
    `${serviceId}#/$defs/response`
  )
  if (!requestSchema || !responseSchema)
    throw new Error('Missing execution service schemas')

  ipcMain.handle('workflow:open-configuration', async () => {
    const error = await shell.openPath(configuration)
    if (error) throw new Error(error)
  })

  ipcMain.handle('workflow:open', async (event): Promise<string | null> => {
    const options: OpenDialogOptions = {
      title: 'Open workflow',
      defaultPath: dirname(configuration),
      properties: ['openFile'],
      filters: [{ name: 'Workflow JSON', extensions: ['json'] }],
    }
    const parent = BrowserWindow.fromWebContents(event.sender)
    const { canceled, filePaths } = parent
      ? await dialog.showOpenDialog(parent, options)
      : await dialog.showOpenDialog(options)
    return canceled || !filePaths[0] ? null : readFile(filePaths[0], 'utf8')
  })

  const call = async (request: ExecutionRequest): Promise<ExecutionReply> => {
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

  let operations: string[] = []
  const watched = new Set<string>()
  const watch = (run_id: string) => {
    if (!operations.includes('status') || watched.has(run_id)) return
    watched.add(run_id)
    const tick = async () => {
      if (!operations.includes('status')) {
        watched.delete(run_id)
        return
      }
      try {
        const response = await call({
          version: executionVersion,
          operation: 'status',
          run_id,
        })
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
      setTimeout(() => void tick(), 750).unref()
    }
    setTimeout(() => void tick(), 250).unref()
  }

  ipcMain.handle(
    'workflow:exchange',
    async (_event, document: unknown): Promise<ExecutionReply> => {
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
      try {
        const response = await call(request)
        if (
          'result' in response &&
          (response.operation === 'describe' ||
            response.operation === 'configure')
        )
          operations = response.result.__backend.operations ?? []
        if (
          'result' in response &&
          (response.operation === 'submit' ||
            response.operation === 'replay' ||
            response.operation === 'status') &&
          !terminal.has(response.result.state)
        ) {
          watch(response.result.run_id)
        }
        return response
      } catch (error) {
        return {
          version: executionVersion,
          operation: request.operation,
          error: { code: 'backend_unavailable', message: String(error) },
        }
      }
    }
  )
  return true
}
