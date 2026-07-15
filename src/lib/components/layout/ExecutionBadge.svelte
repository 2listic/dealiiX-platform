<script lang="ts">
  import {
    EXECUTION_LOCATIONS,
    BACKEND_KINDS,
    type ExecutionLocation,
    type BackendKind,
  } from '../../types/settingsTypes'
  import { settingsState } from '../../stores/settingsStore.svelte'
  import { viewModeState } from '../../stores/viewModeStore.svelte'
  import { switchLocation, switchMode } from '../../utils/settingsActions'

  // Two orthogonal-ish selectors: location, and mode (backend kind + pipeline view).
  let location = $derived(settingsState.execution.location)
  let mode = $derived(
    viewModeState.value === 'pipeline'
      ? 'pipeline'
      : settingsState.execution.backendKind
  )

  const onLocationChange = (event: Event) => {
    const value = (event.currentTarget as HTMLSelectElement)
      .value as ExecutionLocation
    void switchLocation(value)
  }

  const onModeChange = (event: Event) => {
    const value = (event.currentTarget as HTMLSelectElement).value as
      | BackendKind
      | 'pipeline'
    void switchMode(value)
  }
</script>

<div class="execution-badge">
  <select
    class="badge-select"
    aria-label="Execution location"
    value={location}
    onchange={onLocationChange}
  >
    {#each EXECUTION_LOCATIONS as loc (loc)}
      <!-- pipeline runs remotely only, so local is unavailable in pipeline mode -->
      <option value={loc} disabled={loc === 'local' && mode === 'pipeline'}>
        {loc}
      </option>
    {/each}
  </select>
  <span class="badge-sep">·</span>
  <select
    class="badge-select"
    aria-label="Execution mode"
    value={mode}
    onchange={onModeChange}
  >
    {#each BACKEND_KINDS as kind (kind)}
      <option value={kind}>{kind}</option>
    {/each}
    <!-- pipeline requires remote, so it is unavailable while location is local -->
    <option value="pipeline" disabled={location === 'local'}>pipeline</option>
  </select>
</div>

<style>
  .execution-badge {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.25rem 0.65rem;
    border-radius: 62rem;
    background: var(--primary-color);
    border: 1px solid color-mix(in srgb, var(--ternary-color) 30%, transparent);
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--ternary-color);
    white-space: nowrap;
  }

  .badge-select {
    appearance: none;
    background: transparent;
    border: none;
    color: inherit;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    padding: 0 0.1rem;
  }

  .badge-select:hover {
    color: var(--border-color-hover);
  }

  .badge-select:focus-visible {
    outline: 1px solid var(--border-color-hover);
    border-radius: 4px;
  }

  /* Dropdown list items render in the native menu — give them a readable base. */
  .badge-select option {
    background: var(--primary-color);
    color: var(--ternary-color);
  }

  .badge-sep {
    opacity: 0.45;
  }
</style>
