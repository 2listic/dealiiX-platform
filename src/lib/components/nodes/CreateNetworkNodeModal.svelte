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
  }

  let { modalId }: Props = $props()

  let networkNodeName = $state('')
  const confirmModalId = 'confirm-override-network-node'

  const createNetworkNode = async (name: string) => {
    try {
      const newNetworkNode = createNewNetworkNode(
        name,
        getNodesSnapshot(),
        getEdgesSnapshot()
      )
      await addNetworkNode(name, newNetworkNode)

      toastState.add({
        message: `Network node "${name}" created successfully`,
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
    createNetworkNode(name)
  }

  const handleConfirmOverride = () => {
    createNetworkNode(networkNodeName)
  }

  const handleCancel = () => {
    networkNodeName = ''
    getModal(modalId)?.close()
  }
</script>

<Modal id={modalId} size="sm">
  <div class="create-network-node-form">
    <h2>Create Network Node</h2>
    <label for="network-node-name-input">Network node name</label>
    <input
      id="network-node-name-input"
      type="text"
      bind:value={networkNodeName}
      placeholder="Enter network node name"
      class="input-field"
    />
    <div class="button-container">
      <Button variant="default" onclick={handleCancel}>Cancel</Button>
      <Button variant="action" onclick={handleCreate}>Create</Button>
    </div>
  </div>
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
