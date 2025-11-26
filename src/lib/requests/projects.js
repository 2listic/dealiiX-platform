import {
  settingsState,
  URL_REMOTE_SERVER,
} from '../stores/settingsStore.svelte'
import { apiRequest } from './api'

/**
 * Save/create a new project with its JSON graph
 * @param {Object} [projectData] - Optional project data to save
 * @param {string} [projectData.name] - Project name (defaults to 'test')
 * @param {string} [projectData.description] - Project description (defaults to 'test')
 * @param {Object} [projectData.data] - JSON graph data to store in the database
 * @returns {Promise<Object>} The created project object with id, name, description, owner_id, created_at, updated_at
 * @throws {Error} If the save request fails or authentication is invalid
 *
 * @example
 * const newProject = await saveProject({
 *   name: 'My Project',
 *   description: 'A sample project',
 *   data: { nodes: [], edges: [] }
 * })
 */
const saveProject = async (
  projectData = {
    name: 'test',
    description: 'test',
    data: { nodes: [], edges: [] },
  }
) => {
  try {
    const baseUrl = settingsState.getKey(URL_REMOTE_SERVER)
    const result = await apiRequest(
      `${baseUrl}/api/projects`,
      'POST',
      projectData
    )
    return result
  } catch (error) {
    console.error('Failed to save project:', error)
    throw error
  }
}

/**
 * Get all projects accessible to the current user
 * @returns {Promise<Array<Object>>} Array of project objects
 * @throws {Error} If the fetch request fails, authentication is invalid, or network error occurs
 */
const getProjects = async () => {
  try {
    const baseUrl = settingsState.getKey(URL_REMOTE_SERVER)
    const result = await apiRequest(`${baseUrl}/api/projects/`, 'GET')
    return result
  } catch (error) {
    console.error('Failed to fetch projects:', error)
    throw error
  }
}

/**
 * Delete a project by ID (owner only)
 * @param {number} projectId - The ID of the project to delete
 * @returns {Promise<any>} The API response
 * @throws {Error} If the delete request fails
 */
const deleteProject = async (projectId) => {
  try {
    const baseUrl = settingsState.getKey(URL_REMOTE_SERVER)
    const result = await apiRequest(
      `${baseUrl}/api/projects/${projectId}`,
      'DELETE'
    )
    return result
  } catch (error) {
    console.error('Failed to delete project:', error)
    throw error
  }
}

export { saveProject, getProjects, deleteProject }
