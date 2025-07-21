export const login = async () => {
  console.log('login')
  try {
    // test GET call
    // const data = await fetch('https://jsonplaceholder.typicode.com/todos/1')
    // if (!data.ok) {
    //   throw new Error('Network response was not ok')
    // }
    // const json = await data.json()
    // console.log('json', json)

    // test POST call and login authentication with remote server
    const formData = new URLSearchParams()
    formData.append('grant_type', 'password')
    formData.append('username', 'admin@example.com')
    formData.append('password', 'changethis')
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
    const result = await response.json()
    console.log('result', result)
  } catch (error) {
    console.error('Error:', error)
  }
}
