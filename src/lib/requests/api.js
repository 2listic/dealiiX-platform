import { auth } from '../stores/auth.svelte'

export async function apiRequest(
  url,
  method = 'GET',
  body = null,
  options = {}
) {
  const token = auth.token

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(url, {
    method: method,
    ...options,
    headers,
    body: body ? JSON.stringify(body) : null,
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const data = await response.json()

  return data
}
