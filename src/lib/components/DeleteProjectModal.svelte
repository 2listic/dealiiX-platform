<script lang="ts">
  import { deleteProject } from '../requests/projects'
  import { toastState } from '../stores/toastsStore.svelte'
  import { currentProjectState } from '../stores/currentProjectStore.svelte'
  import Button from './layout/Button.svelte'
  import Modal, { getModal } from './layout/Modal.svelte'

  interface Props {
    projectId: number
    projectName: string
    modalId: string
    onConfirm: () => void
  }

  let { projectId, projectName, modalId, onConfirm }: Props = $props()

  const handleConfirm = async () => {
    try {
      await deleteProject(projectId)
      getModal(modalId).close()
      toastState.add({
        message: `Project "${projectName}" deleted successfully`,
        type: 'success',
      })
      if (currentProjectState.id === projectId) {
        currentProjectState.clear()
      }
      onConfirm()
    } catch (error) {
      console.error('Error deleting project:', error)
      toastState.add({
        message: error.message || 'Failed to delete project',
        type: 'error',
      })
      getModal(modalId).close()
    }
  }

  const handleCancel = () => {
    getModal(modalId).close()
  }
</script>

<Modal id={modalId} closeOnBackdrop={true} size="sm">
  <div class="delete-confirmation">
    <p>Are you sure you want to delete project "{projectName}"?</p>
    <div class="confirmation-actions">
      <Button size="small" onclick={handleCancel}>Cancel</Button>
      <Button variant="delete" size="small" onclick={handleConfirm}>
        Delete
      </Button>
    </div>
  </div>
</Modal>

<style>
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
