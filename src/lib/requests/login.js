import { auth } from '../stores/auth.svelte'
import { apiRequest } from './api'

export const login = async (data) => {
  const formData = new URLSearchParams()
  formData.append('grant_type', 'password')
  formData.append('username', data.username)
  formData.append('password', data.password)
  formData.append('scope', '')
  formData.append('client_id', 'string')
  formData.append('client_secret', 'string')

  const myHeaders = new Headers()
  myHeaders.append('accept', 'application/json')
  myHeaders.append('Content-Type', 'application/x-www-form-urlencoded')

  const response = await fetch(
    'http://localhost:8000/api/v1/login/access-token',
    {
      method: 'POST',
      headers: myHeaders,
      body: formData.toString(),
    }
  )

  if (!response.ok) {
    throw new Error(`${response.statusText}, HTTP status: ${response.status}`)
  }

  const result = await response.json()
  console.log('result', result)

  auth.setToken(result.access_token)

  // TODO move this check on valid token to separate function and use it in the sidebar to check if the user is logged in
  const responseTestToken = await apiRequest(
    'http://localhost:8000/api/v1/login/test-token',
    'POST'
  )
  console.log('responseTestToken', responseTestToken)

  return result
}
