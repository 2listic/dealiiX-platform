import { auth } from '../stores/auth.svelte'

// Custom error class to carry API error details
export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

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

  let data
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    // Extract error message from backend response or use fallback
    const errorMessage = data?.error || `HTTP error! status: ${response.status}`
    throw new ApiError(errorMessage, response.status, data)
  }

  return data
}
