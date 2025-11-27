import {
  settingsState,
  URL_REMOTE_SERVER,
} from '../stores/settingsStore.svelte'
import { apiRequest } from './api'

/**
 * Save/create a new project with its JSON graph
 * @param {Object} projectData - Project graph to save
 * @param {string} projectData.name - Project name (defaults to 'test')
 * @param {string} projectData.description - Project description (defaults to 'test')
 * @param {Object} projectData.graph - JSON graph data to store in the database
 * @returns {Promise<Object>} The created project object with id, name, description, owner_id, ...
 *
 * @example
 * const newProject = await saveProject({
 *   name: 'My Project',
 *   description: 'A sample project',
 *   graph: { nodes: [], edges: [], ... }
 * })
 */
const saveProject = async (projectData) => {
  const baseUrl = settingsState.getKey(URL_REMOTE_SERVER)
  return apiRequest(`${baseUrl}/api/projects`, 'POST', projectData)
}

/**
 * Get all projects accessible to the current user
 * @returns {Promise<Array<Object>>} Array of project objects
 */
const getProjects = async () => {
  const baseUrl = settingsState.getKey(URL_REMOTE_SERVER)
  return apiRequest(`${baseUrl}/api/projects/`, 'GET')
}

/**
 * Get a specific project by ID with full graph data
 * @param {number} projectId - The ID of the project to fetch
 * @returns {Promise<Object>} The project object with graph data
 */
const getProject = async (projectId) => {
  const baseUrl = settingsState.getKey(URL_REMOTE_SERVER)
  return apiRequest(`${baseUrl}/api/projects/${projectId}`, 'GET')
}

/**
 * Delete a project by ID (owner only)
 * @param {number} projectId - The ID of the project to delete
 * @returns {Promise<any>} The API response
 * @throws {Error} If the delete request fails
 */
const deleteProject = async (projectId) => {
  const baseUrl = settingsState.getKey(URL_REMOTE_SERVER)
  return apiRequest(`${baseUrl}/api/projects/${projectId}`, 'DELETE')
}

export { saveProject, getProjects, getProject, deleteProject }
