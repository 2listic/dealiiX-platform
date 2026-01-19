<script lang="ts">
  import Modal, { getModal } from '../layout/Modal.svelte'
  import Button from '../layout/Button.svelte'
  import {
    createNewNetworkNode,
    addNetworkNode,
  } from '../../stores/nodes.svelte'
  import { toastState } from '../../stores/toastsStore.svelte'

  interface Props {
    modalId: string
  }

  let { modalId }: Props = $props()

  let networkNodeName = $state('')

  const handleCreate = () => {
    if (!networkNodeName.trim()) {
      toastState.add({
        message: 'Please enter a name for the network node',
        type: 'error',
      })
      return
    }

    try {
      const newNetworkNode = createNewNetworkNode(networkNodeName.trim())
      const key = `${networkNodeName.trim()}_${Date.now()}`
      addNetworkNode(key, newNetworkNode)

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
