<script lang="ts">
  import Button from './layout/Button.svelte'
  import { getModal } from './layout/Modal.svelte'

  type Props = {
    modalId: string
    workingDirectory: string
    files: string[]
    loading: boolean
    importing: boolean
    error: string
    onRefresh: () => void | Promise<void>
    onSelect: (_fileName: string) => void | Promise<void>
  }

  let {
    modalId,
    workingDirectory,
    files,
    loading,
    importing,
    error,
    onRefresh,
    onSelect,
  }: Props = $props()

  const close = () => getModal(modalId)?.close()
</script>

<div class="remote-file-picker">
  <h2>Import graph from remote</h2>
  <p class="description">
    Select a graph JSON file from the remote working directory.
  </p>
  <code class="working-directory">{workingDirectory || '(not configured)'}</code
  >

  {#if loading}
    <p class="status">Loading remote files...</p>
  {:else if error}
    <p class="status error">{error}</p>
  {:else if files.length === 0}
    <p class="status">No JSON graph files found in this directory.</p>
  {:else}
    <div class="file-list" role="listbox" aria-label="Remote graph files">
      {#each files as fileName (fileName)}
        <button
          class="file-row"
          type="button"
          disabled={importing}
          onclick={() => onSelect(fileName)}
        >
          <span>{fileName}</span>
          <span class="file-kind">JSON</span>
        </button>
      {/each}
    </div>
  {/if}

  <div class="actions">
    <Button onclick={onRefresh} disabled={loading || importing}>Refresh</Button>
    <Button onclick={close} disabled={importing}>Cancel</Button>
  </div>
</div>

<style>
  .remote-file-picker {
    min-width: min(52vw, 720px);
    padding: 1rem;
  }

  h2 {
    margin: 0 0 0.75rem;
  }

  .description {
    margin: 0 0 0.5rem;
  }

  .working-directory {
    display: block;
    margin-bottom: 1rem;
    overflow-wrap: anywhere;
    color: var(--ternary-color);
  }

  .status {
    padding: 2rem 1rem;
    text-align: center;
    color: var(--ternary-color);
  }

  .status.error {
    color: var(--button-delete-bg);
  }

  .file-list {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    max-height: 50vh;
    overflow-y: auto;
  }

  .file-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    width: 100%;
    padding: 0.65rem 0.8rem;
    border: 1px solid transparent;
    border-radius: 6px;
    background: var(--primary-color);
    color: var(--ternary-color);
    cursor: pointer;
    text-align: left;
  }

  .file-row:hover:not(:disabled) {
    border-color: var(--border-color-hover);
  }

  .file-row:disabled {
    cursor: wait;
    opacity: 0.55;
  }

  .file-kind {
    flex: 0 0 auto;
    font-size: 0.75rem;
    opacity: 0.7;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1rem;
  }
</style>
