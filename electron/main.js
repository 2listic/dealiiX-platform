import { app, BrowserWindow, nativeTheme, ipcMain } from 'electron/main'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  connectAndUploadGraph,
  connectToSSHWithKey,
  connectToSSHWithPassword,
} from './utils/sshConnections.js'
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
      webSecurity: true, // Ensure web security is enabled
      contentSecurityPolicy: "default-src 'self'; script-src 'self'", // Set a basic CSP
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
  const pathToSsh = settings.sshPathKey
  if (!pathToSsh) {
    throw new Error('SSH key path not configured in settings')
  }
  return await connectToSSHWithKey(command, pathToSsh)
})

ipcMain.handle('export-graph-ssh', async (event, { graph }) => {
  const settings = store.get('settings', {})
  const pathToSsh = settings.sshPathKey
  if (!pathToSsh) {
    throw new Error('SSH key path not configured in settings')
  }
  const jsonGraph = JSON.stringify(graph)
  console.log('exported graph', jsonGraph)
  const remotePath = '/shared-data/graph.json'
  return await connectAndUploadGraph(jsonGraph, remotePath, pathToSsh)
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

