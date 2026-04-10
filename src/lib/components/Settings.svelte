<script>
  import {
    BACKEND_KINDS,
    EXECUTION_LOCATIONS,
    cloneSettings,
  } from '../config/execution'
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
  let localCoralBinaryFiles = $state()
  let localCoralPluginFiles = $state()
  let isEditingLocalCoralBinaryPath = $state(false)
  let isEditingLocalCoralPluginPath = $state(false)
  let localExecutableFiles = $state()
  let localWorkingDirectoryFiles = $state()
  let isEditingLocalExecutablePath = $state(false)
  let isEditingLocalWorkingDirectory = $state(false)
  let urlVisualizer = $state(settingsState.getKey(URL_VISUALIZER))
  let isEditingVisualizer = $state(false)
  let urlRemoteServer = $state(settingsState.getKey(URL_REMOTE_SERVER))
  let isEditingRemote = $state(false)
  let useMpi = $state(settingsState.getKey(USE_MPI) ?? false)
  let executionLocation = $state(settingsState.current.execution.location)
  let backendKind = $state(settingsState.current.execution.backendKind)
  let remoteHost = $state(settingsState.current.execution.remote.host)
  let remotePort = $state(settingsState.current.execution.remote.port)
  let remoteUsername = $state(settingsState.current.execution.remote.username)
  let remoteWorkingDirectory = $state(
    settingsState.current.execution.remote.workingDirectory
  )
  let remoteCoralBinaryPath = $state(
    settingsState.current.execution.remote.coralBinaryPath
  )
  let remoteCoralPluginPath = $state(
    settingsState.current.execution.remote.coralPluginPath
  )
  let localWorkingDirectory = $state(
    settingsState.current.execution.local.workingDirectory
  )
  let localCoralBinaryPath = $state(
    settingsState.current.execution.local.coralBinaryPath
  )
  let localCoralPluginPath = $state(
    settingsState.current.execution.local.coralPluginPath
  )
  let localExecutablePath = $state(
    settingsState.current.execution.local.executablePath
  )
  let localExecutableParametersFileName = $state(
    settingsState.current.execution.local.parametersFileName
  )
  let remoteExecutablePath = $state(
    settingsState.current.execution.remote.executablePath
  )
  let remoteExecutableParametersFileName = $state(
    settingsState.current.execution.remote.parametersFileName
  )
  let isSavingExecution = $derived(settingsState.saving)
  let showRemoteSettings = $derived(executionLocation === 'remote')
  let showCoralSettings = $derived(backendKind === 'coral')
  let showExecutableSettings = $derived(backendKind === 'executable')

  // Put here all the logic needed to reset the states when modal is re-opened.
  // Triggers when parent modal changes visibility.
  $effect(() => {
    const modal = getModal(modalId)
    if (modal?.isVisible()) {
      isEditingVisualizer = false
      isEditingSshPath = false
      isEditingLocalCoralBinaryPath = false
      isEditingLocalCoralPluginPath = false
      isEditingLocalExecutablePath = false
      isEditingLocalWorkingDirectory = false
      const currentSettings = settingsState.current
      executionLocation = currentSettings.execution.location
      backendKind = currentSettings.execution.backendKind
      remoteHost = currentSettings.execution.remote.host
      remotePort = currentSettings.execution.remote.port
      remoteUsername = currentSettings.execution.remote.username
      remoteWorkingDirectory = currentSettings.execution.remote.workingDirectory
      remoteCoralBinaryPath = currentSettings.execution.remote.coralBinaryPath
      remoteCoralPluginPath = currentSettings.execution.remote.coralPluginPath
      localWorkingDirectory = currentSettings.execution.local.workingDirectory
      localCoralBinaryPath = currentSettings.execution.local.coralBinaryPath
      localCoralPluginPath = currentSettings.execution.local.coralPluginPath
      localExecutablePath = currentSettings.execution.local.executablePath
      localExecutableParametersFileName =
        currentSettings.execution.local.parametersFileName
      remoteExecutablePath = currentSettings.execution.remote.executablePath
      remoteExecutableParametersFileName =
        currentSettings.execution.remote.parametersFileName
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

  const cancelSshPathEdit = () => {
    isEditingSshPath = false
    sshFiles = undefined
  }

  const handleOnChangeLocalCoralBinaryFile = () => {
    isEditingLocalCoralBinaryPath = false
    const file = localCoralBinaryFiles?.[0]
    if (!file) return
    localCoralBinaryPath = window.electron.getFilePath(file)
  }

  const cancelLocalCoralBinaryPathEdit = () => {
    isEditingLocalCoralBinaryPath = false
    localCoralBinaryFiles = undefined
  }

  const handleOnChangeLocalCoralPluginFile = () => {
    isEditingLocalCoralPluginPath = false
    const file = localCoralPluginFiles?.[0]
    if (!file) return
    localCoralPluginPath = window.electron.getFilePath(file)
  }

  const cancelLocalCoralPluginPathEdit = () => {
    isEditingLocalCoralPluginPath = false
    localCoralPluginFiles = undefined
  }

  const handleOnChangeLocalExecutableFile = () => {
    isEditingLocalExecutablePath = false
    const file = localExecutableFiles?.[0]
    if (!file) return
    localExecutablePath = window.electron.getFilePath(file)
  }

  const cancelLocalExecutablePathEdit = () => {
    isEditingLocalExecutablePath = false
    localExecutableFiles = undefined
  }

  const extractDirectoryPath = (file) => {
    const filePath = window.electron.getFilePath(file)
    return filePath.replace(/[/\\][^/\\]+$/, '')
  }

  const handleOnChangeLocalWorkingDirectory = () => {
    const file = localWorkingDirectoryFiles?.[0]
    isEditingLocalWorkingDirectory = false
    if (!file) return
    localWorkingDirectory = extractDirectoryPath(file)
  }

  const cancelLocalWorkingDirectoryEdit = () => {
    isEditingLocalWorkingDirectory = false
    localWorkingDirectoryFiles = undefined
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

  const saveAndSyncExecution = async () => {
    const draft = cloneSettings(settingsState.current)
    draft.execution.location = executionLocation
    draft.execution.backendKind = backendKind
    draft.execution.remote.host = remoteHost
    draft.execution.remote.port = Number(remotePort)
    draft.execution.remote.username = remoteUsername
    draft.execution.remote.workingDirectory = remoteWorkingDirectory
    draft.execution.remote.coralBinaryPath = remoteCoralBinaryPath
    draft.execution.remote.coralPluginPath = remoteCoralPluginPath
    draft.execution.remote.executablePath = remoteExecutablePath
    draft.execution.remote.parametersFileName =
      remoteExecutableParametersFileName
    draft.execution.remote.sshKeyPath = sshPath
    draft.execution.local.workingDirectory = localWorkingDirectory
    draft.execution.local.coralBinaryPath = localCoralBinaryPath
    draft.execution.local.coralPluginPath = localCoralPluginPath
    draft.execution.local.executablePath = localExecutablePath
    draft.execution.local.parametersFileName =
      localExecutableParametersFileName
    draft.urlVisualizer = urlVisualizer
    draft.urlRemoteServer = urlRemoteServer
    draft.useMpi = useMpi

    const result = await settingsState.finalizeDraft(draft)
    if (!result?.ok) {
      toastState.add({
        message: result?.message || 'Configuration probe failed',
        type: 'error',
      })
      return
    }

    toastState.add({
      message: result.message || 'Execution settings saved',
      type: 'success',
    })

    for (const warning of result.warnings ?? []) {
      toastState.add({
        message: warning,
        type: 'info',
      })
    }
  }

  const closeModal = () => getModal(modalId).close()
</script>

<div style="padding: 0 1rem 1rem 1rem">
  <h2>Settings</h2>
  <div class="inputs-container">
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
    <div class="input-container execution-section">
      <div style="font-weight: bold">Execution Mode</div>
      <div class="radio-group">
        {#each EXECUTION_LOCATIONS as location (location)}
          <label class="radio-option">
            <input
              type="radio"
              name="execution-location"
              checked={executionLocation === location}
              onchange={() => (executionLocation = location)}
            />
            <span>{location}</span>
          </label>
        {/each}
      </div>
      <div class="radio-group">
        {#each BACKEND_KINDS as kind (kind)}
          <label class="radio-option">
            <input
              type="radio"
              name="backend-kind"
              checked={backendKind === kind}
              onchange={() => (backendKind = kind)}
            />
            <span>{kind}</span>
          </label>
        {/each}
      </div>
      {#if showRemoteSettings}
        <div class="subsection">
          <div class="subsection-title">Remote host</div>
          <div class="execution-grid">
            <label class="field">
              <span>Host</span>
              <input bind:value={remoteHost} class="input-field" type="text" />
            </label>
            <label class="field">
              <span>Port</span>
              <input
                bind:value={remotePort}
                class="input-field"
                type="number"
              />
            </label>
            <label class="field">
              <span>Username</span>
              <input
                bind:value={remoteUsername}
                class="input-field"
                type="text"
              />
            </label>
          </div>
          <div class="field">
            <span style="font-weight: bold">Path to private SSH key</span>
            <div class="input-line-save">
              <div>{sshPath || 'No key selected'}</div>
              {#if !isEditingSshPath}
                <Button onclick={() => (isEditingSshPath = true)}>Edit</Button>
              {:else}
                <Button onclick={cancelSshPathEdit}>Cancel</Button>
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
        </div>
      {/if}

      {#if showCoralSettings}
        <div class="subsection">
          <div class="subsection-title">Coral backend</div>
          <div class="stacked-fields">
            <div class="field">
              <span>Working directory</span>
              {#if showRemoteSettings}
                <input
                  bind:value={remoteWorkingDirectory}
                  class="input-field"
                  type="text"
                />
              {:else}
                <div class="input-line-save">
                  <div>{localWorkingDirectory || 'No directory selected'}</div>
                  {#if !isEditingLocalWorkingDirectory}
                    <Button
                      onclick={() => (isEditingLocalWorkingDirectory = true)}
                      >Edit</Button
                    >
                  {:else}
                    <Button onclick={cancelLocalWorkingDirectoryEdit}
                      >Cancel</Button
                    >
                  {/if}
                </div>
                {#if isEditingLocalWorkingDirectory}
                  <input
                    type="file"
                    webkitdirectory
                    bind:files={localWorkingDirectoryFiles}
                    onchange={handleOnChangeLocalWorkingDirectory}
                    placeholder="Working directory"
                  />
                {/if}
              {/if}
            </div>
            <div class="field">
              <span>Coral binary path</span>
              {#if showRemoteSettings}
                <input
                  bind:value={remoteCoralBinaryPath}
                  class="input-field"
                  type="text"
                />
              {:else}
                <div class="input-line-save">
                  <div>{localCoralBinaryPath || 'No file selected'}</div>
                  {#if !isEditingLocalCoralBinaryPath}
                    <Button
                      onclick={() => (isEditingLocalCoralBinaryPath = true)}
                      >Edit</Button
                    >
                  {:else}
                    <Button onclick={cancelLocalCoralBinaryPathEdit}
                      >Cancel</Button
                    >
                  {/if}
                </div>
                {#if isEditingLocalCoralBinaryPath}
                  <input
                    type="file"
                    bind:files={localCoralBinaryFiles}
                    onchange={handleOnChangeLocalCoralBinaryFile}
                    placeholder="Coral binary path"
                  />
                {/if}
              {/if}
            </div>
            <div class="field">
              <span>Coral plugin path</span>
              {#if showRemoteSettings}
                <input
                  bind:value={remoteCoralPluginPath}
                  class="input-field"
                  type="text"
                />
              {:else}
                <div class="input-line-save">
                  <div>{localCoralPluginPath || 'No file selected'}</div>
                  {#if !isEditingLocalCoralPluginPath}
                    <Button
                      onclick={() => (isEditingLocalCoralPluginPath = true)}
                      >Edit</Button
                    >
                  {:else}
                    <Button onclick={cancelLocalCoralPluginPathEdit}
                      >Cancel</Button
                    >
                  {/if}
                </div>
                {#if isEditingLocalCoralPluginPath}
                  <input
                    type="file"
                    bind:files={localCoralPluginFiles}
                    onchange={handleOnChangeLocalCoralPluginFile}
                    placeholder="Coral plugin path"
                  />
                {/if}
              {/if}
            </div>
          </div>
        </div>
      {/if}

      {#if showExecutableSettings}
        <div class="subsection">
          <div class="subsection-title">Custom executable</div>
          <div class="stacked-fields">
            {#if showRemoteSettings}
              <label class="field">
                <span>Working directory</span>
                <input
                  bind:value={remoteWorkingDirectory}
                  class="input-field"
                  type="text"
                />
              </label>
              <label class="field">
                <span>Executable path</span>
                <input
                  bind:value={remoteExecutablePath}
                  class="input-field"
                  type="text"
                />
              </label>
              <label class="field">
                <span>Parameters file name</span>
                <input
                  bind:value={remoteExecutableParametersFileName}
                  class="input-field"
                  type="text"
                  placeholder="parameters.json"
                />
              </label>
            {:else}
              <div class="field">
                <span>Working directory</span>
                <div class="input-line-save">
                  <div>{localWorkingDirectory || 'No directory selected'}</div>
                  {#if !isEditingLocalWorkingDirectory}
                    <Button
                      onclick={() => (isEditingLocalWorkingDirectory = true)}
                      >Edit</Button
                    >
                  {:else}
                    <Button onclick={cancelLocalWorkingDirectoryEdit}
                      >Cancel</Button
                    >
                  {/if}
                </div>
                {#if isEditingLocalWorkingDirectory}
                  <input
                    type="file"
                    webkitdirectory
                    bind:files={localWorkingDirectoryFiles}
                    onchange={handleOnChangeLocalWorkingDirectory}
                    placeholder="Working directory"
                  />
                {/if}
              </div>
              <div class="field">
                <span>Executable path</span>
                <div class="input-line-save">
                  <div>{localExecutablePath || 'No file selected'}</div>
                  {#if !isEditingLocalExecutablePath}
                    <Button
                      onclick={() => (isEditingLocalExecutablePath = true)}
                      >Edit</Button
                    >
                  {:else}
                    <Button onclick={cancelLocalExecutablePathEdit}
                      >Cancel</Button
                    >
                  {/if}
                </div>
                {#if isEditingLocalExecutablePath}
                  <input
                    type="file"
                    bind:files={localExecutableFiles}
                    onchange={handleOnChangeLocalExecutableFile}
                    placeholder="Executable path"
                  />
                {/if}
              </div>
              <label class="field">
                <span>Parameters file name</span>
                <input
                  bind:value={localExecutableParametersFileName}
                  class="input-field"
                  type="text"
                  placeholder="parameters.json"
                />
              </label>
            {/if}
          </div>
        </div>
      {/if}
      <div class="probe-info">
        <div>
          {settingsState.current.lastProbe?.message ||
            'No successful probe yet'}
        </div>
        {#if settingsState.current.lastProbe?.syncedAt}
          <div class="probe-subtle">
            Last sync: {new Date(
              settingsState.current.lastProbe.syncedAt
            ).toLocaleString()}
          </div>
        {/if}
      </div>
      <div class="execution-actions">
        <Button
          variant="action"
          type="button"
          onclick={saveAndSyncExecution}
          disabled={isSavingExecution}
        >
          {isSavingExecution ? 'Saving...' : 'Save & Sync Execution'}
        </Button>
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

  .execution-section {
    border-top: 1px solid var(--ternary-color);
    margin-top: 1vh;
    padding-top: 2vh;
  }

  .radio-group {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .radio-option {
    display: flex;
    align-items: center;
    gap: 0.35rem;
  }

  .execution-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1vh;
  }

  .stacked-fields {
    display: flex;
    flex-direction: column;
    gap: 1vh;
  }

  .subsection {
    display: flex;
    flex-direction: column;
    gap: 1vh;
    padding-top: 1vh;
  }

  .subsection-title {
    font-weight: 600;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.4vh;
  }

  .probe-info {
    display: flex;
    flex-direction: column;
    gap: 0.4vh;
    font-size: 0.9rem;
  }

  .probe-subtle {
    opacity: 0.75;
  }

  .execution-actions {
    display: flex;
    justify-content: flex-start;
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

  @media (max-width: 900px) {
    .execution-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
