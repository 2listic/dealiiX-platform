<script lang="ts">
  import { slide } from 'svelte/transition'
  import {
    BACKEND_KINDS,
    EXECUTION_LOCATIONS,
    type ExecutionSettings,
  } from '../types/settingsTypes'
  import { settingsState } from '../stores/settingsStore.svelte'
  import { toastState } from '../stores/toastsStore.svelte'
  import { probeAndSaveExecution } from '../utils/settingsActions'
  import { jobsState } from '../stores/jobsStore.svelte'
  import Button from './layout/Button.svelte'
  import Modal, { getModal } from './layout/Modal.svelte'

  let { modalId } = $props()

  let executionOpen = $state(false)
  let vtkOpen = $state(false)
  let cloudOpen = $state(false)

  let sshPath = $derived(settingsState.remote.sshKeyPath)

  let urlVisualizer = $derived(settingsState.urlVisualizer)
  let isEditingVisualizer = $state(false)
  let urlRemoteServer = $derived(settingsState.urlRemoteServer)
  let isEditingRemote = $state(false)
  let executionLocation = $derived(settingsState.execution.location)
  let backendKind = $derived(settingsState.execution.backendKind)
  let remoteHost = $derived(settingsState.remote.host)
  let remotePort = $derived(settingsState.remote.port)
  let remoteUsername = $derived(settingsState.remote.username)
  let remoteWorkingDirectory = $derived(settingsState.remote.workingDirectory)
  let remoteCoralBinaryPath = $derived(settingsState.remote.coralBinaryPath)
  let remoteCoralPluginPath = $derived(settingsState.remote.coralPluginPath)
  let localWorkingDirectory = $derived(settingsState.local.workingDirectory)
  let localCoralBinaryPath = $derived(settingsState.local.coralBinaryPath)
  let localCoralPluginPath = $derived(settingsState.local.coralPluginPath)
  let localExecutablePath = $derived(settingsState.local.executablePath)
  let localExecutableParametersFileName = $derived(
    settingsState.local.parametersFileName
  )
  let remoteExecutablePath = $derived(settingsState.remote.executablePath)
  let remoteExecutableParametersFileName = $derived(
    settingsState.remote.parametersFileName
  )
  let isSavingExecution = $state(false)
  let showRemoteSettings = $derived(executionLocation === 'remote')
  let showCoralSettings = $derived(backendKind === 'coral')
  let showExecutableSettings = $derived(backendKind === 'executable')

  const closeModal = () => getModal(modalId)?.close()

  const saveAndSyncExecution = async () => {
    const execution: ExecutionSettings = {
      location: executionLocation,
      backendKind,
      local: {
        workingDirectory: localWorkingDirectory,
        coralBinaryPath: localCoralBinaryPath,
        coralPluginPath: localCoralPluginPath,
        executablePath: localExecutablePath,
        parametersFileName: localExecutableParametersFileName,
      },
      remote: {
        host: remoteHost,
        port: Number(remotePort),
        username: remoteUsername,
        workingDirectory: remoteWorkingDirectory,
        coralBinaryPath: remoteCoralBinaryPath,
        coralPluginPath: remoteCoralPluginPath,
        executablePath: remoteExecutablePath,
        parametersFileName: remoteExecutableParametersFileName,
        sshKeyPath: sshPath,
      },
    }

    console.log('Saving execution settings:', execution)
    isSavingExecution = true
    try {
      const result = await probeAndSaveExecution(execution)
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
      await jobsState.update()
    } finally {
      isSavingExecution = false
    }
  }

  const resetForm = () => {
    isEditingVisualizer = false
    isEditingRemote = false
    urlVisualizer = settingsState.urlVisualizer
    urlRemoteServer = settingsState.urlRemoteServer
    sshPath = settingsState.remote.sshKeyPath
    executionLocation = settingsState.execution.location
    backendKind = settingsState.execution.backendKind
    remoteHost = settingsState.remote.host
    remotePort = settingsState.remote.port
    remoteUsername = settingsState.remote.username
    remoteWorkingDirectory = settingsState.remote.workingDirectory
    remoteCoralBinaryPath = settingsState.remote.coralBinaryPath
    remoteCoralPluginPath = settingsState.remote.coralPluginPath
    localWorkingDirectory = settingsState.local.workingDirectory
    localCoralBinaryPath = settingsState.local.coralBinaryPath
    localCoralPluginPath = settingsState.local.coralPluginPath
    localExecutablePath = settingsState.local.executablePath
    localExecutableParametersFileName = settingsState.local.parametersFileName
    remoteExecutablePath = settingsState.remote.executablePath
    remoteExecutableParametersFileName = settingsState.remote.parametersFileName
  }

  const pickSshFile = async () => {
    const picked = await window.electron.invoke('pick-file')
    if (picked) sshPath = picked
  }

  const pickLocalWorkingDirectory = async () => {
    const picked = await window.electron.invoke('pick-directory')
    if (picked) localWorkingDirectory = picked
  }

  const pickLocalCoralBinary = async () => {
    const picked = await window.electron.invoke('pick-file')
    if (picked) localCoralBinaryPath = picked
  }

  const pickLocalCoralPlugin = async () => {
    const picked = await window.electron.invoke('pick-file')
    if (picked) localCoralPluginPath = picked
  }

  const pickLocalExecutable = async () => {
    const picked = await window.electron.invoke('pick-file')
    if (picked) localExecutablePath = picked
  }

  const saveVisualizerUrl = async () => {
    await settingsState.saveUrlVisualizer(urlVisualizer)
    isEditingVisualizer = false
    toastState.add({ message: 'URL Visualizer saved' })
  }

  const saveRemoteUrl = async () => {
    const parsed = urlRemoteServer.replace(/\/$/, '')
    await settingsState.saveUrlRemoteServer(parsed)
    urlRemoteServer = parsed
    isEditingRemote = false
    toastState.add({ message: 'URL Remote Server saved' })
  }
</script>

<Modal id={modalId} size="md" onClose={resetForm}>
  <div style="padding: 0 1rem 1rem 1rem">
    <h2>Settings</h2>
    <div class="inputs-container">
      <div class="input-container accordion-section">
        <button
          class="accordion-summary"
          onclick={() => (executionOpen = !executionOpen)}
          aria-expanded={executionOpen}>Execution Mode</button
        >
        {#if executionOpen}
          <div class="accordion-body" transition:slide={{ duration: 300 }}>
            <form
              onsubmit={(e) => {
                e.preventDefault()
                saveAndSyncExecution()
              }}
            >
              <div class="radio-controls">
                <div class="radio-group">
                  {#each EXECUTION_LOCATIONS as location (location)}
                    <label
                      class="radio-option"
                      class:active={executionLocation === location}
                    >
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
                    <label
                      class="radio-option"
                      class:active={backendKind === kind}
                    >
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
              </div>
              {#if showRemoteSettings}
                <div class="subsection">
                  <div class="subsection-title">Execution remote host</div>
                  <p class="section-hint">
                    SSH connection — enter a bare hostname or IP address, no
                    http:// prefix.
                  </p>
                  <div class="execution-grid">
                    <label class="field">
                      <span>Host</span>
                      <input
                        bind:value={remoteHost}
                        class="input-field"
                        type="text"
                        required
                        placeholder="localhost"
                      />
                    </label>
                    <label class="field">
                      <span>Port</span>
                      <input
                        bind:value={remotePort}
                        class="input-field"
                        type="number"
                        min="1"
                        max="65535"
                        placeholder="2222"
                      />
                    </label>
                    <label class="field">
                      <span>Username</span>
                      <input
                        bind:value={remoteUsername}
                        class="input-field"
                        type="text"
                        required
                        placeholder="user"
                      />
                    </label>
                  </div>
                  <div class="field">
                    <span>Path to private SSH key</span>
                    <div class="input-line-save">
                      <div>{sshPath || 'No key selected'}</div>
                      <Button onclick={pickSshFile}>Edit</Button>
                    </div>
                  </div>
                </div>
              {/if}

              <div class="subsection">
                <div class="subsection-title">Working directory</div>
                <div class="field">
                  {#if showRemoteSettings}
                    <input
                      bind:value={remoteWorkingDirectory}
                      class="input-field"
                      type="text"
                      required
                    />
                  {:else}
                    <div class="input-line-save">
                      <div>
                        {localWorkingDirectory || 'No directory selected'}
                      </div>
                      <Button onclick={pickLocalWorkingDirectory}>Edit</Button>
                    </div>
                  {/if}
                </div>
              </div>

              {#if showCoralSettings}
                <div class="subsection">
                  <div class="subsection-title">Coral backend</div>
                  <div class="stacked-fields">
                    <div class="field">
                      <span>Coral binary path</span>
                      {#if showRemoteSettings}
                        <input
                          bind:value={remoteCoralBinaryPath}
                          class="input-field"
                          type="text"
                          required
                        />
                      {:else}
                        <div class="input-line-save">
                          <div>
                            {localCoralBinaryPath || 'No file selected'}
                          </div>
                          <Button onclick={pickLocalCoralBinary}>Edit</Button>
                        </div>
                      {/if}
                    </div>
                    <div class="field">
                      <span>Coral plugin path or module list</span>
                      {#if showRemoteSettings}
                        <input
                          bind:value={remoteCoralPluginPath}
                          class="input-field"
                          type="text"
                          required
                        />
                      {:else}
                        <div class="input-line-save">
                          <input
                            bind:value={localCoralPluginPath}
                            class="input-field"
                            type="text"
                            required
                            placeholder="path/to/plugin.so or module1,module2,module3"
                          />
                          <Button onclick={pickLocalCoralPlugin}>Browse</Button>
                        </div>
                      {/if}
                      <p class="field-hint">
                        A plugin path (.so) — use Browse — or a comma-separated
                        module list (e.g. module1,module2,module3).
                      </p>
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
                        <span>Executable path</span>
                        <input
                          bind:value={remoteExecutablePath}
                          class="input-field"
                          type="text"
                          required
                        />
                      </label>
                      <label class="field">
                        <span>Parameters file name</span>
                        <input
                          bind:value={remoteExecutableParametersFileName}
                          class="input-field"
                          type="text"
                          placeholder="parameters.json or parameters.prm"
                          required
                        />
                      </label>
                    {:else}
                      <div class="field">
                        <span>Executable path</span>
                        <div class="input-line-save">
                          <div>{localExecutablePath || 'No file selected'}</div>
                          <Button onclick={pickLocalExecutable}>Edit</Button>
                        </div>
                      </div>
                      <label class="field">
                        <span>Parameters file name</span>
                        <input
                          bind:value={localExecutableParametersFileName}
                          class="input-field"
                          type="text"
                          placeholder="parameters.json or parameters.prm"
                          required
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
                  type="submit"
                  disabled={isSavingExecution}
                >
                  {isSavingExecution ? 'Saving...' : 'Save & Sync Execution'}
                </Button>
              </div>
            </form>
          </div>
        {/if}
      </div>
      <div class="input-container accordion-section">
        <button
          class="accordion-summary"
          onclick={() => (vtkOpen = !vtkOpen)}
          aria-expanded={vtkOpen}>VTK Visualizer &amp; Editor</button
        >
        {#if vtkOpen}
          <div class="accordion-body" transition:slide={{ duration: 300 }}>
            <p class="section-hint">
              HTTP/HTTPS connection to the VTK visualizer service.
            </p>
            <div class="field">
              <label for="url-vtk-visualizer">URL</label>
              {#if isEditingVisualizer}
                <form
                  class="input-line-save"
                  onsubmit={(e) => {
                    e.preventDefault()
                    saveVisualizerUrl()
                  }}
                >
                  <input
                    id="url-vtk-visualizer"
                    type="url"
                    class="input-field"
                    bind:value={urlVisualizer}
                    placeholder="http://localhost:8008"
                  />
                  <Button type="submit">Save</Button>
                </form>
              {:else}
                <div class="input-line-save">
                  <div>{urlVisualizer || 'No URL set'}</div>
                  <Button onclick={() => (isEditingVisualizer = true)}
                    >Edit</Button
                  >
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>
      <div class="input-container accordion-section">
        <button
          class="accordion-summary"
          onclick={() => (cloudOpen = !cloudOpen)}
          aria-expanded={cloudOpen}>Cloud Remote Server</button
        >
        {#if cloudOpen}
          <div class="accordion-body" transition:slide={{ duration: 300 }}>
            <p class="section-hint">
              HTTP/HTTPS connection to the cloud remote server.
            </p>
            <div class="field">
              <label for="url-remote-server">URL</label>
              {#if isEditingRemote}
                <form
                  class="input-line-save"
                  onsubmit={(e) => {
                    e.preventDefault()
                    saveRemoteUrl()
                  }}
                >
                  <input
                    id="url-remote-server"
                    type="url"
                    class="input-field"
                    bind:value={urlRemoteServer}
                    placeholder="http://localhost:8080"
                  />
                  <Button type="submit">Save</Button>
                </form>
              {:else}
                <div class="input-line-save">
                  <div>{settingsState.urlRemoteServer || 'No URL set'}</div>
                  <Button onclick={() => (isEditingRemote = true)}>Edit</Button>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>
      <div class="button-container">
        <Button variant="default" type="button" onclick={closeModal}
          >Close</Button
        >
      </div>
    </div>
  </div>
</Modal>

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

  .accordion-section {
    margin-top: 1vh;
    padding-top: 1vh;
  }

  .accordion-summary {
    font-weight: bold;
    cursor: pointer;
    user-select: none;
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: none;
    border: none;
    padding: 0;
    color: inherit;
    font-size: 1.1rem;
    width: 100%;
    text-align: left;
  }

  .accordion-summary::before {
    content: '▸';
    display: inline-block;
    transition: transform 0.2s;
  }

  .accordion-summary[aria-expanded='true']::before {
    transform: rotate(90deg);
  }

  .accordion-body {
    display: flex;
    flex-direction: column;
    gap: 1vh;
    padding-left: 1rem;
    padding-top: 1vh;
  }

  .radio-controls {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 0 1.25rem;
  }

  .radio-group {
    display: flex;
    border: 1px solid color-mix(in srgb, var(--ternary-color) 30%, transparent);
    border-radius: 8px;
    overflow: hidden;
  }

  .radio-option {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem 1.6rem;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition:
      background-color 0.15s,
      color 0.15s;
    user-select: none;
    background: var(--primary-color);
    color: var(--ternary-color);
    border-right: 1px solid
      color-mix(in srgb, var(--ternary-color) 30%, transparent);
  }

  .radio-option:last-child {
    border-right: none;
  }

  .radio-option input[type='radio'] {
    display: none;
  }

  .radio-option.active {
    background: var(--button-action-bg);
    color: white;
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
    padding: 0 1rem;
  }

  .probe-info {
    display: flex;
    flex-direction: column;
    gap: 0.4vh;
    font-size: 0.9rem;
    align-items: center;
    text-align: center;
    padding: 0.8rem 0;
  }

  .probe-subtle {
    opacity: 0.75;
  }

  .execution-actions {
    display: flex;
    justify-content: center;
  }

  .section-hint {
    margin: 0 0 0.5vh;
    font-size: 0.85rem;
    opacity: 0.7;
    padding: 0 1rem;
  }

  .field-hint {
    margin: 0;
    font-size: 0.8rem;
    opacity: 0.7;
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
