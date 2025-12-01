let settings = $state(JSON.parse(localStorage.getItem('settings')))

export const SSH_PATH = 'sshPathKey'
export const URL_VISUALIZER = 'urlVisualizerKey'
export const URL_REMOTE_SERVER = 'urlRemoteServerKey'

export const settingsState = {
  getKey(key) {
    return settings?.[key] ?? undefined
  },
  setKey(key, value) {
    if (!settings) settings = {}
    settings[key] = value
    const settingsJson = JSON.stringify(settings)
    localStorage.setItem('settings', settingsJson)
  },
}
