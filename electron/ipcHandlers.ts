import { ipcMain, BrowserWindow, nativeTheme, screen } from 'electron/main'
import { dialog } from 'electron'
import fs from 'fs'
import type {
  AppSettings,
  ExecutionSettings,
} from '../src/lib/types/settingsTypes.js'

import {
  uploadFileViaSftp,
  connectToSSHWithKey,
  connectToSSHWithPassword,
  type SshConnection,
} from './utils/sshConnections.js'
import { probeAndSyncExecutionSettings } from './utils/executionProbe.js'
import {
  getParameterFileFilters,
  serializeParametersFile,
} from '../src/lib/utils/parameterFileFormat.js'
import {
  getLocalNodeStatusFiles,
  getLocalRunLog,
  getLocalRunState,
  listLocalRuns,
  startLocalCoralRun,
  startLocalExecutableRun,
} from './utils/localCoralRuns.js'
import store from './utils/storage.js'

/**
 * Registers all IPC handlers for the main process.
 * @returns {void}
 */
export function registerIpcHandlers(): void {
  ipcMain.handle(
    'execute-ssh-command-with-password',
    async (_event, { host, username, password, command }) => {
      return await connectToSSHWithPassword(host, username, password, command)
    }
  )

  ipcMain.handle(
    'execute-ssh-with-key',
    async (_event, { command, rejectOnNonZeroCode = false }) => {
      const settings = store.get('settings')
      const connectionSettings = getRemoteConnectionSettings(settings)
      return await connectToSSHWithKey(command, connectionSettings, {
        rejectOnNonZeroCode,
      })
    }
  )

  ipcMain.handle('upload-file-ssh', async (_event, { content, remotePath }) => {
    const settings = store.get('settings')
    const connectionSettings = getRemoteConnectionSettings(settings)
    return await uploadFileViaSftp(content, remotePath, connectionSettings)
  })

  ipcMain.handle(
    'probe-sync-execution-settings',
    async (_event, executionSettings: ExecutionSettings) => {
      return await probeAndSyncExecutionSettings(executionSettings)
    }
  )

  ipcMain.handle('pick-directory', () => {
    const filePaths = dialog.showOpenDialogSync({
      properties: ['openDirectory'],
    })
    return filePaths?.[0] ?? null
  })

  ipcMain.handle('pick-file', () => {
    const filePaths = dialog.showOpenDialogSync({ properties: ['openFile'] })
    return filePaths?.[0] ?? null
  })

  /**
   * Shows a native save dialog and writes the parameter file.
   * @param defaultPath - Pre-filled filename shown in the dialog.
   * @param parameters  - ParameterTree to serialise. Takes precedence over `content`.
   * @param content     - Pre-serialised string fallback, used only when `parameters` is absent.
   * @param title       - Dialog window title.
   * @returns { canceled, filePath } — filePath is null when canceled.
   */
  ipcMain.handle(
    'save-parameters-file',
    async (
      _event,
      { defaultPath, parameters, content, title = 'Save Parameters File' }
    ) => {
      const result = await dialog.showSaveDialog({
        title,
        defaultPath,
        filters: getParameterFileFilters(),
      })

      if (result.canceled || !result.filePath) {
        return { canceled: true, filePath: null }
      }

      // Format derived from the confirmed path extension: .prm → PRM text, otherwise JSON.
      // On Linux (GTK) the filter dropdown does not append the extension automatically.
      const fileContent =
        parameters !== undefined
          ? serializeParametersFile(parameters, result.filePath)
          : content
      if (typeof fileContent !== 'string') {
        throw new Error('No parameters content was provided')
      }
      await fs.promises.writeFile(result.filePath, fileContent, 'utf8')
      return { canceled: false, filePath: result.filePath }
    }
  )

  ipcMain.handle('start-local-coral-run', async (_event, payload) => {
    return await startLocalCoralRun(payload)
  })

  ipcMain.handle('start-local-executable-run', async (_event, payload) => {
    return await startLocalExecutableRun(payload)
  })

  ipcMain.handle('list-local-runs', async (_event, { numDays }) => {
    return listLocalRuns(numDays)
  })

  ipcMain.handle('get-local-run-log', async (_event, { jobId }) => {
    return await getLocalRunLog(jobId)
  })

  ipcMain.handle(
    'get-local-node-status-files',
    async (_event, { jobIdInternal }) => {
      return await getLocalNodeStatusFiles(jobIdInternal)
    }
  )

  ipcMain.handle('get-local-run-state', async (_event, { jobId }) => {
    return getLocalRunState(jobId)
  })

  ipcMain.handle('open-external-url', async (_event, url: string) => {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize
    const externalWindow = new BrowserWindow({
      width: Math.round(width * 0.8),
      height: Math.round(height * 0.8),
    })

    try {
      const parsedUrl = new URL(url)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol')
      }

      await externalWindow.loadURL(url)
      return { success: true }
    } catch (error) {
      console.error('Failed to open URL:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })

  ipcMain.handle('set-theme', (_event, theme: string) => {
    if (theme === 'dark') {
      nativeTheme.themeSource = 'dark'
    } else {
      nativeTheme.themeSource = 'light'
    }
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  })
}

// ── Private helpers ──

const getRemoteConnectionSettings = (
  settings: AppSettings | undefined
): SshConnection => {
  const remote = settings?.execution?.remote
  const { host, port, username, sshKeyPath } = remote ?? {}
  if (!host || !port || !username || !sshKeyPath) {
    throw new Error(
      'SSH connection settings are incomplete. Check your settings.'
    )
  }
  return { host, port, username, pathToSsh: sshKeyPath }
}
