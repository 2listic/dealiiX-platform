<script lang="ts">
  import { updateProject } from '../requests/projects'
  import { toastState } from '../stores/toastsStore.svelte'
  import Button from './layout/Button.svelte'
  import { getModal } from './layout/Modal.svelte'

  interface ProjectEdit {
    id: number
    name: string
    description: string
  }

  let {
    modalId,
    project,
    onUpdate,
  }: {
    modalId: string
    project: ProjectEdit
    onUpdate: () => void
  } = $props()

  let name = $state(project.name)
  let description = $state(project.description)
  let formElement

  const validateAndSubmit = async () => {
    if (!formElement.checkValidity()) {
      formElement.reportValidity()
      return
    }

    try {
      await updateProject(project.id, {
        name: name,
        description: description,
      })

      toastState.add({ message: 'Project saved successfully', type: 'success' })
      name = ''
      description = ''
      onUpdate()
      getModal(modalId)?.close()
    } catch (error) {
      console.error('Failed to update project:', error)
      toastState.add({
        message: error.message || 'Failed to update project',
        type: 'error',
      })
    }
  }

  const handleCancel = () => {
    getModal(modalId)?.close()
  }
</script>

<div style="padding: 1rem">
  <form bind:this={formElement}>
    <h2>Edit Project</h2>
    <div class="inputs-container">
      <div class="input-container">
        <label for="project-name">Project Name</label>
        <input
          id="project-name"
          class="input-field"
          type="text"
          bind:value={name}
          placeholder="Enter project name"
          required
        />
      </div>
      <div class="input-container">
        <label for="project-description">Description</label>
        <textarea
          id="project-description"
          class="input-field"
          bind:value={description}
          placeholder="Enter project description"
          rows="3"
        ></textarea>
      </div>
    </div>
    <div class="button-container">
      <Button variant="default" type="button" onclick={handleCancel}>
        Cancel
      </Button>
      <Button variant="action" type="button" onclick={validateAndSubmit}>
        Update
      </Button>
    </div>
  </form>
</div>

<style>
  .inputs-container {
    display: flex;
    flex-direction: column;
    gap: 2vh;
  }

  .input-container {
    display: flex;
    flex-direction: column;
    gap: 1vh;
  }

  .button-container {
    margin-top: 2vh;
    display: flex;
    gap: 1vh;
    justify-content: flex-end;
  }

  .input-field {
    padding: 1vh;
    border: 1px solid var(--ternary-color);
    border-radius: 8px;
    font-size: 1rem;
    background: var(--secondary-color);
  }

  .input-field:invalid {
    border-color: red;
  }

  textarea.input-field {
    resize: vertical;
  }
</style>
