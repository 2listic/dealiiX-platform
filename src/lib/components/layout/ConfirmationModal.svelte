<!--
  Shows the app-wide confirmation dialog for `confirmAction` and
  `chooseAction`. Mounted once, last in App, so it stacks above a modal that
  asks for confirmation. Any close other than the two action buttons answers
  "cancel".
-->
<script lang="ts">
  import Modal, { getModal } from './Modal.svelte'
  import Button from './Button.svelte'
  import { onMount } from 'svelte'
  import {
    confirmationState,
    type ConfirmationAnswer,
  } from '../../stores/confirmation.svelte'

  const modalId = 'confirm-action'
  const request = $derived(confirmationState.request)

  // A waiting request opens the dialog.
  $effect(() => {
    if (confirmationState.pending) getModal(modalId)?.open()
  })

  const respond = (answer: ConfirmationAnswer) => {
    confirmationState.answer(answer)
    getModal(modalId)?.close()
  }

  onMount(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const modal = getModal(modalId)
      if (event.key === 'Enter' && modal?.isVisible()) {
        event.preventDefault()
        respond('confirm')
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  })
</script>

<!-- ×, Escape and the backdrop answer "cancel"; after a button it does nothing, as nothing waits any more. -->
<Modal
  id={modalId}
  onClose={() => confirmationState.answer('cancel')}
  size="sm"
>
  <div class="confirmation-modal">
    {#if request?.title}
      <h2>{request.title}</h2>
    {/if}
    <p>{request?.message}</p>
    <div class="confirmation-actions">
      <Button size="small" onclick={() => respond('cancel')}>
        {request?.cancelText ?? 'Cancel'}
      </Button>
      {#if request?.alternativeText}
        <Button
          variant="action"
          size="small"
          onclick={() => respond('alternative')}
        >
          {request.alternativeText}
        </Button>
      {/if}
      <Button
        variant={request?.confirmVariant ?? 'default'}
        size="small"
        onclick={() => respond('confirm')}
      >
        {request?.confirmText ?? 'Confirm'}
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
