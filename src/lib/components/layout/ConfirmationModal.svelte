<script lang="ts">
  import Modal, { getModal } from './Modal.svelte'
  import Button from './Button.svelte'
  import { onMount } from 'svelte'

  interface Props {
    modalId: string
    title?: string
    message: string
    confirmText?: string
    cancelText?: string
    confirmVariant?: 'default' | 'action' | 'delete'
    onConfirm: () => void
    onCancel?: () => void
    closeOnBackdrop?: boolean
  }

  let {
    modalId,
    title,
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    confirmVariant = 'default',
    onConfirm,
    onCancel,
    closeOnBackdrop = true,
  }: Props = $props()

  const handleConfirm = () => {
    onConfirm()
    getModal(modalId)?.close()
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    }
    getModal(modalId)?.close()
  }

  onMount(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const modal = getModal(modalId)
      if (event.key === 'Enter' && modal?.isVisible()) {
        event.preventDefault()
        handleConfirm()
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  })
</script>

<Modal id={modalId} {closeOnBackdrop} size="sm">
  <div class="confirmation-modal">
    {#if title}
      <h2>{title}</h2>
    {/if}
    <p>{message}</p>
    <div class="confirmation-actions">
      <Button size="small" onclick={handleCancel}>{cancelText}</Button>
      <Button variant={confirmVariant} size="small" onclick={handleConfirm}>
        {confirmText}
      </Button>
    </div>
  </div>
</Modal>

<style>
  .confirmation-modal {
    text-align: center;
    padding: 1rem;
  }

  .confirmation-modal h2 {
    margin: 0 0 1rem 0;
  }

  .confirmation-modal p {
    margin: 0.5rem 0;
  }

  .confirmation-actions {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 1.5rem;
  }
</style>
