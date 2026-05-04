import Store from 'electron-store'
import { ipcMain } from 'electron'
import type { AppSettings } from '../../src/lib/types/settingsTypes.js'

interface StorageSchema {
  access_token?: string
  username?: string
  settings?: AppSettings
  colorMode?: string
  registered_nodes?: Record<string, unknown>
  registered_network_nodes?: Record<string, unknown>
  jobs?: unknown[]
  jobIdMap?: Record<string, unknown>
  localRuns?: unknown[]
}

/**
 * Create Electron-store's new store instance with JSON schema for validation.
 * See documentation at https://github.com/sindresorhus/electron-store
 */
const store = new Store<StorageSchema>({
  name: 'dealiix-storage',
  schema: {
    access_token: { type: 'string' },
    username: { type: 'string' },
    settings: { type: 'object' },
    colorMode: { type: 'string', default: 'light' },
    registered_nodes: { type: 'object' },
    registered_network_nodes: { type: 'object' },
    jobs: { type: 'array', default: [] },
    jobIdMap: { type: 'object', default: {} },
    localRuns: { type: 'array', default: [] },
  },
})

// Setup IPC handlers for renderer access
ipcMain.handle('store:get', (_event, key, defaultValue) => {
  return store.get(key, defaultValue)
})

ipcMain.handle('store:set', (_event, key, value) => {
  store.set(key, value)
  return true
})

ipcMain.handle('store:remove', (_event, key) => {
  store.delete(key)
  return true
})

console.log('electron-store initialized')

export default store
