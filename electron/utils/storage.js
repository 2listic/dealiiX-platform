import Store from 'electron-store'
import { ipcMain } from 'electron'

// Create store instance with schema
const store = new Store({
  name: 'dealiix-storage',
  schema: {
    access_token: { type: 'string' },
    username: { type: 'string' },
    settings: { type: 'object' },
    colorMode: { type: 'string', default: 'light' },
    registered_nodes: { type: 'object' },
    registered_network_nodes: { type: 'object' },
  },
})

// Setup IPC handlers for renderer access
ipcMain.handle('store:get', (event, key, defaultValue) => {
  return store.get(key, defaultValue)
})

ipcMain.handle('store:set', (event, key, value) => {
  store.set(key, value)
  return true
})

ipcMain.handle('store:remove', (event, key) => {
  store.delete(key)
  return true
})

console.log('electron-store initialized')

export default store
