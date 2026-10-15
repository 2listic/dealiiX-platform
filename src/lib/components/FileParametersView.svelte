<script lang="ts">
  import Button from './layout/Button.svelte'
  import ParametersView from './ParametersView.svelte'
  import { parameterNodeEditorState } from '../stores/parameterNodeEditor.svelte'
  import { toastState } from '../stores/toastsStore.svelte'
  import type { ParameterExposure } from '../types/nodeTypes'
  import { staleParameterEdges } from '../utils/parameterNodeCanvas'

  let document = $derived(parameterNodeEditorState.document)

  const save = async () => {
    try {
      await parameterNodeEditorState.save()
      toastState.add({ message: 'Parameters saved', type: 'success' })
    } catch (error) {
      toastState.add({
        message:
          error instanceof Error ? error.message : 'Failed to save parameters',
        type: 'error',
      })
    }
  }

  const changeExposures = (next: ParameterExposure[]): boolean => {
    if (!document) return false
    const removed = staleParameterEdges(document.nodeId, next).length
    if (
      removed > 0 &&
      !window.confirm(
        `This removes ${removed} ${removed === 1 ? 'connection' : 'connections'} from the graph. Continue?`
      )
    ) {
      return false
    }
    parameterNodeEditorState.updateExposures(next)
    return true
  }

  const backToGraph = () => {
    if (
      document?.edited &&
      !window.confirm(
        'Discard unsaved parameter changes and return to the graph?'
      )
    ) {
      return
    }
    parameterNodeEditorState.close()
  }
</script>

<div class="parameter-editor">
  {#if document}
    <div class="editor-content">
      <ParametersView
        parameters={document.parameters}
        exposures={document.exposures}
        onExposureChange={changeExposures}
        onChange={(next) => parameterNodeEditorState.replaceParameters(next)}
        onEdit={() => parameterNodeEditorState.markEdited()}
      />
    </div>
    <div class="editor-footer">
      <div class="editor-actions">
        <Button
          variant="action"
          size="small"
          disabled={document.saving}
          onclick={save}
        >
          {document.saving ? 'Saving…' : 'Save'}
        </Button>
        <Button size="small" onclick={backToGraph}>Back to graph</Button>
      </div>
      <div class="editor-info">
        <span class="file-location" title={document.resolvedPath}>
          {document.target.location} · {document.resolvedPath}
        </span>
        <span>
          Values are saved to this file with Save. Exposed inputs and outputs
          change the graph immediately and can be undone from the graph.
        </span>
      </div>
    </div>
  {:else}
    <div class="editor-loading">Opening parameters…</div>
  {/if}
</div>

<style>
  .parameter-editor {
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    background: var(--background-color);
    color: var(--ternary-color);
  }

  .editor-content {
    min-height: 0;
    flex: 1;
  }

  .editor-content :global(.parameters-view) {
    box-sizing: border-box;
    height: 100%;
    /* Keeps the last rows scrollable above the footer. */
    padding-bottom: 8rem;
  }

  .editor-footer {
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

  .editor-actions {
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

  .editor-info {
    pointer-events: auto;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    max-width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: 0.5rem;
    background: var(--surface-color);
    font-size: 0.8rem;
  }

  .file-location {
    overflow: hidden;
    font-family: monospace;
    text-overflow: ellipsis;
    white-space: nowrap;
    opacity: 0.7;
  }

  .editor-loading {
    display: grid;
    height: 100%;
    place-items: center;
  }
</style>
