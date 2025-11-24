import { apiRequest } from './api'

// TODO modify this test POST request so that it calls the right api endpoint and stores the JSON graph data in the database
const saveProject = async () => {
  const result = await apiRequest(
    'http://localhost:8008/api/projects',
    'POST',
    {
      name: 'test',
      description: 'test',
    }
  )
  console.log('create project result', result)

  return result
}

const getProjects = async () => {
  const result = await apiRequest(`http://localhost:8008/api/projects/`, 'GET')

  console.log('get projects result', result)

  return result
}

export { saveProject, getProjects }
