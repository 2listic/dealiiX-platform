<script>
  import { saveProject } from '../requests/projects'
  import { getEdges, getNodes } from '../stores/nodes.svelte'
  import { toastState } from '../stores/toastsStore.svelte'
  import { currentProjectState } from '../stores/currentProjectStore.svelte'
  import { parseGraph } from '../utils/graphParser'
  import Button from './layout/Button.svelte'
  import { getModal } from './layout/Modal.svelte'

  let { modalId } = $props()

  let name = $state('')
  let description = $state('')
  let formElement

  const validateAndSubmit = async () => {
    if (!formElement.checkValidity()) {
      formElement.reportValidity()
      return
    }

    try {
      const parsedGraph = parseGraph(getNodes(), getEdges())
      const savedProject = await saveProject({
        name,
        description:
          description || 'Graph created on ' + new Date().toISOString(),
        graph: parsedGraph,
      })
      currentProjectState.set(savedProject)

      toastState.add({ message: 'Project saved successfully', type: 'success' })
      name = ''
      description = ''
      getModal(modalId)?.close()
    } catch (error) {
      console.error('Failed to save project:', error)
      toastState.add({
        message: error.message || 'Failed to save project',
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
    <h2>Save Project</h2>
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
        Save
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
