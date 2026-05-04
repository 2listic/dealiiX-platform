import { settingsState } from '../stores/settingsStore.svelte'
import { apiRequest } from './api'

/**
 * Save/create a new project with its JSON graph
 * @param projectData - Project graph to save
 * @returns The created project object with id, name, description, owner_id, ...
 * @throws If the request fails
 */
const saveProject = async (projectData: {
  name: string
  description?: string
  graph: Record<string, unknown>
}) => {
  const baseUrl = settingsState.current.urlRemoteServer
  return apiRequest(`${baseUrl}/api/projects`, 'POST', projectData)
}

/**
 * Update an existing project by ID
 * @param projectId - The ID of the project to update
 * @param projectData - Project data to update
 * @returns The updated project object
 * @throws If the update request fails
 */
const updateProject = async (
  projectId: number,
  projectData: {
    name?: string
    description?: string
    graph?: Record<string, unknown>
  }
) => {
  const baseUrl = settingsState.current.urlRemoteServer
  return apiRequest(`${baseUrl}/api/projects/${projectId}`, 'PUT', projectData)
}

/**
 * Get all projects accessible to the current user
 * @returns Array of project objects
 * @throws If the request fails
 */
const getProjects = async () => {
  const baseUrl = settingsState.current.urlRemoteServer
  return apiRequest(`${baseUrl}/api/projects/`, 'GET')
}

/**
 * Get a specific project by ID with full graph data
 * @param projectId - The ID of the project to fetch
 * @returns The project object with graph data
 * @throws If the request fails
 */
const getProject = async (projectId: number) => {
  const baseUrl = settingsState.current.urlRemoteServer
  return apiRequest(`${baseUrl}/api/projects/${projectId}`, 'GET')
}

/**
 * Delete a project by ID (owner only)
 * @param projectId - The ID of the project to delete
 * @returns The API response
 * @throws If the delete request fails
 */
const deleteProject = async (projectId: number) => {
  const baseUrl = settingsState.current.urlRemoteServer
  return apiRequest(`${baseUrl}/api/projects/${projectId}`, 'DELETE')
}

/**
 * Search for users to share projects with
 * @param query - Optional search query. If not provided, returns all users
 * @returns Object with 'query' and 'users' array of user objects with id, username, email
 * @throws If the request fails
 */
const searchUsers = async (query = '') => {
  const baseUrl = settingsState.current.urlRemoteServer
  const url = query
    ? `${baseUrl}/api/users/search?q=${encodeURIComponent(query)}`
    : `${baseUrl}/api/users/search`
  return apiRequest(url, 'GET')
}

/**
 * Share a project with another user
 * @param projectId - The ID of the project to share
 * @param userId - The ID of the user to share with
 * @param permissionLevel - Permission level: "read" or "write"
 * @returns Response with success message and user details
 * @throws If the request fails
 */
const shareProject = async (
  projectId: number,
  userId: number,
  permissionLevel: string
) => {
  const baseUrl = settingsState.current.urlRemoteServer
  return apiRequest(`${baseUrl}/api/projects/${projectId}/share`, 'POST', {
    user_id: userId,
    permission_level: permissionLevel,
  })
}

export {
  saveProject,
  updateProject,
  getProjects,
  getProject,
  deleteProject,
  searchUsers,
  shareProject,
}
