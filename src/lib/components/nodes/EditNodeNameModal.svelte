<script lang="ts">
  import Modal, { getModal } from '../layout/Modal.svelte'
  import Button from '../layout/Button.svelte'
  import { useSvelteFlow } from '@xyflow/svelte'

  interface Props {
    modalId: string
    nodeId: string
    currentName: string
  }

  let { modalId, nodeId, currentName }: Props = $props()

  let editedName = $derived(currentName)
  let inputId = $derived(`edit-node-name-input-${nodeId}`)

  const { updateNodeData } = useSvelteFlow()

  const handleSave = () => {
    updateNodeData(nodeId, { name: editedName })
    getModal(modalId)?.close()
  }

  const handleCancel = () => {
    // reset the name to the original value and close
    editedName = currentName
    getModal(modalId)?.close()
  }
</script>

<Modal id={modalId} size="lg">
  <form
    class="edit-node-form"
    onsubmit={(event) => {
      event.preventDefault()
      handleSave()
    }}
  >
    <h2>Edit Node {nodeId}</h2>
    <label for={inputId}>Network node name</label>
    <input
      id={inputId}
      type="text"
      bind:value={editedName}
      placeholder="Enter node name"
      class="input-field"
    />
    <div class="button-container">
      <Button type="button" variant="default" onclick={handleCancel}
        >Cancel</Button
      >
      <Button type="submit" variant="action">Save</Button>
    </div>
  </form>
</Modal>

<style>
  .edit-node-form {
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
