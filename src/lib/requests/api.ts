import { auth } from '../stores/auth.svelte'

// Custom error class to carry API error details
export class ApiError extends Error {
  status: number
  data: unknown

  constructor(message: string, status: number, data: unknown = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

export async function apiRequest(
  url: string,
  method = 'GET',
  body: Record<string, unknown> | null = null,
  options: Omit<RequestInit, 'headers'> & {
    headers?: Record<string, string>
  } = {}
) {
  const token = auth.token

  const headers: Record<string, string> = {
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
    const errorMessage =
      (data as Record<string, string>)?.error ||
      `HTTP error! status: ${response.status}`
    throw new ApiError(errorMessage, response.status, data)
  }

  return data
}
