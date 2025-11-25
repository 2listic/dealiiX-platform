import { auth } from '../stores/auth.svelte'
import {
  settingsState,
  URL_REMOTE_SERVER,
} from '../stores/settingsStore.svelte'
// import { apiRequest } from './api'

export const login = async (data) => {
  const baseUrl = settingsState.getKey(URL_REMOTE_SERVER)
  const response = await fetch(`${baseUrl}/api/users/login`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: data.username,
      password: data.password,
    }),
  })

  if (!response.ok) {
    throw new Error(`${response.statusText}, HTTP status: ${response.status}`)
  }

  const result = await response.json()
  auth.setToken(result.token)
  return result
}
