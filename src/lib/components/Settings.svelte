<script>
  import { settingsState, SSH_PATH } from '../stores/settingsStore.svelte'
  import { toastState } from '../stores/toastsStore.svelte'
  import { getModal } from './layout/Modal.svelte'

  let { modalId } = $props()

  let sshPath = $state(settingsState.getKey(SSH_PATH))
  let sshFiles = $state()
  let formElement

  const handleOnChangeFile = () => {
    const file = sshFiles[0]
    // @ts-ignore
    sshPath = window.electron.getFilePath(file)
    settingsState.setKey(SSH_PATH, sshPath)
    toastState.add({ message: 'SSH key absolute path updated' })
  }

  const validateAndClose = async () => {
    // Keep this validation logic for new inputs to be added in the future
    if (formElement.checkValidity()) {
      getModal(modalId).close()
      // toastState.add({ message: 'Settings saved' })
    } else {
      formElement.reportValidity()
    }
  }
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
        <div style="font-weight: bold">Private SSH key</div>
        <label for="ssh-path-file">Select SSH key</label>
        <input
          id="ssh-path-file"
          class="input-field"
          type="file"
          bind:files={sshFiles}
          onchange={handleOnChangeFile}
          placeholder="SSH path"
        />
      </div>
      <div class="input-container">
        <label for="ssh-path-text">Absolute path</label>
        <input
          id="ssh-path-text"
          class="input-field"
          type="text"
          bind:value={sshPath}
          placeholder="SSH path"
          readonly
          required
        />
      </div>
    </div>
    <div class="button-container">
      <button type="button" class="button-submit" onclick={validateAndClose}
        >Close</button
      >
    </div>
  </form>
</div>

<style>
  .inputs-container {
    display: flex;
    flex-direction: column;
    min-width: 50vh;
  }

  .input-container {
    display: flex;
    flex-direction: column;
    gap: 1vh;
    padding-top: 1vh;
  }

  .button-container {
    margin-top: 3vh;
  }

  .input-field {
    padding: 1vh;
    border: 1px solid var(--ternary-color);
    border-radius: 8px;
    font-size: 1rem;
    background: var(--secondary-color);
  }

  .input-field:invalid {
    border-color: red;
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
