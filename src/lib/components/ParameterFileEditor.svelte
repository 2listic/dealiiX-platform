<script lang="ts">
  import Button from './layout/Button.svelte'
  import ParametersView from './ParametersView.svelte'
  import { parameterFileEditorState } from '../stores/parameterFileEditor.svelte'
  import { toastState } from '../stores/toastsStore.svelte'

  let document = $derived(parameterFileEditorState.document)

  const save = async () => {
    try {
      await parameterFileEditorState.save()
      toastState.add({ message: 'Parameters saved', type: 'success' })
    } catch (error) {
      toastState.add({
        message:
          error instanceof Error ? error.message : 'Failed to save parameters',
        type: 'error',
      })
    }
  }

  const backToGraph = () => {
    if (
      document?.dirty &&
      !window.confirm(
        'Discard unsaved parameter changes and return to the graph?'
      )
    ) {
      return
    }
    parameterFileEditorState.close()
  }
</script>

<div class="parameter-editor">
  {#if document}
    <div class="editor-toolbar">
      <div class="editor-heading">
        <strong>Parameters</strong>
        <span title={document.resolvedPath}>{document.target.fileName}</span>
      </div>
      <div class="editor-actions">
        <Button
          variant="action"
          size="small"
          disabled={!document.dirty || document.saving}
          onclick={save}
        >
          {document.saving ? 'Saving…' : 'Save'}
        </Button>
        <Button size="small" onclick={backToGraph}>Back to graph</Button>
      </div>
    </div>
    <div class="editor-content">
      <ParametersView
        parameters={document.parameters}
        onChange={(next) => parameterFileEditorState.replaceParameters(next)}
        onDirty={() => parameterFileEditorState.markDirty()}
      />
    </div>
  {:else}
    <div class="editor-loading">Opening parameters…</div>
  {/if}
</div>

<style>
  .parameter-editor {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: var(--background-color);
    color: var(--ternary-color);
  }

  .editor-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--border-color);
    background: var(--primary-color);
  }

  .editor-heading,
  .editor-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .editor-heading span {
    font-family: monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .editor-content {
    min-height: 0;
    flex: 1;
  }

  .editor-content :global(.parameters-view) {
    height: 100%;
  }

  .editor-loading {
    display: grid;
    height: 100%;
    place-items: center;
  }
</style>
