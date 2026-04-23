import { contextBridge, ipcRenderer, webUtils } from 'electron'

/**
 * Declaration types at interface.d.ts declaration file to expose them over the context bridge in the renderer process.
 * Docs: https://www.electronjs.org/docs/latest/tutorial/context-isolation#usage-with-typescript
 */
contextBridge.exposeInMainWorld('electron', {
  send: (channel: string, data?: unknown) => ipcRenderer.send(channel, data),
  on: (channel: string, func: (...args: unknown[]) => void) =>
    ipcRenderer.on(channel, (_event, ...args) => func(...args)),
  invoke: (channel: string, data?: unknown) =>
    ipcRenderer.invoke(channel, data),
  // Original example from the official docs at https://www.electronjs.org/docs/latest/breaking-changes#removed-filepath
  getFilePath(file: File): string {
    // It's best not to expose the full file path to the web content if possible.
    return webUtils.getPathForFile(file)
  },
  // Storage API
  store: {
    get: (key: string, defaultValue?: unknown) =>
      ipcRenderer.invoke('store:get', key, defaultValue),
    set: (key: string, value: unknown) =>
      ipcRenderer.invoke('store:set', key, value),
    remove: (key: string) => ipcRenderer.invoke('store:remove', key),
  },
})
