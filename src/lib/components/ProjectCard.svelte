<script lang="ts">
  import { deleteProject, getProject } from '../requests/projects'
  import { toastState } from '../stores/toastsStore.svelte'
  import {
    loadGraphFromProtocol,
    removeQualifiedIds,
    validateGraphData,
  } from '../utils/graphParser'
  import Button from './layout/Button.svelte'
  import { currentProjectState } from '../stores/currentProjectStore.svelte'
  import Modal, { getModal } from './layout/Modal.svelte'
  import ShareProjectModal from './ShareProjectModal.svelte'
  import EditProjectForm from './EditProjectForm.svelte'
  import ConfirmationModal from './layout/ConfirmationModal.svelte'
  import { graphNavigationState } from '../stores/graphNavigation.svelte'

  interface Project {
    id: number
    name: string
    description: string
    // created_at: string
    updated_at: string
    owner: {
      // id: number
      username: string
      // email: string
    }
    shared_users?: Array<{
      user_id: number
      username: string
      email: string
      permission_level: string
    }>
  }

  interface Props {
    project: Project
    // underscore-prefixed arg name to avoid eslint no-unused-vars error in interfaces
    onDelete: (_projectId: number) => void
    onLoad: () => void
    onShare: () => void
    onEdit: () => void
  }

  let { project, onDelete, onLoad, onShare, onEdit }: Props = $props()

  let shareModalRef: ShareProjectModal

  let deleteModalId = $derived(`delete-project-${project.id}`)
  let shareModalId = $derived(`share-project-${project.id}`)
  let updateProjectModal = $derived(`update-project-${project.id}`)

  const handleDelete = async () => {
    getModal(deleteModalId)?.open()
  }

  const handleDeleteConfirm = async () => {
    try {
      await deleteProject(project.id)
      getModal(deleteModalId).close()
      toastState.add({
        message: `Project "${project.name}" deleted successfully`,
        type: 'success',
      })
      if (currentProjectState.id === project.id) {
        currentProjectState.clear()
      }
      onDelete(project.id)
    } catch (error) {
      console.error('Error deleting project:', error)
      toastState.add({
        message: error.message || 'Failed to delete project',
        type: 'error',
      })
      getModal(deleteModalId).close()
    }
  }

  /**
   * Loads a remote graph into the local editor removing the edges that have type mismatches
   */
  const handleLoad = async () => {
    try {
      graphNavigationState.reset()
      const projectData = await getProject(project.id)
      const [validEdges, invalidEdges] = validateGraphData(projectData.graph)
      if (invalidEdges.length > 0) {
        invalidEdges.forEach((invalidEdge) => {
          toastState.add({
            message: invalidEdge.error,
            type: 'error',
          })
        })
      }

      const cleanedGraph = removeQualifiedIds(projectData.graph)
      const registeredNetworkNodes = await loadGraphFromProtocol(
        cleanedGraph.workflow.nodes,
        validEdges
      )
      if (registeredNetworkNodes.length > 0) {
        registeredNetworkNodes.forEach((nodeName) => {
          toastState.add({
            message: `Sub-graph node ${nodeName} was registered`,
            type: 'success',
          })
        })
      }
      currentProjectState.set(projectData)
      if (onLoad) {
        onLoad()
      }
      toastState.add({
        message: `Project "${project.name}" loaded successfully`,
        type: 'success',
      })
    } catch (error) {
      console.error('Error loading project:', error)
      toastState.add({
        message: error.message || 'Failed to load project',
        type: 'error',
      })
    }
  }

  const handleShareClick = async () => shareModalRef?.open()

  const getSharedUsers = () => project.shared_users?.map((u) => u.user_id) || []

  const handleShareSuccess = () => onShare()

  const handleEdit = async () => getModal(updateProjectModal)?.open()

  const handleEditSuccess = () => onEdit()
</script>

<div class="project-card">
  <div class="card-header">
    <h3>{project.name}</h3>
    <span class="project-id">ID: {project.id}</span>
  </div>

  <div class="card-body">
    <p class="description">{project.description}</p>

    <div class="metadata">
      <div class="meta-item">
        <strong>Owner:</strong>
        {project.owner.username}
      </div>
      <div class="meta-item">
        <strong>Updated:</strong>
        {new Date(project.updated_at).toLocaleDateString()}
      </div>
    </div>

    {#if project.shared_users?.length > 0}
      <div class="shared-users">
        <strong>Shared with:</strong>
        <ul>
          {#each project.shared_users as user (user.user_id)}
            <li>{user.username} ({user.permission_level})</li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>

  <div class="card-actions">
    <Button variant="delete" size="small" onclick={handleDelete}>Delete</Button>
    <div style="display: flex; gap: 0.75rem;">
      <Button variant="default" size="small" onclick={handleShareClick}
        >Share</Button
      >
      <Button variant="default" size="small" onclick={handleEdit}>Edit</Button>
      <Button variant="action" size="small" onclick={handleLoad}>Load</Button>
    </div>
  </div>
</div>

<ConfirmationModal
  modalId={deleteModalId}
  message={`Are you sure you want to delete project "${project.name}"?`}
  confirmText="Delete"
  confirmVariant="delete"
  onConfirm={handleDeleteConfirm}
/>

<ShareProjectModal
  bind:this={shareModalRef}
  projectId={project.id}
  projectName={project.name}
  modalId={shareModalId}
  getAlreadySharedUserIds={getSharedUsers}
  onShare={handleShareSuccess}
/>

<Modal id={updateProjectModal} size="sm">
  <EditProjectForm
    modalId={updateProjectModal}
    project={{
      id: project.id,
      name: project.name,
      description: project.description,
    }}
    onUpdate={handleEditSuccess}
  />
</Modal>

<style>
  .project-card {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--ternary-color);
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.5rem;
    padding-bottom: 0.5rem;
  }

  .card-header h3 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: bold;
  }

  .project-id {
    font-size: 0.85rem;
  }

  .card-body {
    margin-bottom: 1rem;
  }

  .description {
    margin: 0.75rem 0;
    line-height: 1.5;
    font-size: 0.95rem;
  }

  .metadata {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 1rem;
    padding-top: 0.75rem;
  }

  .meta-item {
    font-size: 0.9rem;
  }

  .meta-item strong {
    margin-right: 0.5rem;
  }

  .shared-users {
    margin-top: 1rem;
    padding-top: 0.75rem;
  }

  .shared-users strong {
    display: block;
    margin-bottom: 0.5rem;
    font-size: 0.9rem;
  }

  .shared-users ul {
    margin: 0;
    padding-left: 1.5rem;
    list-style-type: disc;
  }

  .shared-users li {
    font-size: 0.85rem;
    margin-bottom: 0.25rem;
  }

  .card-actions {
    margin-top: auto;
    display: flex;
    gap: 0.75rem;
    justify-content: space-between;
    padding-top: 0.75rem;
    border-top: 1px solid var(--ternary-color);
  }
</style>
