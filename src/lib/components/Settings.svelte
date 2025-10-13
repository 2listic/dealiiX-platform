<script>
  import {
    settingsState,
    SSH_PATH,
    URL_VISUALIZER,
  } from '../stores/settingsStore.svelte'
  import { toastState } from '../stores/toastsStore.svelte'
  import { getModal } from './layout/Modal.svelte'

  let { modalId } = $props()

  let sshPath = $state(settingsState.getKey(SSH_PATH))
  let sshFiles = $state()
  let urlVisualizer = $state(settingsState.getKey(URL_VISUALIZER))
  let isEditingVisualizer = $state(false)

  // Put here all the logic needed to reset the states when modal is re-opened.
  // Triggers when parent modal changes visibility.
  $effect(() => {
    const modal = getModal(modalId)
    if (modal?.isVisible()) {
      isEditingVisualizer = false
    }
  })

  const handleOnChangeFile = () => {
    const file = sshFiles[0]
    // @ts-ignore
    sshPath = window.electron.getFilePath(file)
    settingsState.setKey(SSH_PATH, sshPath)
    toastState.add({ message: 'SSH key absolute path updated' })
  }

  const saveVisualizerUrl = () => {
    settingsState.setKey(URL_VISUALIZER, urlVisualizer)
    isEditingVisualizer = false
    toastState.add({ message: 'URL Visualizer saved' })
  }

  const closeModal = () => getModal(modalId).close()
</script>

<div style="padding: 0 1rem 1rem 1rem">
  <h2>Settings</h2>
  <div class="inputs-container">
    <div class="input-container">
      <label style="font-weight: bold" for="ssh-path-file">
        Path to SSH key
      </label>
      <div>{sshPath}</div>
      <form>
        <input
          id="ssh-path-file"
          type="file"
          bind:files={sshFiles}
          onchange={handleOnChangeFile}
          placeholder="SSH path"
        />
      </form>
    </div>
    <div class="input-container">
      <label style="font-weight: bold" for="url-vtk-visualizer">
        URL to VTK visualizer
      </label>
      {#if isEditingVisualizer}
        <div class="input-line-save">
          <!-- <form style="flex: 1"> -->
          <input
            id="url-vtk-visualizer"
            type="text"
            class="input-field"
            bind:value={urlVisualizer}
            placeholder="Visualizer URL"
          />
          <!-- </form> -->
          <button
            type="button"
            class="button-submit"
            onclick={saveVisualizerUrl}>Save</button
          >
        </div>
      {:else}
        <div class="input-line-save">
          <div>{urlVisualizer}</div>
          <button
            type="button"
            class="button-submit"
            onclick={() => (isEditingVisualizer = true)}>Edit</button
          >
        </div>
      {/if}
    </div>
    <div class="button-container">
      <button type="button" class="button-submit" onclick={closeModal}
        >Close</button
      >
    </div>
  </div>
</div>

<style>
  .inputs-container {
    display: flex;
    flex-direction: column;
    min-width: 50vh;
    gap: 2vh;
  }

  .input-container {
    display: flex;
    flex-direction: column;
    gap: 1vh;
    padding-top: 1vh;
  }

  #ssh-path-file {
    cursor: pointer;
  }

  .input-line-save {
    display: flex;
    gap: 1vh;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  .input-field {
    cursor: pointer;
    border: 1px solid var(--ternary-color);
    border-radius: 8px;
    padding: 1vh;
    font-size: 1rem;
    background-color: var(--secondary-color);
    flex: 1;
  }

  .input-field:invalid {
    border-color: red;
  }

  .button-container {
    margin-top: 2vh;
  }

  .button-submit {
    cursor: pointer;
    border: 1px solid var(--ternary-color);
    border-radius: 8px;
    padding: 1vh;
    font-size: 1rem;
    background-color: var(--secondary-color);
  }

  .button-submit:hover {
    border-color: var(--border-color-hover);
  }
</style>
