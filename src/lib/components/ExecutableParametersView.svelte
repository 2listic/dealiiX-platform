<script lang="ts">
  import ParametersView from './ParametersView.svelte'
  import { parametersState } from '../stores/parametersStore.svelte'
  import { executionSelectionState } from '../stores/executionSelection.svelte'
  import { settingsState } from '../stores/settingsStore.svelte'

  let parameters = $derived(parametersState.value)
  let location = $derived(executionSelectionState.location)
  let parametersFileName = $derived(
    settingsState.getParametersFileName(location)
  )
</script>

<div class="executable-parameters">
  {#if parameters}
    <!-- Edits are kept right away: there is no file to save to until a run. -->
    <ParametersView
      {parameters}
      onChange={(next) => (parametersState.value = next)}
      onDirty={() => parametersState.persist()}
    />
    <div class="storage-hint">
      {location} · kept in the app, written to the run folder as {parametersFileName}
      when you run
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
    /* Keeps the last rows scrollable above the hint. */
    padding-bottom: 4rem;
  }

  .storage-hint {
    position: absolute;
    left: 1rem;
    bottom: 1rem;
    max-width: calc(100% - 2rem);
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
