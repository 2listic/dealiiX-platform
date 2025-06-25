import { app, BrowserWindow, ipcMain } from 'electron/main'
import path from 'path'
import { fileURLToPath } from 'url'

import { connectToSSHWithPassword, connectToSSHWithKey, connectAndUploadFile, connectAndUploadGraph } from './utils/sshConnections.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow

function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../electron/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,          enableRemoteModule: false,
      webSecurity: true, // Ensure web security is enabled
      contentSecurityPolicy: "default-src 'self'; script-src 'self'" // Set a basic CSP
     }
  })

  mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  mainWindow.webContents.openDevTools() // this is optional thing, use it if you see a devTool window opened
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
})
})

app.on('window-all-closed', () => {
  // eslint-disable-next-line no-undef
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Handle SSH command execution with password and Python fake-ssh server
ipcMain.handle('execute-ssh-command-with-password', async (event, { host, username, password, command }) => {
  return await connectToSSHWithPassword(host, username, password, command)
})

// Listen for messages from the renderer process
ipcMain.handle('connect-ssh', async (event, { command }) => {
  return await connectToSSHWithKey(command)
})

ipcMain.handle('upload-file-with-key', async (event) => {
  const localPath = path.join(__dirname, '/example.json')
  const remotePath = '/root/example.json'
  return await connectAndUploadFile(localPath, remotePath)
})

const parseGraph = (nodes, edges) => {
  const nodesGraph = nodes.reduce((acc, obj) => {
    acc[obj.id] = {
      id: obj.id,
      type: obj.type,
      data: obj.data,
    }
    return acc
  }, {});
  const edgesGraph = edges.reduce((acc, obj) => {
    acc[obj.id] = {
      id: obj.id,
      source: obj.source,
      target: obj.target,
    }
    return acc
  }, {});
  return {
    workflow: {
      nodes: nodesGraph,
      edges: edgesGraph
    },
    version: 1,
    author: 'name',
    dateTimeUtc: new Date().toISOString(),
  }
}

ipcMain.handle('upload-graph-with-key', async (event, { nodes, edges }) => {
  const graph = parseGraph(nodes, edges)
  const jsonGraph = JSON.stringify(graph)
  const remotePath = '/root/graph.json'
  return await connectAndUploadGraph(jsonGraph, remotePath)
})