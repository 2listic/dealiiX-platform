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
    <div class="inputs-container">
      <div class="input-container">
        <label for="mpi-nodes">Nodes</label>
        <input
          id="mpi-nodes"
          type="number"
          min="1"
          bind:value={nodes}
          class="input-field"
        />
      </div>
      <div class="input-container">
        <label for="mpi-tasks-per-node">Tasks per node</label>
        <input
          id="mpi-tasks-per-node"
          type="number"
          min="1"
          bind:value={tasksPerNode}
          class="input-field"
        />
      </div>
      <div class="input-container total">
        <span class="total-label">Total</span>
        <span class="total-value">{totalProcesses}</span>
      </div>
    </div>
    <div class="button-container">
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

  .inputs-container {
    display: flex;
    flex-direction: row;
    gap: 2vh;
    padding: 2vh 0;
  }

  .input-container {
    display: flex;
    flex-direction: column;
    gap: 1vh;
    flex: 1;
    min-width: 0;
  }

  .input-container label,
  .total-label {
    font-weight: bold;
  }

  .input-field {
    padding: 1vh;
    border: 1px solid var(--ternary-color);
    border-radius: 8px;
    font-size: 1rem;
    background: var(--secondary-color);
  }

  .total {
    border-left: 1px solid var(--ternary-color);
    padding-left: 2vh;
    flex: 0 0 auto;
  }

  .total-value {
    font-size: 1.1rem;
    font-weight: bold;
    color: var(--button-action-bg);
    padding: 1vh 0;
  }

  .button-container {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 1.5rem;
  }
</style>
