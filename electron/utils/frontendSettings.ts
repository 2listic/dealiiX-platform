import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { app, ipcMain, nativeTheme } from 'electron/main'
import Ajv2020 from 'ajv/dist/2020.js'
import type {
  FrontendPreferences,
  FrontendSettingsSnapshot,
  FrontendSettingsSave,
} from '../../src/lib/types/frontendSettings.js'
import type { ParameterLeaf } from '../../src/lib/types/parameterTypes.js'
import store from './storage.js'
import { pickSettingsFile } from './settingsFiles.js'
import {
  registerWorkflowService,
  type BackendLaunch,
} from './workflowService.js'

const leaf = (
  value: string,
  documentation: string,
  pattern = '[Anything]'
): ParameterLeaf => ({
  value,
  default_value: value,
  documentation,
  pattern,
  pattern_description: pattern,
})

function backendLaunch(
  commandValue: string,
  configuration: string
): BackendLaunch | undefined {
  if (!commandValue && !configuration) return
  let command: unknown
  try {
    command = JSON.parse(commandValue)
  } catch {
    throw new Error(
      'Backend command must be a JSON array of executable and arguments.'
    )
  }
  if (
    !Array.isArray(command) ||
    !command.length ||
    !command.every(
      (argument) => typeof argument === 'string' && !argument.includes('\0')
    ) ||
    !isAbsolute(command[0])
  ) {
    throw new Error(
      'Backend command must start with an absolute executable path.'
    )
  }
  if (!isAbsolute(configuration) || configuration.includes('\0')) {
    throw new Error('Backend configuration must be an absolute file path.')
  }
  return { command, configuration }
}

/** Loads the private desktop preferences before the root backend and window start. */
export function registerFrontendSettings(appPath: string): void {
  const path = join(app.getPath('userData'), 'frontend.config.json')
  const preset = store.get('settings')
  const previousTheme = store.get('colorMode')
  const defaults: FrontendPreferences = {
    'Backend command': leaf(
      process.env.DEALIIX_BACKEND_COMMAND ?? '',
      'JSON array of executable and arguments. The first entry must be an absolute path.'
    ),
    'Backend configuration file': leaf(
      process.env.DEALIIX_CONFIGURATION ?? '',
      'Absolute path to the profile passed to the root backend.'
    ),
    Theme: {
      ...leaf(
        'auto',
        'Follow the system appearance with auto.',
        '[Selection auto|light|dark ]'
      ),
      value:
        previousTheme === 'light' || previousTheme === 'dark'
          ? previousTheme
          : 'auto',
    },
    'VTK visualizer URL': leaf(
      preset?.urlVisualizer ?? '',
      'HTTP(S) endpoint for the VTK visualizer.'
    ),
    'Project server URL': leaf(
      preset?.urlRemoteServer ?? '',
      'HTTP(S) endpoint for login and shared projects.'
    ),
  }
  const ajv = new Ajv2020({ strictTypes: false })
  const schema = (name: string) =>
    JSON.parse(readFileSync(join(appPath, 'schemas', name), 'utf8'))
  ajv.addSchema(schema('parameters.schema.json'))
  const valid = ajv.compile<FrontendPreferences>(
    schema('desktop/frontend-settings.schema.json')
  )
  const validate = (document: unknown) => {
    if (!valid(document))
      throw new Error(
        `Invalid frontend settings: ${ajv.errorsText(valid.errors)}`
      )
    for (const name of ['VTK visualizer URL', 'Project server URL'] as const) {
      const { value } = document[name]
      if (!value) continue
      if (
        !URL.canParse(value) ||
        !['http:', 'https:'].includes(new URL(value).protocol)
      ) {
        throw new Error(`${name} must be an HTTP(S) URL.`)
      }
    }
    return backendLaunch(
      document['Backend command'].value,
      document['Backend configuration file'].value
    )
  }

  let preferences = defaults
  let active: BackendLaunch | undefined
  let warning: string | undefined
  try {
    const supplied: unknown = JSON.parse(readFileSync(path, 'utf8'))
    active = validate(supplied)
    preferences = supplied as FrontendPreferences
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
      warning = `Could not load frontend.config.json: ${error instanceof Error ? error.message : String(error)}`
    try {
      active = validate(defaults)
    } catch (error) {
      warning ??= error instanceof Error ? error.message : String(error)
    }
  }
  const service = registerWorkflowService(appPath, active)
  const applyTheme = () => {
    const theme = preferences.Theme.value
    nativeTheme.themeSource = theme === 'auto' ? 'system' : theme
  }
  applyTheme()
  const snapshot = (): FrontendSettingsSnapshot => ({
    configuration: preferences,
    warning,
  })
  const save = async (document: unknown): Promise<FrontendSettingsSave> => {
    const launch = validate(document)
    const backendChanged = JSON.stringify(launch) !== JSON.stringify(active)
    const registry = await service.switchBackend(launch, () => {
      const temporary = `${path}.${randomUUID()}.tmp`
      try {
        writeFileSync(temporary, JSON.stringify(document, null, 2) + '\n', {
          mode: 0o600,
          flag: 'wx',
        })
        renameSync(temporary, path)
      } finally {
        rmSync(temporary, { force: true })
      }
    })
    active = launch
    preferences = document as FrontendPreferences
    warning = undefined
    applyTheme()
    return { ...snapshot(), registry, backendChanged }
  }

  ipcMain.handle('frontend-settings:get', snapshot)
  ipcMain.handle('settings:import-file', async (event) => {
    const selected = await pickSettingsFile(
      event,
      'Import settings from file',
      active ? dirname(active.configuration) : app.getPath('userData')
    )
    if (!selected) return null
    const { document } = selected
    if (valid(document)) {
      validate(document)
      return { scope: 'frontend', parameters: document }
    }
    return { scope: 'backend', ...service.importSettings(document) }
  })
  ipcMain.handle('frontend-settings:import', async (event) => {
    const selected = await pickSettingsFile(
      event,
      'Import frontend settings',
      app.getPath('userData')
    )
    if (!selected) return null
    validate(selected.document)
    return selected.document as FrontendPreferences
  })
  ipcMain.handle('frontend-settings:save', (_event, document: unknown) =>
    save(document)
  )
  ipcMain.handle('frontend-settings:theme', (_event, value: unknown) =>
    save({
      ...preferences,
      Theme: { ...preferences.Theme, value },
    })
  )
}
