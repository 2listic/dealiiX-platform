<script lang="ts">
  import { getProjects } from '../requests/projects'
  import ProjectCard from './ProjectCard.svelte'
  import { toastState } from '../stores/toastsStore.svelte'
  import { getModal } from './layout/Modal.svelte'
  import Button from './layout/Button.svelte'

  let { modalId }: { modalId: string } = $props()

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
        message: 'Failed to load projects',
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
</script>

<div class="projects-container">
  <div class="header">
    <h2>Projects</h2>
    <Button onclick={loadProjects} variant="action">Refresh</Button>
  </div>

  {#if isLoading}
    <div class="loading">Loading projects...</div>
  {:else if projects.length === 0}
    <div class="empty">No projects found</div>
  {:else}
    <div class="projects-list">
      {#each projects as project (project.id)}
        <ProjectCard {project} />
      {/each}
    </div>
  {/if}

  <div class="button-container">
    <Button onclick={closeModal}>Close</Button>
  </div>
</div>

<style>
  .projects-container {
    padding: 1rem;
    min-width: 60vw;
    max-height: 80vh;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .projects-list {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 1rem;
    overflow-y: auto;
    max-height: 60vh;
  }

  /* ... more styles ... */
</style>
