<script lang="ts">
  import Modal, { getModal } from '../layout/Modal.svelte'
  import Button from '../layout/Button.svelte'
  import {
    DEFAULT_WORKING_FILE_REFERENCE,
    type WorkingFileReference,
  } from '../../types/nodeTypes'

  interface Props {
    modalId: string
    fileName: string
    currentMetadata?: WorkingFileReference
    onSave: (_metadata: WorkingFileReference) => void
  }

  let { modalId, fileName, currentMetadata, onSave }: Props = $props()

  let createIfMissing = $state(
    DEFAULT_WORKING_FILE_REFERENCE.create_if_missing ?? true
  )

  const resetForm = () => {
    createIfMissing =
      currentMetadata?.create_if_missing ??
      DEFAULT_WORKING_FILE_REFERENCE.create_if_missing ??
      true
  }

  $effect(() => {
    currentMetadata
    resetForm()
  })

  const save = () => {
    onSave({
      create_if_missing: createIfMissing,
    })
    getModal(modalId)?.close()
  }

  const cancel = () => {
    getModal(modalId)?.close()
  }
</script>

<Modal id={modalId} size="sm" onClose={resetForm}>
  <form
    class="working-file-form"
    onsubmit={(event) => {
      event.preventDefault()
      save()
    }}
  >
    <h2>Configure parameter file</h2>
    <p>
      <code>{fileName}</code> does not exist in the configured working directory.
      Choose whether the graph may create it when it runs.
    </p>

    <label class="checkbox-label">
      <input type="checkbox" bind:checked={createIfMissing} />
      Allow creation if missing
    </label>
    <span class="hint">
      If enabled, the first run gives the backend the working path so it can
      generate the file. Later runs open the generated parameter file directly.
    </span>

    <div class="button-container">
      <Button type="button" onclick={cancel}>Cancel</Button>
      <Button type="submit" variant="action">Save metadata</Button>
    </div>
  </form>
</Modal>

<style>
  .working-file-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  h2 {
    margin: 0;
  }

  p {
    margin: 0 0 0.5rem;
    line-height: 1.4;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.35rem;
  }

  .hint {
    font-size: 0.85rem;
    line-height: 1.4;
    opacity: 0.8;
  }

  .button-container {
    display: flex;
    justify-content: flex-end;
    gap: 0.6rem;
    margin-top: 0.75rem;
  }
</style>
