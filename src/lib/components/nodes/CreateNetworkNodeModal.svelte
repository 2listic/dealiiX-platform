<script lang="ts">
  import Modal, { getModal } from '../layout/Modal.svelte'
  import Button from '../layout/Button.svelte'
  import ConfirmationModal from '../layout/ConfirmationModal.svelte'
  import {
    addNetworkNode,
    getNodesSnapshot,
    getEdgesSnapshot,
    isNodeInNetworkNodes,
  } from '../../stores/nodes.svelte'
  import { toastState } from '../../stores/toastsStore.svelte'
  import { createNewNetworkNode } from '../../utils/networkNode'

  interface Props {
    modalId: string
    title?: string
    submitText?: string
    onCreate?: (_name: string) => Promise<void> | void
  }

  let {
    modalId,
    title = 'Create Network Node',
    submitText = 'Create',
    onCreate,
  }: Props = $props()

  let networkNodeName = $state('')
  const confirmModalId = 'confirm-override-network-node'

  const createNetworkNode = async () => {
    try {
      if (onCreate) {
        await onCreate(networkNodeName.trim())
      } else {
        const newNetworkNode = createNewNetworkNode(
          networkNodeName.trim(),
          getNodesSnapshot(),
          getEdgesSnapshot()
        )
        await addNetworkNode(networkNodeName.trim(), newNetworkNode)
      }

      toastState.add({
        message: `Network node "${networkNodeName.trim()}" created successfully`,
        type: 'success',
      })

      // Reset and close
      networkNodeName = ''
      getModal(modalId)?.close()
    } catch (error) {
      console.error('Failed to create network node:', error)
      toastState.add({
        message: error.message || 'Failed to create network node',
        type: 'error',
      })
    }
  }

  const handleCreate = () => {
    const name = networkNodeName.trim()
    if (!name) {
      toastState.add({
        message: 'Please enter a name for the network node',
        type: 'error',
      })
      return
    }

    // Check if network node with same name already exists
    if (isNodeInNetworkNodes(name)) {
      getModal(confirmModalId)?.open()
      return
    }
    createNetworkNode()
  }

  const handleConfirmOverride = () => {
    createNetworkNode()
  }

  const handleCancel = () => {
    networkNodeName = ''
    getModal(modalId)?.close()
  }
</script>

<Modal id={modalId} size="sm">
  <form
    class="create-network-node-form"
    onsubmit={(event) => {
      event.preventDefault()
      handleCreate()
    }}
  >
    <h2>{title}</h2>
    <label for="network-node-name-input">Network node name</label>
    <input
      id="network-node-name-input"
      type="text"
      bind:value={networkNodeName}
      placeholder="Enter network node name"
      class="input-field"
    />
    <div class="button-container">
      <Button type="button" variant="default" onclick={handleCancel}
        >Cancel</Button
      >
      <Button type="submit" variant="action">{submitText}</Button>
    </div>
  </form>
</Modal>

<ConfirmationModal
  modalId={confirmModalId}
  title="Network Node with the name '{networkNodeName.trim()}' Already Exists"
  message="Do you want to override it?"
  confirmText="Override"
  cancelText="Cancel"
  confirmVariant="action"
  onConfirm={handleConfirmOverride}
/>

<style>
  h2 {
    margin: 1.5rem 0;
    text-align: center;
  }

  .create-network-node-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .input-field {
    padding: 1vh;
    border: 1px solid var(--ternary-color);
    border-radius: 8px;
    font-size: 1rem;
    background: var(--secondary-color);
  }

  .button-container {
    margin-top: 2vh;
    display: flex;
    gap: 1vh;
    justify-content: flex-end;
  }
</style>
