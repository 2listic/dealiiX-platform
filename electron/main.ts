import { app, BrowserWindow, screen } from 'electron/main'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Must run before any dynamic import that reaches storage.ts / electron-store,
// because electron-store reads app.getPath('userData') at construction time.
// Static imports are hoisted in ESM, so ipcHandlers is imported dynamically below.
if (process.env.ELECTRON_USERDATA) {
  app.setPath('userData', process.env.ELECTRON_USERDATA)
}

let mainWindow: BrowserWindow | null = null

function createWindow() {
  // After compilation the output lands in dist-electron/electron/, so we use
  // app.getAppPath() (project root) for resources that live outside dist-electron/.
  const appPath = app.getAppPath()
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  // Use a fixed size in E2E tests so bounding-box calculations and fitView
  // results are identical across machines and CI environments.
  const windowWidth = process.env.E2E_TEST ? 1280 : Math.round(width * 0.8)
  const windowHeight = process.env.E2E_TEST ? 800 : Math.round(height * 0.8)

  mainWindow = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    icon: path.join(appPath, 'electron/assets/coral-orange.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: true,
    },
  })

  mainWindow.loadFile(path.join(appPath, 'dist/index.html'))
  // mainWindow.webContents.openDevTools() // open devTools by default
}

app.whenReady().then(async () => {
  const { registerIpcHandlers } = await import('./ipcHandlers.js')
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
