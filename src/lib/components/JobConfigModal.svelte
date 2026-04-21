<script lang="ts">
  import Modal, { getModal } from './layout/Modal.svelte'
  import Button from './layout/Button.svelte'
  import type { JobConfig } from '../utils/sshMessages'
  import { parametersState } from '../stores/parametersStore.svelte'
  import { settingsState } from '../stores/settingsStore.svelte'

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
  let uploadGraph = $state(true)
  let uploadParameters = $state(false)
  let hasParameters = $derived(parametersState.value !== null)
  let execution = $derived(settingsState.current.execution)
  let isExecutableMode = $derived(execution.backendKind === 'executable')
  let isRemoteExecution = $derived(execution.location === 'remote')
  let showSchedulerFields = $derived(isRemoteExecution)
  let showEffectiveMpiFields = $derived(showMpiFields && !isExecutableMode)
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
      uploadGraph: isExecutableMode ? false : uploadGraph,
      uploadParameters: isExecutableMode ? true : uploadParameters,
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
    <h2>Job Configuration</h2>
    <div class="inputs-container">
      {#if showEffectiveMpiFields}
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
      {#if showSchedulerFields}
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
    <hr />
    <div class="toggle-container">
      {#if isExecutableMode}
        <div class="hint-message">
          The executable will run with the current parameters file. Graph upload
          is disabled in this mode.
        </div>
        {#if !hasParameters}
          <div class="hint-message hint-message--error">
            Synchronize the executable settings first to generate a parameters
            template.
          </div>
        {/if}
      {:else}
        <label class="toggle-label">
          <input type="checkbox" bind:checked={uploadGraph} />
          <span>Upload Graph</span>
        </label>
        <label class="toggle-label">
          <input
            type="checkbox"
            bind:checked={uploadParameters}
            disabled={!hasParameters}
            title={hasParameters
              ? 'Upload parameters file'
              : 'Load a parameters file first'}
          />
          <span class:disabled={!hasParameters}>Upload Parameters</span>
        </label>
      {/if}
    </div>
    <div class="button-container">
      <Button type="button" size="small" onclick={handleCancel}>Cancel</Button>
      <Button
        type="submit"
        variant="action"
        size="small"
        disabled={!!timeLimitError || (isExecutableMode && !hasParameters)}
      >
        Execute
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

  hr {
    border: none;
    border-top: 1px solid var(--ternary-color);
    margin: 1rem 0 0;
  }

  .toggle-container {
    display: flex;
    gap: 2rem;
    padding: 1rem 0;
  }

  .toggle-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-weight: bold;
  }

  .toggle-label input[type='checkbox'] {
    width: 1.25rem;
    height: 1.25rem;
    cursor: pointer;
  }

  .toggle-label .disabled {
    opacity: 0.5;
  }

  .button-container {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 1.5rem;
  }
</style>
