import { app, BrowserWindow, nativeTheme, ipcMain } from 'electron/main'
import { dialog } from 'electron'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  uploadFileViaSftp,
  connectToSSHWithKey,
  connectToSSHWithPassword,
} from './utils/sshConnections.js'
import { probeAndSyncExecutionSettings } from './utils/executionProbe.js'
import {
  getLocalNodeStatusFiles,
  getLocalRunLog,
  getLocalRunState,
  listLocalRuns,
  startLocalCoralRun,
  startLocalExecutableRun,
} from './utils/localCoralRuns.js'
import store from './utils/storage.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, '/assets/coral-orange.png'),
    webPreferences: {
      preload: path.join(__dirname, '/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  })

  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  mainWindow.webContents.openDevTools() // open devTools by default
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Handle SSH command execution with password and Python fake-ssh server
ipcMain.handle(
  'execute-ssh-command-with-password',
  async (event, { host, username, password, command }) => {
    return await connectToSSHWithPassword(host, username, password, command)
  }
)

// Listen for messages from the renderer process
ipcMain.handle('execute-ssh-with-key', async (event, { command }) => {
  const settings = store.get('settings', {})
  const connectionSettings = getRemoteConnectionSettings(settings)
  return await connectToSSHWithKey(command, connectionSettings)
})

ipcMain.handle('upload-file-ssh', async (event, { content, remotePath }) => {
  const settings = store.get('settings', {})
  const connectionSettings = getRemoteConnectionSettings(settings)
  return await uploadFileViaSftp(content, remotePath, connectionSettings)
})

const getRemoteConnectionSettings = (settings) => {
  const { host, port, username, sshKeyPath } = settings.execution?.remote ?? {}
  if (!host || !port || !username || !sshKeyPath) {
    throw new Error(
      'SSH connection settings are incomplete. Check your settings.'
    )
  }
  return { host, port, username, pathToSsh: sshKeyPath }
}

ipcMain.handle(
  'probe-sync-execution-settings',
  async (event, executionSettings) => {
    return await probeAndSyncExecutionSettings(executionSettings)
  }
)

ipcMain.handle('pick-directory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return result.filePaths[0]
})

ipcMain.handle(
  'save-json-file',
  async (event, { defaultPath, content, title = 'Save Parameters File' }) => {
    const result = await dialog.showSaveDialog({
      title,
      defaultPath,
      filters: [{ name: 'JSON', extensions: ['json'] }],
    })

    if (result.canceled || !result.filePath) {
      return { canceled: true, filePath: null }
    }

    await fs.promises.writeFile(result.filePath, content, 'utf8')
    return { canceled: false, filePath: result.filePath }
  }
)

ipcMain.handle('start-local-coral-run', async (event, payload) => {
  return await startLocalCoralRun(payload)
})

ipcMain.handle('start-local-executable-run', async (event, payload) => {
  return await startLocalExecutableRun(payload)
})

ipcMain.handle('list-local-runs', async (event, { numDays }) => {
  return listLocalRuns(numDays)
})

ipcMain.handle('get-local-run-log', async (event, { jobId }) => {
  return await getLocalRunLog(jobId)
})

ipcMain.handle(
  'get-local-node-status-files',
  async (event, { jobIdInternal }) => {
    return await getLocalNodeStatusFiles(jobIdInternal)
  }
)

ipcMain.handle('get-local-run-state', async (event, { jobId }) => {
  return getLocalRunState(jobId)
})

ipcMain.handle('open-external-url', async (event, url) => {
  const externalWindow = new BrowserWindow()

  // Validate URL (basic validation)
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

ipcMain.handle('set-theme', (event, theme) => {
  if (theme === 'dark') {
    nativeTheme.themeSource = 'dark'
  } else {
    nativeTheme.themeSource = 'light'
  }
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
})
