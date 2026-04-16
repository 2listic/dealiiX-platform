import { app, BrowserWindow, nativeTheme, ipcMain } from 'electron/main'
import { dialog } from 'electron'
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
      enableRemoteModule: false,
      webSecurity: true,
    },
  })

  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  mainWindow.webContents.openDevTools() // open devTools by default
}

const getRemoteConnectionSettings = (settings) => {
  const execution = settings.execution
  if (execution?.remote) {
    return {
      host: execution.remote.host,
      port: execution.remote.port,
      username: execution.remote.username,
      pathToSsh: execution.remote.sshKeyPath,
    }
  }

  return {
    host: 'localhost',
    port: 2222,
    username: 'root',
    pathToSsh: settings.sshPathKey,
  }
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
  if (!connectionSettings.pathToSsh) {
    throw new Error('SSH key path not configured in settings')
  }
  return await connectToSSHWithKey(command, connectionSettings)
})

ipcMain.handle('upload-file-ssh', async (event, { content, remotePath }) => {
  const settings = store.get('settings', {})
  const connectionSettings = getRemoteConnectionSettings(settings)
  if (!connectionSettings.pathToSsh) {
    throw new Error('SSH key path not configured in settings')
  }
  return await uploadFileViaSftp(content, remotePath, connectionSettings)
})

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

ipcMain.handle('start-local-coral-run', async (event, payload) => {
  return await startLocalCoralRun(payload)
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
  // Option 1: Open in system default browser (recommended for external URLs)
  // await shell.openExternal(url)
  // return { success: true }

  // Option 2: Open in a new Electron window
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
    return { success: false, error: error.message }
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
