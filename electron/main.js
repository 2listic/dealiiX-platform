import { app, BrowserWindow, nativeTheme, ipcMain } from 'electron/main'
import path from 'path'
import { fileURLToPath } from 'url'

import {
  connectAndUploadGraph,
  connectToSSHWithKey,
  connectToSSHWithPassword,
} from './utils/sshConnections.js'
import { parseGraph } from './utils/utils.js'

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
  return await connectToSSHWithKey(command)
})

ipcMain.handle('export-graph-ssh', async (event, { nodes, edges }) => {
  const graph = parseGraph(nodes, edges)
  const jsonGraph = JSON.stringify(graph)
  console.log('exported graph', jsonGraph)
  const remotePath = '/root/graph.json'
  return await connectAndUploadGraph(jsonGraph, remotePath)
})

ipcMain.handle('set-theme', (event, theme) => {
  if (theme === 'dark') {
    nativeTheme.themeSource = 'dark'
  } else {
    nativeTheme.themeSource = 'light'
  }
  return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
})
