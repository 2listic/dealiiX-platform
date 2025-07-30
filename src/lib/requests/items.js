import { apiRequest } from './api'

// TODO modify this test POST request so that it calls the right api endpoint and stores the JSON graph data in the database
const saveItem = async () => {
  const result = await apiRequest(
    'http://localhost:8000/api/v1/items',
    'POST',
    {
      title: 'test',
      description: 'test',
    }
  )
  console.log('create item result', result)

  return result
}

const getItem = async () => {
  const result = await apiRequest(`http://localhost:8000/api/v1/items/`, 'GET')

  console.log('get item result', result['data'][0])

  return result['data'][0]
}

export { saveItem, getItem }
