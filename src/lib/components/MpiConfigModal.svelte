<script lang="ts">
  import Modal, { getModal } from './layout/Modal.svelte'
  import Button from './layout/Button.svelte'
  import type { MpiConfig } from '../utils/sshMessages'

  interface Props {
    modalId: string
    // underscore-prefixed arg name to avoid eslint no-unused-vars error in interfaces
    onConfirm: (_config: MpiConfig) => void
  }

  let { modalId, onConfirm }: Props = $props()

  let nodes = $state(1)
  let tasksPerNode = $state(4)
  let totalProcesses = $derived(nodes * tasksPerNode)

  const handleConfirm = () => {
    onConfirm({ nodes, tasksPerNode })
    getModal(modalId).close()
  }

  const handleCancel = () => {
    getModal(modalId).close()
  }
</script>

<Modal id={modalId} size="sm">
  <div class="mpi-config">
    <h2>MPI Configuration</h2>
    <div class="fields">
      <div class="field">
        <label for="mpi-nodes">Nodes</label>
        <input
          id="mpi-nodes"
          type="number"
          min="1"
          bind:value={nodes}
          class="input-field"
        />
      </div>
      <div class="field">
        <label for="mpi-tasks-per-node">Tasks per node</label>
        <input
          id="mpi-tasks-per-node"
          type="number"
          min="1"
          bind:value={tasksPerNode}
          class="input-field"
        />
      </div>
      <div class="field total">
        <span>Total MPI processes</span>
        <span class="total-value">{totalProcesses}</span>
      </div>
    </div>
    <div class="actions">
      <Button size="small" onclick={handleCancel}>Cancel</Button>
      <Button variant="action" size="small" onclick={handleConfirm}>
        Execute
      </Button>
    </div>
  </div>
</Modal>

<style>
  .mpi-config {
    padding: 1rem;
  }

  .mpi-config h2 {
    margin: 0 0 1.5rem 0;
    text-align: center;
  }

  .fields {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .field {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
  }

  .field label,
  .field span {
    font-weight: bold;
  }

  .input-field {
    border: 1px solid var(--ternary-color);
    border-radius: 8px;
    padding: 0.5rem;
    font-size: 1rem;
    background-color: var(--secondary-color);
    width: 80px;
    text-align: center;
  }

  .total {
    border-top: 1px solid var(--ternary-color);
    padding-top: 1rem;
  }

  .total-value {
    font-size: 1.1rem;
    color: var(--button-action-bg);
    min-width: 80px;
    text-align: center;
  }

  .actions {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 1.5rem;
  }
</style>
