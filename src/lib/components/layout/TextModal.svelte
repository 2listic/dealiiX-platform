<script lang="ts">
  import Modal, { getModal } from './Modal.svelte'
  import Button from './Button.svelte'

  interface Props {
    modalId: string
    message: string
    title?: string
    size?: 'sm' | 'md' | 'lg'
    buttonText?: string
    onClose?: () => void
    closeOnBackdrop?: boolean
  }

  let {
    modalId,
    message,
    title,
    size = 'md',
    buttonText = 'OK',
    onClose,
    closeOnBackdrop = true,
  }: Props = $props()

  const handleClose = () => {
    if (onClose) {
      onClose()
    }
    getModal(modalId).close()
  }
</script>

<Modal id={modalId} {closeOnBackdrop} {size}>
  <div class="text-modal">
    {#if title}
      <h2>{title}</h2>
    {/if}
    <div class="text-modal-content">{message}</div>
    <div class="text-modal-actions">
      <Button size="small" onclick={handleClose}>{buttonText}</Button>
    </div>
  </div>
</Modal>

<style>
  .text-modal {
    padding: 1rem;
  }

  .text-modal h2 {
    margin: 0 0 1rem 0;
    text-align: center;
  }

  .text-modal-content {
    white-space: pre-wrap;
    text-align: left;
    max-height: 60vh;
    overflow-y: auto;
    font-family: monospace;
    padding: 0.5rem;
    background-color: var(--background-color);
    border-radius: 4px;
    user-select: text;
    cursor: text;
  }

  .text-modal-actions {
    display: flex;
    justify-content: center;
    margin-top: 1.5rem;
  }
</style>
