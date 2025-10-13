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
  let formElement

  const handleOnChangeFile = () => {
    const file = sshFiles[0]
    // @ts-ignore
    sshPath = window.electron.getFilePath(file)
    settingsState.setKey(SSH_PATH, sshPath)
    toastState.add({ message: 'SSH key absolute path updated' })
  }

  // TODO: remove global save logic and introduce a per-single-setting save logic
  const validateAndClose = async () => {
    // Keep this validation logic for new inputs to be added in the future
    if (formElement.checkValidity()) {
      settingsState.setKey(URL_VISUALIZER, urlVisualizer)
      closeModal()
      toastState.add({ message: 'Settings saved' })
    } else {
      formElement.reportValidity()
    }
  }

  const closeModal = () => getModal(modalId).close()
</script>

<div style="padding: 0 1rem 1rem 1rem">
  <form
    bind:this={formElement}
    onsubmit={(e) => {
      e.preventDefault()
      validateAndClose()
    }}
  >
    <h2>Settings</h2>
    <div class="inputs-container">
      <div class="input-container">
        <label style="font-weight: bold" for="ssh-path-file">
          Path to SSH key
        </label>
        <div>{sshPath}</div>
        <input
          id="ssh-path-file"
          type="file"
          bind:files={sshFiles}
          onchange={handleOnChangeFile}
          placeholder="SSH path"
        />
      </div>
      <div class="input-container">
        <label style="font-weight: bold" for="url-vtk-visualizer">
          URL to VTK visualizer
        </label>
        <input
          id="url-vtk-visualizer"
          type="text"
          class="input-field"
          bind:value={urlVisualizer}
          placeholder="SSH path"
        />
      </div>
    </div>
    <div class="button-container">
      <button type="button" class="button-submit" onclick={validateAndClose}
        >Save</button
      >
    </div>
  </form>
</div>

<style>
  .inputs-container {
    display: flex;
    flex-direction: column;
    min-width: 50vh;
    gap: 1vh;
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

  .input-field {
    cursor: pointer;
    border: 1px solid var(--ternary-color);
    border-radius: 8px;
    padding: 1vh;
    font-size: 1rem;
    background-color: var(--secondary-color);
  }

  .input-field:invalid {
    border-color: red;
  }

  .button-container {
    margin-top: 3vh;
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
