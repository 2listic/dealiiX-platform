import Store from 'electron-store'
import { ipcMain } from 'electron'

/**
 * Create Electron-store's new store instance with JSON schema for validation
 * See documentation at https://github.com/sindresorhus/electron-store
 */
const store = new Store({
  name: 'dealiix-storage',
  schema: {
    access_token: { type: 'string' },
    username: { type: 'string' },
    settings: { type: 'object' },
    settingsDraft: { type: 'object' },
    colorMode: { type: 'string', default: 'light' },
    registered_nodes: { type: 'object' },
    registered_network_nodes: { type: 'object' },
    jobs: { type: 'array', default: [] },
    jobIdMap: { type: 'object', default: {} },
  },
})

// Setup IPC handlers for renderer access
ipcMain.handle('store:get', (event, key, defaultValue) => {
  // Electron-store getter
  return store.get(key, defaultValue)
})

ipcMain.handle('store:set', (event, key, value) => {
  // Electron-store setter
  store.set(key, value)
  return true
})

ipcMain.handle('store:remove', (event, key) => {
  // Electron-store delete
  store.delete(key)
  return true
})

console.log('electron-store initialized')

export default store
