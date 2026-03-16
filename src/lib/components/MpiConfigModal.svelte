<script lang="ts">
  import Modal, { getModal } from './layout/Modal.svelte'
  import Button from './layout/Button.svelte'
  import type { JobConfig } from '../utils/sshMessages'

  interface Props {
    modalId: string
    showMpiFields: boolean
    // underscore-prefixed arg name to avoid eslint no-unused-vars error in interfaces
    onConfirm: (_config: JobConfig) => void
  }

  let { modalId, showMpiFields, onConfirm }: Props = $props()

  let nodes = $state(1)
  let tasksPerNode = $state(4)
  let timeLimit = $state('01:00:00')
  let totalProcesses = $derived(nodes * tasksPerNode)

  // Slurm --time accepted formats: minutes | minutes:seconds | hours:minutes:seconds
  // | days-hours | days-hours:minutes | days-hours:minutes:seconds | 0
  // See: https://slurm.schedmd.com/sbatch.html#OPT_time
  const SLURM_TIME_PATTERN =
    /^(\d+|\d+:\d{2}(:\d{2})?|\d+-\d{2}(:\d{2}(:\d{2})?)?)$/
  let timeLimitError = $derived(
    SLURM_TIME_PATTERN.test(timeLimit)
      ? ''
      : 'Use: minutes, minutes:seconds, HH:MM:SS, D-HH, D-HH:MM, D-HH:MM:SS'
  )

  const handleConfirm = () => {
    onConfirm({ nodes, tasksPerNode, timeLimit })
    getModal(modalId).close()
  }

  const handleCancel = () => {
    getModal(modalId).close()
  }
</script>

<Modal id={modalId} size="sm">
  <div class="mpi-config">
    <h2>Job Configuration</h2>
    <div class="inputs-container">
      {#if showMpiFields}
        <div class="inputs-row">
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
      {/if}
      <div class="inputs-row">
        <div class="input-container time-limit">
          <label for="mpi-time-limit">Time limit</label>
          <input
            id="mpi-time-limit"
            type="text"
            placeholder="e.g. 01:00:00"
            bind:value={timeLimit}
            class="input-field"
            class:input-field--error={timeLimitError}
          />
          <span class="hint-message" class:hint-message--error={timeLimitError}>
            {timeLimitError || 'Use 0 for no time limit'}
          </span>
        </div>
      </div>
    </div>
    <div class="button-container">
      <Button size="small" onclick={handleCancel}>Cancel</Button>
      <Button
        variant="action"
        size="small"
        onclick={handleConfirm}
        disabled={!!timeLimitError}
      >
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
    flex-direction: column;
    gap: 1vh;
    padding: 2vh 0;
  }

  .inputs-row {
    display: flex;
    flex-direction: row;
    gap: 2vh;
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

  .input-field--error {
    border-color: var(--error-color, #e53935);
  }

  .hint-message {
    font-size: 0.8rem;
    color: var(--ternary-color);
  }

  .hint-message--error {
    color: var(--error-color, #e53935);
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

  .time-limit {
    flex: 0 1 auto;
    min-width: 10rem;
    max-width: 16rem;
  }

  .button-container {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 1.5rem;
  }
</style>
