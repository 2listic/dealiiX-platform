import { auth } from '../stores/auth.svelte'
import { settingsState } from '../stores/settingsStore.svelte'
// import { apiRequest } from './api'

export const login = async (data: { username: string; password: string }) => {
  const baseUrl = settingsState.current.urlRemoteServer
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
  await auth.setToken(result.token)
  await auth.setUsername(data.username)
  return result
}
