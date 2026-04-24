<script lang="ts">
  import Modal, { getModal } from './layout/Modal.svelte'
  import Button from './layout/Button.svelte'
  import type { JobConfig } from '../utils/sshMessages'
  import { parametersState } from '../stores/parametersStore.svelte'
  import { settingsState } from '../stores/settingsStore.svelte'

  interface Props {
    modalId: string
    // underscore-prefixed arg name to avoid eslint no-unused-vars error in interfaces
    onConfirm: (_config: JobConfig) => void
  }

  let { modalId, onConfirm }: Props = $props()

  let nodes = $state(1)
  let tasksPerNode = $state(4)
  let timeLimit = $state('01:00:00')
  let useMpi = $state(false)
  let hasParameters = $derived(parametersState.value !== null)
  let isExecutableMode = $derived(settingsState.isExecutableMode)
  let isCoralMode = $derived(settingsState.isCoralMode)
  let isRemoteExecution = $derived(
    settingsState.execution.location === 'remote'
  )
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
    onConfirm({
      nodes,
      tasksPerNode,
      timeLimit,
      useMpi: isExecutableMode ? false : useMpi,
    })
    getModal(modalId).close()
  }

  const handleCancel = () => {
    getModal(modalId).close()
  }
</script>

<Modal id={modalId} size="sm">
  <form
    class="job-config"
    onsubmit={(event) => {
      event.preventDefault()
      if (!timeLimitError) {
        handleConfirm()
      }
    }}
  >
    <h2>Run job</h2>
    {#if isCoralMode && (useMpi || isRemoteExecution)}
      <div class="inputs-container">
        {#if useMpi}
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
        {#if isRemoteExecution}
          <div class="inputs-row">
            <div class="input-container time-limit">
              <label for="job-time-limit">Time limit</label>
              <input
                id="job-time-limit"
                type="text"
                placeholder="e.g. 01:00:00"
                bind:value={timeLimit}
                class="input-field"
                class:input-field--error={timeLimitError}
              />
              <span
                class="hint-message"
                class:hint-message--error={timeLimitError}
              >
                {timeLimitError || 'Use 0 for no time limit'}
              </span>
            </div>
          </div>
        {/if}
      </div>
    {/if}
    {#if isExecutableMode && !hasParameters}
      <div class="hint-message">
        Synchronize the executable settings first to generate a parameters
        template.
      </div>
    {/if}
    {#if isCoralMode}
      <div class="toggle-container">
        <div class="mpi-row">
          <span class="toggle-label">Use MPI</span>
          <label class="switch">
            <input type="checkbox" bind:checked={useMpi} />
            <span class="slider round"></span>
          </label>
        </div>
      </div>
    {/if}
    <div class="button-container">
      <Button type="button" size="small" onclick={handleCancel}>Cancel</Button>
      <Button
        type="submit"
        variant="action"
        size="small"
        disabled={!!timeLimitError || (isExecutableMode && !hasParameters)}
      >
        Run
      </Button>
    </div>
  </form>
</Modal>

<style>
  .job-config {
    padding: 1rem;
  }

  .job-config h2 {
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
    /* font-size: 0.8rem; */
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

  .toggle-container {
    display: flex;
    gap: 2rem;
    padding: 1rem 0;
  }

  .toggle-label {
    font-weight: bold;
  }

  .mpi-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .switch {
    position: relative;
    display: inline-block;
    width: 48px;
    height: 27px;
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    transition: 0.4s;
  }

  .slider:before {
    position: absolute;
    content: '';
    height: 21px;
    width: 21px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.4s;
  }

  input:checked + .slider {
    background-color: var(--button-action-bg);
  }

  input:checked + .slider:before {
    transform: translateX(21px);
  }

  .slider.round {
    border-radius: 27px;
  }

  .slider.round:before {
    border-radius: 50%;
  }

  .button-container {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 1.5rem;
  }
</style>
