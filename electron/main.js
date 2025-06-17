import { app, BrowserWindow, ipcMain } from 'electron/main';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from 'ssh2';
import fs from 'fs';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const __userHomeDir = path.resolve(os.homedir());

let mainWindow;

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
    });

    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    mainWindow.webContents.openDevTools(); // this is optional thing, use it if you see a devTool window opened
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
  return new Promise((resolve, reject) => {
    const conn = new Client();
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
})

function connectToSSH() {
  const conn = new Client();
  
  // Get the path to your private key (corresponding to the public key in the Docker container)
  const privateKeyPath = path.join(__userHomeDir, '.ssh/id_rsa');
  
  conn.on('ready', () => {
    console.log('SSH Connection established');
    
    // Example: Execute a command
    conn.exec('whoami', (err, stream) => {
      if (err) throw err;
      
      stream.on('close', (code, signal) => {
        console.log('Command completed with code', code);
        conn.end();
      }).on('data', (data) => {
        console.log('STDOUT:', data.toString());
      }).stderr.on('data', (data) => {
        console.log('STDERR:', data.toString());
      });
    });
  }).on('error', (err) => {
    console.error('SSH Connection error:', err);
  }).connect({
    host: 'localhost',
    port: 2222,
    username: 'root',
    privateKey: fs.readFileSync(privateKeyPath),
    // For debugging:
    debug: console.log,
    // ... other options ...
    hostVerifier: (keyHash) => {
    // Implement verification logic
      return true; // or false if the host key doesn't match expectations
    },
    readyTimeout: 5000, // 5 seconds
    keepaliveInterval: 10000 // 10 seconds
  });
}

// Listen for messages from the renderer process
ipcMain.handle('connect-ssh', async (event) => {
  await connectToSSH();
});