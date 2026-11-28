import { contextBridge, ipcRenderer, webUtils } from 'electron'

/**
 * Declaration types at interface.d.ts declaration file to expose them over the context bridge in the renderer process.
 * Docs: https://www.electronjs.org/docs/latest/tutorial/context-isolation#usage-with-typescript
 */
contextBridge.exposeInMainWorld('electron', {
  importSettingsFile: () => ipcRenderer.invoke('settings:import-file'),
  frontendSettings: {
    get: () => ipcRenderer.invoke('frontend-settings:get'),
    importConfiguration: () => ipcRenderer.invoke('frontend-settings:import'),
    save: (configuration: unknown) =>
      ipcRenderer.invoke('frontend-settings:save', configuration),
    setTheme: (theme: unknown) =>
      ipcRenderer.invoke('frontend-settings:theme', theme),
  },
  workflow: {
    enabled: () => ipcRenderer.invoke('workflow:enabled'),
    openWorkflow: () => ipcRenderer.invoke('workflow:open'),
    readConfiguration: () => ipcRenderer.invoke('workflow:read-configuration'),
    importConfiguration: () =>
      ipcRenderer.invoke('workflow:import-configuration'),
    saveConfiguration: (
      parameters: unknown,
      revision: string,
      target?: unknown
    ) =>
      ipcRenderer.invoke(
        'workflow:save-configuration',
        parameters,
        revision,
        target
      ),
    exchange: (request: unknown, target?: unknown) =>
      ipcRenderer.invoke('workflow:exchange', request, target),
    subscribe: (listener: (response: unknown) => void) => {
      const handler = (_event: unknown, response: unknown) => listener(response)
      ipcRenderer.on('workflow:status', handler)
      return () => ipcRenderer.removeListener('workflow:status', handler)
    },
  },
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
