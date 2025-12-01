<script lang="ts">
  import { deleteProject, getProject } from '../requests/projects'
  import { toastState } from '../stores/toastsStore.svelte'
  import { loadGraph } from '../stores/nodes.svelte'
  import Button from './layout/Button.svelte'
  import { currentProjectState } from '../stores/currentProjectStore.svelte'
  import Modal, { getModal } from './layout/Modal.svelte'

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
    // eslint-disable-next-line no-unused-vars
    onDelete: (projectId: number) => void
    onLoad: () => void
  }

  let { project, onDelete, onLoad }: Props = $props()

  const deleteModalId = `delete-project-${project.id}`

  const handleDelete = async () => {
    getModal(deleteModalId)?.open()
  }

  const confirmDelete = async () => {
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
      if (onDelete) {
        onDelete(project.id)
      }
    } catch (error) {
      console.error('Error deleting project:', error)
      toastState.add({
        message: error.message || 'Failed to delete project',
        type: 'error',
      })
      getModal(deleteModalId).close()
    }
  }

  const cancelDelete = () => {
    getModal(deleteModalId).close()
  }

  const handleLoad = async () => {
    try {
      const projectData = await getProject(project.id)
      currentProjectState.set(projectData)

      const result = loadGraph(projectData.graph)
      if (!result.success) {
        toastState.add({ message: result.error, type: 'error' })
        return
      }
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
    <Button variant="action" size="small" onclick={handleLoad}>Load</Button>
    <Button variant="delete" size="small" onclick={handleDelete}>Delete</Button>
  </div>
</div>
<!-- Delete Confirmation Modal -->
<Modal id={deleteModalId} closeOnBackdrop={true} size="sm">
  <div class="delete-confirmation">
    <p>Are you sure you want to delete project "{project.name}"?</p>
    <div class="confirmation-actions">
      <Button size="small" onclick={cancelDelete}>Cancel</Button>
      <Button variant="delete" size="small" onclick={confirmDelete}
        >Delete</Button
      >
    </div>
  </div>
</Modal>

<style>
  .project-card {
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
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    padding-top: 0.75rem;
    border-top: 1px solid var(--ternary-color);
  }

  .delete-confirmation {
    text-align: center;
    padding: 1rem;
  }

  .delete-confirmation p {
    margin: 0.5rem 0;
  }

  .confirmation-actions {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 1.5rem;
  }
</style>
