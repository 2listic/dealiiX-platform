import { app, BrowserWindow, screen } from 'electron/main'
import path from 'path'
import { fileURLToPath } from 'url'

import { registerIpcHandlers } from './ipcHandlers.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let mainWindow: BrowserWindow | null = null

function createWindow() {
  // After compilation the output lands in dist-electron/electron/, so we use
  // app.getAppPath() (project root) for resources that live outside dist-electron/.
  const appPath = app.getAppPath()
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width,
    height,
    icon: path.join(appPath, 'electron/assets/coral-orange.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  })

  mainWindow.loadFile(path.join(appPath, 'dist/index.html'))
  mainWindow.webContents.openDevTools() // open devTools by default
}

app.whenReady().then(() => {
  registerIpcHandlers()
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
