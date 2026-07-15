<script lang="ts">
  import Modal, { getModal } from './layout/Modal.svelte'
  import Button from './layout/Button.svelte'
  import type {
    CoralJobConfig,
    ExecutableJobConfig,
  } from '../utils/sshMessages'
  import {
    exportAndEvalCoralGraph,
    exportAndEvalExecutable,
  } from '../utils/sshMessages'
  import { getNodesSnapshot, getEdgesSnapshot } from '../stores/nodes.svelte'
  import { parametersState } from '../stores/parametersStore.svelte'
  import { settingsState } from '../stores/settingsStore.svelte'
  import { toastState } from '../stores/toastsStore.svelte'
  import { isValidSlurmTime, SLURM_TIME_HINT } from '../utils/slurmTime'

  interface Props {
    modalId: string
  }

  let { modalId }: Props = $props()

  let nodes = $state(1)
  let tasksPerNode = $state(4)
  let timeLimit = $state('01:00:00')
  let useMpi = $state(false)
  let runName = $state('')
  // Writable derived: pre-filled from settings, temporarily overridable per run.
  // Resets to the stored value automatically if settings change.
  let parametersFileName = $derived(settingsState.activeParametersFileName)
  let hasParameters = $derived(parametersState.value !== null)
  let isExecutableMode = $derived(settingsState.isExecutableMode)
  let isCoralMode = $derived(settingsState.isCoralMode)
  let isRemoteExecution = $derived(
    settingsState.execution.location === 'remote'
  )
  let totalProcesses = $derived(nodes * tasksPerNode)

  let timeLimitError = $derived(
    isValidSlurmTime(timeLimit) ? '' : SLURM_TIME_HINT
  )

  const handleConfirm = () => {
    // Block runs for a mode that was never validated — switching mode no longer
    // probes, so the paths/payload for this combination may be unset.
    const { location, backendKind } = settingsState.execution
    if (!settingsState.getProbe(location, backendKind)?.ok) {
      toastState.add({
        message: `Configuration for ${location}/${backendKind} is not validated — open Settings and Validate & Sync.`,
        type: 'error',
      })
      return
    }

    getModal(modalId)?.close()

    // Settings are read once, at this UI boundary, and flow in as explicit args.
    // The submit primitives no longer fall back to settingsState — the config is
    // the complete, serializable argument bag for the run.
    const target = isRemoteExecution
      ? settingsState.remote
      : settingsState.local

    // Close first so the modal doesn't block the UI during the long-running job.
    const trimmedRunName = runName.trim() || undefined

    const run = isExecutableMode
      ? exportAndEvalExecutable(
          {
            executablePath: target.executablePath,
            parametersFileName,
          } satisfies ExecutableJobConfig,
          trimmedRunName
        )
      : exportAndEvalCoralGraph(
          getNodesSnapshot(),
          getEdgesSnapshot(),
          {
            coralBinaryPath: target.coralBinaryPath,
            coralPluginPath: target.coralPluginPath,
            nodes,
            tasksPerNode,
            timeLimit,
            useMpi,
          } satisfies CoralJobConfig,
          trimmedRunName
        )

    run.catch((error) => {
      console.error('Failed to execute graph:', error)
      toastState.add({
        message: error.message || 'Failed to execute graph',
        type: 'error',
      })
    })
  }

  const handleCancel = () => {
    getModal(modalId)?.close()
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
    <div class="inputs-container">
      <div class="input-container">
        <label for="run-name">Run name (optional)</label>
        <input
          id="run-name"
          type="text"
          bind:value={runName}
          class="input-field"
          placeholder="e.g. poisson-convergence"
        />
        <span class="hint-message">
          Used to name the run's output folder; left blank keeps the default
          timestamp name
        </span>
      </div>
    </div>
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
    {#if isExecutableMode && hasParameters}
      <div class="inputs-container">
        <div class="input-container">
          <label for="parameters-file-name">Parameters file</label>
          <input
            id="parameters-file-name"
            type="text"
            bind:value={parametersFileName}
            class="input-field"
            placeholder="parameters.json"
          />
          <span class="hint-message"
            >Extension determines format: .json or .prm</span
          >
        </div>
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
    background-color: var(--slider-bg);
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
