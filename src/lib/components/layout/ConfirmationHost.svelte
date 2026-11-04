<!--
  Shows the app-wide confirmation dialog for `confirmAction`. Mounted once,
  last in App, so it stacks above a modal that asks for confirmation. Any
  close other than the confirm button answers "no".
-->
<script lang="ts">
  import ConfirmationModal from './ConfirmationModal.svelte'
  import { getModal } from './Modal.svelte'
  import { confirmationState } from '../../stores/confirmation.svelte'

  const modalId = 'confirm-action'

  $effect(() => {
    if (confirmationState.pending) getModal(modalId)?.open()
  })
</script>

<ConfirmationModal
  {modalId}
  title={confirmationState.request?.title}
  message={confirmationState.request?.message ?? ''}
  confirmText={confirmationState.request?.confirmText}
  confirmVariant={confirmationState.request?.confirmVariant}
  onConfirm={() => confirmationState.settle(true)}
  onClose={() => confirmationState.settle(false)}
/>
