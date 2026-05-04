/**
 * using property accessors as show here:
 * https://joyofcode.xyz/how-to-share-state-in-svelte-5#using-property-accessors-to-read-and-write-to-reactive-values
 *  */

let token = $state<string | null>(null)
let username = $state<string | null>(null)

/**
 * Persists an auth value to electron-store.
 * @param key - The storage key to write.
 * @param value - The value to store, or null to clear.
 * @returns A promise that resolves when the write completes.
 */
const persistAuthValue = async (
  key: string,
  value: string | null
): Promise<void> => {
  if (window.electron?.store) {
    await window.electron.store.set(key, value)
  } else {
    console.warn(`Electron store not available while persisting '${key}'`)
  }
}

/**
 * Removes an auth value from electron-store.
 * @param key - The storage key to remove.
 * @returns A promise that resolves when the removal completes.
 */
const removeAuthValue = async (key: string): Promise<void> => {
  if (window.electron?.store) {
    await window.electron.store.remove(key)
  } else {
    console.warn(`Electron store not available while removing '${key}'`)
  }
}

// Load initial values from electron-store
const loadAuth = async (): Promise<void> => {
  if (window.electron?.store) {
    token = await window.electron.store.get('access_token')
    username = await window.electron.store.get('username')
  } else {
    console.warn('Electron store not available (e.g., dev:vite mode)')
  }
}
loadAuth()

export const auth = {
  get token(): string | null {
    // auth.token will return the current value of token
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Functions/get
    return token
  },
  get username(): string | null {
    return username
  },
  /**
   * Sets the JWT token and persists it to electron-store.
   * @param newToken - The token string to store.
   * @returns A promise that resolves when the write completes.
   */
  async setToken(newToken: string): Promise<void> {
    token = newToken
    await persistAuthValue('access_token', newToken)
  },
  /**
   * Sets the username and persists it to electron-store.
   * @param newUsername - The username string to store.
   * @returns A promise that resolves when the write completes.
   */
  async setUsername(newUsername: string): Promise<void> {
    username = newUsername
    await persistAuthValue('username', newUsername)
  },
  /**
   * Clears the token and username from state and electron-store.
   * @returns A promise that resolves when both values are removed.
   */
  async clearToken(): Promise<void> {
    token = null
    username = null
    await removeAuthValue('access_token')
    await removeAuthValue('username')
  },
}
