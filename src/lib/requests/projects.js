import {
  settingsState,
  URL_REMOTE_SERVER,
} from '../stores/settingsStore.svelte'
import { apiRequest } from './api'

/**
 * Save/create a new project with its JSON graph
 * @param {Object} projectData - Project graph to save
 * @param {string} projectData.name - Project name
 * @param {string} [projectData.description] - Project description (optional)
 * @param {Object} projectData.graph - JSON graph data to store in the database
 * @returns {Promise<Object>} The created project object with id, name, description, owner_id, ...
 * @throws {Error} If the request fails
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
 * Update an existing project by ID
 * @param {number} projectId - The ID of the project to update
 * @param {Object} projectData - Project data to update
 * @param {string} [projectData.name] - Updated project name (optional)
 * @param {string} [projectData.description] - Updated project description (optional)
 * @param {Object} projectData.graph - Updated JSON graph data
 * @returns {Promise<Object>} The updated project object
 * @throws {Error} If the update request fails
 */
const updateProject = async (projectId, projectData) => {
  const baseUrl = settingsState.getKey(URL_REMOTE_SERVER)
  return apiRequest(`${baseUrl}/api/projects/${projectId}`, 'PUT', projectData)
}

/**
 * Get all projects accessible to the current user
 * @returns {Promise<Array<Object>>} Array of project objects
 * @throws {Error} If the request fails
 */
const getProjects = async () => {
  const baseUrl = settingsState.getKey(URL_REMOTE_SERVER)
  return apiRequest(`${baseUrl}/api/projects/`, 'GET')
}

/**
 * Get a specific project by ID with full graph data
 * @param {number} projectId - The ID of the project to fetch
 * @returns {Promise<Object>} The project object with graph data
 * @throws {Error} If the request fails
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

export { saveProject, updateProject, getProjects, getProject, deleteProject }
