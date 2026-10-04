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

  let fileScope = $state<WorkingFileReference['file_scope']>(
    DEFAULT_WORKING_FILE_REFERENCE.file_scope
  )
  let staging = $state<WorkingFileReference['staging']>(
    DEFAULT_WORKING_FILE_REFERENCE.staging
  )
  let createIfMissing = $state(
    DEFAULT_WORKING_FILE_REFERENCE.create_if_missing ?? true
  )

  const resetForm = () => {
    fileScope =
      currentMetadata?.file_scope ?? DEFAULT_WORKING_FILE_REFERENCE.file_scope
    staging = currentMetadata?.staging ?? DEFAULT_WORKING_FILE_REFERENCE.staging
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
      file_scope: fileScope,
      staging,
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
      Choose how it should be handled when the graph runs.
    </p>

    <label for={`${modalId}-scope`}>File scope</label>
    <select id={`${modalId}-scope`} bind:value={fileScope}>
      <option value="working">working</option>
    </select>

    <label for={`${modalId}-staging`}>Staging</label>
    <select id={`${modalId}-staging`} bind:value={staging}>
      <option value="copy">copy to the run directory</option>
    </select>

    <label class="checkbox-label">
      <input type="checkbox" bind:checked={createIfMissing} />
      Create the file if it is missing
    </label>
    <span class="hint">
      The default is <code>working / copy / true</code>. The first run gives the
      backend the absolute working path so it can generate the file; later runs
      stage it as a relative path.
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

  select {
    padding: 0.4rem;
    border: 1px solid var(--ternary-color);
    border-radius: 6px;
    background: var(--secondary-color);
    color: var(--ternary-color);
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
