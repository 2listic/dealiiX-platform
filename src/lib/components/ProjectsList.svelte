<script lang="ts">
  import { getProjects } from '../requests/projects'
  import ProjectCard from './ProjectCard.svelte'
  import { toastState } from '../stores/toastsStore.svelte'
  import Modal, { getModal } from './layout/Modal.svelte'
  import Button from './layout/Button.svelte'
  import SaveProjectForm from './SaveProjectForm.svelte'

  let { modalId }: { modalId: string } = $props()

  const newProjectModalId = 'new-project-modal'

  let projects = $state([])
  let isLoading = $state(false)

  // Load projects when modal opens
  $effect(() => {
    const modal = getModal(modalId)
    if (modal?.isVisible()) {
      loadProjects()
    }
  })

  async function loadProjects() {
    isLoading = true

    try {
      const result = await getProjects()
      projects = result

      if (!projects || projects.length === 0) {
        toastState.add({
          message: 'No projects found',
          type: 'info',
        })
      }
    } catch (err) {
      toastState.add({
        message: err.message || 'Failed to load projects',
        type: 'error',
      })
      console.error('Error loading projects:', err)
      closeModal()
    } finally {
      isLoading = false
    }
  }

  function closeModal() {
    getModal(modalId)?.close()
  }

  function handleNewProject() {
    getModal(newProjectModalId).open()
  }

  function handleProjectDeleted(projectId: number) {
    projects = projects.filter((p) => p.id !== projectId)
  }

  function handleProjectCreated() {
    loadProjects()
  }
</script>

<div class="projects-container">
  <div class="header">
    <h2>Projects</h2>
    <Button onclick={handleNewProject} variant="action">New Project</Button>
  </div>

  {#if isLoading}
    <div class="loading">Loading projects...</div>
  {:else if projects.length === 0}
    <div class="empty">No projects found</div>
  {:else}
    <div class="projects-list">
      {#each projects as project (project.id)}
        <ProjectCard
          {project}
          onDelete={handleProjectDeleted}
          onLoad={closeModal}
        />
      {/each}
    </div>
  {/if}

  <div class="button-container">
    <Button onclick={loadProjects} variant="action">Refresh</Button>
    <Button onclick={closeModal}>Close</Button>
  </div>
</div>

<Modal id={newProjectModalId} size="sm">
  <SaveProjectForm
    modalId={newProjectModalId}
    onCreate={handleProjectCreated}
  />
</Modal>

<style>
  .projects-container {
    padding: 1rem;
    min-width: 60vw;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
  }

  .loading,
  .empty {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 3rem;
    font-size: 1.1rem;
    font-style: italic;
  }

  .projects-list {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    overflow-y: auto;
    max-height: 60vh;
    padding-right: 0.5rem;
  }

  .projects-list::-webkit-scrollbar {
    width: 8px;
  }

  .projects-list::-webkit-scrollbar-track {
    background: var(--primary-color);
    border-radius: 4px;
  }

  .projects-list::-webkit-scrollbar-thumb {
    background: var(--secondary-color);
    border-radius: 4px;
    opacity: 0.5;
  }

  .projects-list::-webkit-scrollbar-thumb:hover {
    cursor: pointer;
  }

  .button-container {
    display: flex;
    justify-content: space-between;
    margin-top: 1rem;
    padding-top: 1rem;
  }
</style>
