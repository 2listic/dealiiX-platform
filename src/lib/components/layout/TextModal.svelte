<script lang="ts">
  import Modal, { getModal } from './Modal.svelte'
  import Button from './Button.svelte'
  import { AnsiUp } from 'ansi_up'

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

  const ansiUp = new AnsiUp()

  // transform text with ANSI codes to HTML
  // if the message comes from an untrusted source, remember to sanitize it
  const htmlMessage = $derived(ansiUp.ansi_to_html(message))

  const handleClose = () => {
    getModal(modalId).close()
  }
</script>

<Modal id={modalId} {closeOnBackdrop} {size} {onClose}>
  <div class="text-modal">
    {#if title}
      <h2>{title}</h2>
    {/if}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    <div class="text-modal-content">{@html htmlMessage}</div>
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
    color: var(--code-text);
    background-color: var(--code-surface);
    white-space: pre-wrap;
    text-align: left;
    max-height: 60vh;
    overflow-y: auto;
    font-family: monospace;
    padding: 0.5rem;
    user-select: text;
    cursor: text;
  }

  .text-modal-actions {
    display: flex;
    justify-content: center;
    margin-top: 1.5rem;
  }
</style>
