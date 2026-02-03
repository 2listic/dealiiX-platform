let settings = $state({})

// Load initial settings from electron-store
const loadSettings = async () => {
  if (window.electron?.store) {
    settings = await window.electron.store.get('settings', {})
  } else {
    console.warn('Electron store not available (e.g., dev:vite mode)')
  }
}
loadSettings()

export const SSH_PATH = 'sshPathKey'
export const URL_VISUALIZER = 'urlVisualizerKey'
export const URL_REMOTE_SERVER = 'urlRemoteServerKey'

export const settingsState = {
  getKey(key) {
    return settings?.[key] ?? undefined
  },
  async setKey(key, value) {
    if (!settings) settings = {}
    settings[key] = value
    await window.electron.store.set('settings', $state.snapshot(settings))
  },
}
