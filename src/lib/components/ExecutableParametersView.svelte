<script lang="ts">
  import Button from './layout/Button.svelte'
  import ParametersView from './ParametersView.svelte'
  import { parametersState } from '../stores/parametersStore.svelte'
  import { executionSelectionState } from '../stores/executionSelection.svelte'
  import { settingsState } from '../stores/settingsStore.svelte'
  import {
    reloadParametersFromWorkingDirectory,
    saveParametersToWorkingDirectory,
  } from '../utils/parametersFileActions'

  let parameters = $derived(parametersState.value)
  let location = $derived(executionSelectionState.location)
  let parametersFileName = $derived(
    settingsState.getParametersFileName(location)
  )
  let busy = $state(false)

  const run = async (action: () => Promise<void>) => {
    busy = true
    try {
      await action()
    } finally {
      busy = false
    }
  }
</script>

<div class="executable-parameters">
  {#if parameters}
    <!-- Edits are kept in the app right away; Save only writes the file. -->
    <ParametersView
      {parameters}
      onChange={(next) => (parametersState.value = next)}
      onEdit={() => parametersState.persist()}
    />
    <div class="parameters-footer">
      <div class="parameters-actions">
        <Button
          variant="action"
          size="small"
          disabled={busy}
          onclick={() => run(saveParametersToWorkingDirectory)}
        >
          Save
        </Button>
        <Button
          size="small"
          disabled={busy}
          onclick={() => run(reloadParametersFromWorkingDirectory)}
        >
          Reload
        </Button>
      </div>
      <div class="storage-hint">
        {location} · values are kept in the app and written to the run folder as
        {parametersFileName} when you run. Save overwrites {parametersFileName} in
        the working directory; Reload reads it back.
      </div>
    </div>
  {:else}
    <div class="empty-state">
      <div class="empty-state-copy">
        <strong>No backend template synced yet</strong>
        <span>
          Save the executable configuration from Settings to probe the backend
          and load its parameters template.
        </span>
      </div>
    </div>
  {/if}
</div>

<style>
  .executable-parameters {
    position: relative;
    width: 100%;
    height: 100%;
    background-color: var(--background-color);
    color: var(--ternary-color);
  }

  .executable-parameters :global(.parameters-view) {
    box-sizing: border-box;
    /* Keeps the last rows scrollable above the footer. */
    padding-bottom: 8rem;
  }

  .parameters-footer {
    position: absolute;
    left: 1rem;
    right: 1rem;
    bottom: 1rem;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
    pointer-events: none;
  }

  .parameters-actions {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem;
    border-radius: 62rem;
    background: var(--surface-color);
    box-shadow: 0 0.2rem 0.8rem
      color-mix(in srgb, var(--ternary-color) 8%, transparent);
  }

  .storage-hint {
    pointer-events: auto;
    max-width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    background: var(--surface-color);
    font-size: 0.8rem;
    opacity: 0.8;
  }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
  }

  .empty-state-copy {
    max-width: 28rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    text-align: center;
    padding: 1rem;
  }
</style>
