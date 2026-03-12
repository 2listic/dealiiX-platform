<script>
  import {
    settingsState,
    SSH_PATH,
    URL_VISUALIZER,
    URL_REMOTE_SERVER,
    USE_MPI,
  } from '../stores/settingsStore.svelte'
  import { toastState } from '../stores/toastsStore.svelte'
  import Button from './layout/Button.svelte'
  import { getModal } from './layout/Modal.svelte'

  let { modalId } = $props()

  let sshPath = $state(settingsState.getKey(SSH_PATH))
  let sshFiles = $state()
  let isEditingSshPath = $state(false)
  let urlVisualizer = $state(settingsState.getKey(URL_VISUALIZER))
  let isEditingVisualizer = $state(false)
  let urlRemoteServer = $state(settingsState.getKey(URL_REMOTE_SERVER))
  let isEditingRemote = $state(false)
  let useMpi = $state(settingsState.getKey(USE_MPI) ?? false)

  // Put here all the logic needed to reset the states when modal is re-opened.
  // Triggers when parent modal changes visibility.
  $effect(() => {
    const modal = getModal(modalId)
    if (modal?.isVisible()) {
      isEditingVisualizer = false
      isEditingSshPath = false
    }
  })

  const handleOnChangeFile = async () => {
    isEditingSshPath = false
    const file = sshFiles[0]
    if (!file) return
    sshPath = window.electron.getFilePath(file)
    await settingsState.setKey(SSH_PATH, sshPath)
    toastState.add({ message: 'SSH key absolute path updated' })
  }

  const saveVisualizerUrl = async () => {
    await settingsState.setKey(URL_VISUALIZER, urlVisualizer)
    isEditingVisualizer = false
    toastState.add({ message: 'URL Visualizer saved' })
  }

  const saveRemoteUrl = async () => {
    const urlRemoteServerParsed = urlRemoteServer.replace(/\/$/, '') // remove last '/' if present
    await settingsState.setKey(URL_REMOTE_SERVER, urlRemoteServerParsed)
    urlRemoteServer = urlRemoteServerParsed
    isEditingRemote = false
    toastState.add({ message: 'URL Remote Server saved' })
  }

  const toggleMpi = async () => {
    useMpi = !useMpi
    await settingsState.setKey(USE_MPI, useMpi)
    toastState.add({ message: `MPI ${useMpi ? 'enabled' : 'disabled'}` })
  }

  const closeModal = () => getModal(modalId).close()
</script>

<div style="padding: 0 1rem 1rem 1rem">
  <h2>Settings</h2>
  <div class="inputs-container">
    <div class="input-container">
      <label style="font-weight: bold" for="ssh-path-file">
        Path to private SSH key
      </label>
      <div class="input-line-save">
        <div>{sshPath}</div>
        {#if !isEditingSshPath}
          <Button onclick={() => (isEditingSshPath = true)}>Edit</Button>
        {:else}
          <Button onclick={() => (isEditingSshPath = false)}>Cancel</Button>
        {/if}
      </div>
      {#if isEditingSshPath}
        <input
          id="ssh-path-file"
          type="file"
          bind:files={sshFiles}
          onchange={handleOnChangeFile}
          placeholder="SSH path"
        />
      {/if}
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
          <Button onclick={saveVisualizerUrl}>Save</Button>
        </div>
      {:else}
        <div class="input-line-save">
          <div>{urlVisualizer ? urlVisualizer : 'No URL set'}</div>
          <Button onclick={() => (isEditingVisualizer = true)}>Edit</Button>
        </div>
      {/if}
    </div>
    <div class="input-container">
      <label style="font-weight: bold" for="url-remote-server">
        URL to Remote Server
      </label>
      {#if isEditingRemote}
        <div class="input-line-save">
          <!-- <form style="flex: 1"> -->
          <input
            id="url-remote-server"
            type="text"
            class="input-field"
            bind:value={urlRemoteServer}
            placeholder="Remote Server URL"
          />
          <!-- </form> -->
          <Button onclick={saveRemoteUrl}>Save</Button>
        </div>
      {:else}
        <div class="input-line-save">
          <div>{urlRemoteServer ? urlRemoteServer : 'No URL set'}</div>
          <Button onclick={() => (isEditingRemote = true)}>Edit</Button>
        </div>
      {/if}
    </div>
    <div class="input-container">
      <div class="input-line-save">
        <span style="font-weight: bold">Use MPI</span>
        <label class="switch">
          <input type="checkbox" checked={useMpi} onchange={toggleMpi} />
          <span class="slider round"></span>
        </label>
      </div>
    </div>
    <div class="button-container">
      <Button variant="default" type="button" onclick={closeModal}>Close</Button
      >
    </div>
  </div>
</div>

<style>
  h2 {
    margin: 1.5rem 0;
    text-align: center;
  }

  .inputs-container {
    display: flex;
    flex-direction: column;
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

  .switch {
    position: relative;
    display: inline-block;
    width: 48px;
    height: 27px;
  }

  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }

  .slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    transition: 0.4s;
  }

  .slider:before {
    position: absolute;
    content: '';
    height: 21px;
    width: 21px;
    left: 3px;
    bottom: 3px;
    background-color: white;
    transition: 0.4s;
  }

  input:checked + .slider {
    background-color: var(--button-action-bg);
  }

  input:checked + .slider:before {
    transform: translateX(21px);
  }

  .slider.round {
    border-radius: 27px;
  }

  .slider.round:before {
    border-radius: 50%;
  }

  .button-container {
    margin-top: 2vh;
  }
</style>
