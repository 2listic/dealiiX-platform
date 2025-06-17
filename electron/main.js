import { app, BrowserWindow, ipcMain } from 'electron/main'
import path from 'path'
import { fileURLToPath } from 'url'
import { Client } from 'ssh2'
import fs from 'fs'
import os from 'os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const __userHomeDir = path.resolve(os.homedir())

let mainWindow

function createWindow () {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, '../electron/preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
            enableRemoteModule: false,
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

function connectToSSHWithPassword(host, username, password, command) {
  return new Promise((resolve, reject) => {
    const conn = new Client()
    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) reject(err)
        let data = ''
        stream.on('close', (code, signal) => {
          conn.end()
          resolve(data)
        }).on('data', (chunk) => {
          data += chunk
        }).stderr.on('data', (chunk) => {
          data += chunk
        })
      })
    }).on('error', (err) => {
      reject(err)
    }).connect({
      host,
      port: 5050,
      username,
      password
    })
  })
}

// Handle SSH command execution with password and Python fake-ssh server
ipcMain.handle('execute-ssh-command-with-password', async (event, { host, username, password, command }) => {
  try {
    const result = await connectToSSHWithPassword(host, username, password, command)
    return result
  } catch (err) {
    throw err
  }
})

function connectToSSH() {
  const conn = new Client()
  const privateKeyPath = path.join(__userHomeDir, '.ssh/id_rsa')

  return new Promise((resolve, reject) => {
    conn.on('ready', () => {
      console.log('SSH Connection established')

      conn.exec('whoami', (err, stream) => {
        if (err) return reject(err)

        let data = ''
        stream.on('close', (code, signal) => {
          console.log('Command completed with code', code)
          conn.end()
          resolve(data)
        }).on('data', (chunk) => {
          console.log('STDOUT:', chunk.toString())
          data += chunk
        }).stderr.on('data', (chunk) => {
          console.log('STDERR:', chunk.toString())
          data += chunk
        })
      })
    }).on('error', (err) => {
      console.error('SSH Connection error:', err)
      reject(err)
    }).connect({
      host: 'localhost',
      port: 2222,
      username: 'root',
      privateKey: fs.readFileSync(privateKeyPath),
      debug: console.log,
      hostVerifier: (keyHash) => {  // consider hashing the private key
        return true
      },
      readyTimeout: 5000,           // additional options
      keepaliveInterval: 10000
    })
  })
}

// Listen for messages from the renderer process
ipcMain.handle('connect-ssh', async (event) => {
  try {
    const result = await connectToSSH()
    return result
  } catch (err) {
    throw err
  }
})