export const login = async (data) => {
  // test GET call
  // const data = await fetch('https://jsonplaceholder.typicode.com/todos/1')
  // if (!data.ok) {
  //   throw new Error('Network response was not ok')
  // }
  // const json = await data.json()
  // console.log('json', json)

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
  return result
}
