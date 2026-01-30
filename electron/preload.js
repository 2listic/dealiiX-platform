const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('electron', {
  send: (channel, data) => ipcRenderer.send(channel, data),
  on: (channel, func) =>
    ipcRenderer.on(channel, (event, ...args) => func(...args)),
  invoke: (channel, data) => ipcRenderer.invoke(channel, data),
  // Original example from the official docs at https://www.electronjs.org/docs/latest/breaking-changes#removed-filepath
  getFilePath(file) {
    // It's best not to expose the full file path to the web content if possible.
    const path = webUtils.getPathForFile(file)
    return path
  },
  // Storage API
  store: {
    get: (key, defaultValue) =>
      ipcRenderer.invoke('store:get', key, defaultValue),
    set: (key, value) => ipcRenderer.invoke('store:set', key, value),
    remove: (key) => ipcRenderer.invoke('store:remove', key),
  },
})
