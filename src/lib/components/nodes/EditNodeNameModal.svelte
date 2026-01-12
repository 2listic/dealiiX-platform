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

  const { updateNodeData } = useSvelteFlow()

  const handleSave = () => {
    updateNodeData(nodeId, { name: editedName })
    getModal(modalId)?.close()
  }

  const handleCancel = () => {
    getModal(modalId)?.close()
  }
</script>

<Modal id={modalId} size="lg">
  <div class="edit-node-form">
    <h3>Edit Node Name</h3>
    <input
      type="text"
      bind:value={editedName}
      placeholder="Enter node name"
      class="name-input"
    />
    <div class="form-actions">
      <Button variant="default" onclick={handleCancel}>Cancel</Button>
      <Button variant="action" onclick={handleSave}>Save</Button>
    </div>
  </div>
</Modal>

<style>
  .edit-node-form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .edit-node-form h3 {
    margin: 0;
    font-size: 1.25rem;
  }

  .name-input {
    padding: 0.5rem;
    font-size: 1rem;
    border: 1px solid var(--ternary-color);
    border-radius: 4px;
    background: var(--background-color-secondary);
    color: var(--text-color);
  }

  .form-actions {
    display: flex;
    gap: 0.75rem;
    justify-content: flex-end;
    margin-top: 0.5rem;
  }
</style>
