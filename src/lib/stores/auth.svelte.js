/**
 * using property accessors as show here:
 * https://joyofcode.xyz/how-to-share-state-in-svelte-5#using-property-accessors-to-read-and-write-to-reactive-values
 *  */

let token = $state(null)
let username = $state(null)

const persistAuthValue = async (key, value) => {
  if (window.electron?.store) {
    await window.electron.store.set(key, value)
  } else {
    console.warn(`Electron store not available while persisting '${key}'`)
  }
}

const removeAuthValue = async (key) => {
  if (window.electron?.store) {
    await window.electron.store.remove(key)
  } else {
    console.warn(`Electron store not available while removing '${key}'`)
  }
}

// Load initial values from electron-store
const loadAuth = async () => {
  if (window.electron?.store) {
    token = await window.electron.store.get('access_token')
    username = await window.electron.store.get('username')
  } else {
    console.warn('Electron store not available (e.g., dev:vite mode)')
  }
}
loadAuth()

export const auth = {
  get token() {
    // auth.token will return the current value of token
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/get
    return token
  },
  get username() {
    return username
  },
  async setToken(newToken) {
    token = newToken
    await persistAuthValue('access_token', newToken)
  },
  async setUsername(newUsername) {
    username = newUsername
    await persistAuthValue('username', newUsername)
  },
  async clearToken() {
    token = null
    username = null
    await removeAuthValue('access_token')
    await removeAuthValue('username')
  },
}
