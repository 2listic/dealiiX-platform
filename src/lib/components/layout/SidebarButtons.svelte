<script lang="ts">
  import {
    getEdges,
    getEdgesSnapshot,
    getNodes,
    getNodesSnapshot,
    setRegistry,
  } from '../../stores/nodes.svelte'
  import {
    loadGraphFromProtocol,
    removeQualifiedIds,
    validateGraphData,
  } from '../../utils/graphParser'
  import {
    exportAndEvalGraph,
    buildGraphPayload,
    openNewWindow,
    type JobConfig,
  } from '../../utils/sshMessages'
  import Modal, { getModal } from './Modal.svelte'
  import LoginForm from '../LoginForm.svelte'
  import SaveProjectForm from '../SaveProjectForm.svelte'
  import { auth } from '../../stores/auth.svelte'
  import Settings from '../Settings.svelte'
  import ProjectsList from '../ProjectsList.svelte'
  import { toastState } from '../../stores/toastsStore.svelte'
  import UploadIcon from '../icons/UploadIcon.svelte'
  import SettingsIcon from '../icons/SettingsIcon.svelte'
  import LoginIcon from '../icons/LoginIcon.svelte'
  import CubeIcon from '../icons/CubeIcon.svelte'
  import {
    settingsState,
    URL_VISUALIZER,
    USE_MPI,
  } from '../../stores/settingsStore.svelte'
  import { currentProjectState } from '../../stores/currentProjectStore.svelte'
  import { parseGraphWithQualifiedIds } from '../../utils/graphParser'
  import { updateProject } from '../../requests/projects'
  import ConfirmationModal from './ConfirmationModal.svelte'
  import ExecuteIcon from '../icons/ExecuteIcon.svelte'
  import CreateNetworkNodeModal from '../nodes/CreateNetworkNodeModal.svelte'
  import SidebarGroupButton from './SidebarGroupButton.svelte'
  import SidebarGroupButtonItem from './SidebarGroupButtonItem.svelte'
  import MpiConfigModal from '../MpiConfigModal.svelte'

  const loginModalId = 'login-modal'
  const logoutConfirmModalId = 'logout-confirm-modal'
  const settingsModalId = 'settings-modal'
  const projectsModalId = 'projects-modal'
  const saveProjectModalId = 'save-project-modal'
  const createNetworkNodeModalId = 'create-network-node-modal'
  const mpiConfigModalId = 'mpi-config-modal'
  const token = $derived(auth.token)
  const username = $derived(auth.username)
  const loginText = $derived.by(() => {
    return token ? username : 'Login'
  })
  const loginTitle = $derived.by(() => {
    return token ? 'logout' : 'Login'
  })

  let importGraphInput: HTMLInputElement | undefined = $state()
  let importNodesInput: HTMLInputElement | undefined = $state()

  const handleLoginLogout = () => {
    if (token) {
      getModal(logoutConfirmModalId).open()
    } else {
      getModal(loginModalId).open()
    }
  }

  const handleOncofirmLogout = async () => {
    await auth.clearToken()
    toastState.add({ message: 'Logged out', type: 'success' })
  }

  const handleExecution = () => {
    getModal(mpiConfigModalId)?.open()
  }

  const handleJobConfirm = (config: JobConfig) => {
    executeGraph(config)
  }

  const executeGraph = async (config?: JobConfig) => {
    try {
      await exportAndEvalGraph(getNodesSnapshot(), getEdgesSnapshot(), config)
    } catch (error) {
      console.error('Failed to execute graph:', error)
      toastState.add({
        message: error.message || 'Failed to execute graph',
        type: 'error',
      })
    }
  }

  /**
   * Loads a graph from a file removing the edges that have type mismatches
   */
  const loadGraphFromFile = async () => {
    const files = importGraphInput?.files
    if (files == null || files.length == 0) {
      return
    }
    try {
      const importedGraphAsText = await readFileAsText(files[0])
      const importedGraph = JSON.parse(importedGraphAsText)
      const [validEdges, invalidEdges] = validateGraphData(importedGraph)
      if (invalidEdges.length > 0) {
        invalidEdges.forEach((invalidEdge) => {
          toastState.add({
            message: invalidEdge.error,
            type: 'error',
          })
        })
      }

      const cleanedGraph = removeQualifiedIds(importedGraph)
      const registeredNetworkNodes = await loadGraphFromProtocol(
        cleanedGraph.workflow.nodes,
        validEdges
      )
      if (registeredNetworkNodes.length > 0) {
        registeredNetworkNodes.forEach((nodeName) => {
          toastState.add({
            message: `Sub-graph node ${nodeName} was registered`,
            type: 'success',
          })
        })
      }
      currentProjectState.clear()
      console.log('imported graph nodes', getNodes())
      console.log('imported graph edges', getEdges())
      toastState.add({ message: 'New graph was loaded' })
    } catch (error) {
      console.error('Failed to load graph:', error)
      toastState.add({
        message: error.message || 'Failed to load graph',
        type: 'error',
      })
    }
  }

  const onFileChangeLoadNodes = async () => {
    const files = importNodesInput?.files
    if (files == null || files.length == 0) {
      return
    }
    const importedNodesAsText = await readFileAsText(files[0])
    const importedNodes = JSON.parse(importedNodesAsText)
    const skippedKeys = await setRegistry(importedNodes)
    skippedKeys.forEach((key) => {
      toastState.add({
        message: `Registry key '${key}' is not a valid node and was skipped`,
        type: 'error',
      })
    })
    toastState.add({ message: 'New nodes were loaded' })
  }

  const readFileAsText = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsText(file)
    })

  const handleOpenVisualizer = () => {
    const url = settingsState.getKey(URL_VISUALIZER)
    openNewWindow(url)
  }

  const handleLoadProjects = () => {
    getModal(projectsModalId).open()
  }

  const handleSaveProject = async () => {
    if (currentProjectState.id) {
      // Update existing project
      try {
        const parsedGraph = parseGraphWithQualifiedIds(
          getNodesSnapshot(),
          getEdgesSnapshot()
        )
        const updatedProject = await updateProject(currentProjectState.id, {
          graph: parsedGraph,
        })
        currentProjectState.set(updatedProject)
        toastState.add({
          message: 'Project updated successfully',
          type: 'success',
        })
      } catch (error) {
        console.error('Failed to update project:', error)
        toastState.add({
          message: error.message || 'Failed to update project',
          type: 'error',
        })
      }
      return
    }
    // No existing project - open save modal for new project
    getModal(saveProjectModalId)?.open()
  }

  const handleCreateNetworkNode = () => {
    getModal(createNetworkNodeModalId)?.open()
  }

  const handleGraphDownload = () => {
    try {
      // Parse current graph to Network JSON format (MPI plugin block included)
      const useMpi = settingsState.getKey(USE_MPI) ?? false
      const graphData = buildGraphPayload(
        getNodesSnapshot(),
        getEdgesSnapshot(),
        useMpi
      )
      const jsonString = JSON.stringify(graphData, null, 2)

      // Create blob with JSON data + filename
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const filename = `${currentProjectState.name}.json`

      // Create temporary anchor and trigger download
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()

      // Cleanup
      document.body.removeChild(anchor)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download graph:', error)
      toastState.add({
        message: error.message || 'Failed to download graph',
        type: 'error',
      })
    }
  }
</script>

<aside>
  <!-- Login (standalone) -->
  <div class="button-container">
    <label for="login-button" class="element-label" title={loginTitle}>
      <LoginIcon width="30px" height="30px" />
    </label>
    <button
      id="login-button"
      onclick={handleLoginLogout}
      style="display: none"
      aria-label="Login"
    ></button>
    <span class="button-text">
      {loginText}
    </span>
  </div>

  <Modal id={loginModalId}>
    <LoginForm modalId={loginModalId} />
  </Modal>

  <ConfirmationModal
    modalId={logoutConfirmModalId}
    message="Are you sure you want to logout?"
    confirmText="Logout"
    confirmVariant="action"
    onConfirm={handleOncofirmLogout}
  />

  <!-- Project group -->
  <SidebarGroupButton title="Project">
    {#snippet icon()}
      <svg
        fill="var(--ternary-color)"
        width="30px"
        height="30px"
        viewBox="0 0 32 32"
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M23.845 8.124c-1.395-3.701-4.392-6.045-8.921-6.045-5.762 0-9.793 4.279-10.14 9.86-2.778 0.889-4.784 3.723-4.784 6.933 0 3.93 3.089 7.249 6.744 7.249h2.889c0.552 0 1-0.448 1-1s-0.448-1-1-1h-2.889c-2.572 0-4.776-2.404-4.776-5.249 0-2.514 1.763-4.783 3.974-5.163l0.907-0.156-0.080-0.916-0.008-0.011c0-4.871 3.205-8.545 8.161-8.545 3.972 0 6.204 1.957 7.236 5.295l0.214 0.688 0.721 0.015c3.715 0.078 6.972 3.092 6.972 6.837 0 3.408-2.259 7.206-5.678 7.206h-2.285c-0.552 0-1 0.448-1 1s0.448 1 1 1l2.277-0.003c5-0.132 7.605-4.908 7.605-9.203 0-4.616-3.617-8.305-8.14-8.791zM16.75 16.092c-0.006-0.006-0.008-0.011-0.011-0.016l-0.253-0.264c-0.139-0.146-0.323-0.219-0.508-0.218-0.184-0.002-0.368 0.072-0.509 0.218l-0.253 0.264c-0.005 0.005-0.006 0.011-0.011 0.016l-3.61 3.992c-0.28 0.292-0.28 0.764 0 1.058l0.252 0.171c0.28 0.292 0.732 0.197 1.011-0.095l2.128-2.373v10.076c0 0.552 0.448 1 1 1s1-0.448 1-1v-10.066l2.199 2.426c0.279 0.292 0.732 0.387 1.011 0.095l0.252-0.171c0.279-0.293 0.279-0.765 0-1.058z"
        ></path>
      </svg>
    {/snippet}
    {#snippet items()}
      <SidebarGroupButtonItem
        label="Save Project"
        onclick={handleSaveProject}
      />
      <SidebarGroupButtonItem
        label="Load Projects"
        onclick={handleLoadProjects}
      />
      <SidebarGroupButtonItem
        label="Download Graph"
        onclick={handleGraphDownload}
      />
    {/snippet}
  </SidebarGroupButton>

  <Modal id={saveProjectModalId} size="sm">
    <SaveProjectForm modalId={saveProjectModalId} />
  </Modal>
  <Modal id={projectsModalId}>
    <ProjectsList modalId={projectsModalId} />
  </Modal>

  <!-- Execute Graph (standalone) -->
  <div class="button-container">
    <label
      for="execute-graph-button"
      class="element-label"
      title="Execute graph"
    >
      <ExecuteIcon width="30px" height="30px" />
    </label>
    <button
      id="execute-graph-button"
      onclick={handleExecution}
      style="display: none"
      aria-label="Execute graph"
    ></button>
    <span class="button-text">Execute</span>
  </div>

  <MpiConfigModal
    modalId={mpiConfigModalId}
    showMpiFields={settingsState.getKey(USE_MPI) ?? false}
    onConfirm={handleJobConfirm}
  />

  <!-- VTK Visualizer (standalone) -->
  <div class="button-container">
    <label
      for="vtk-visualizer-button"
      class="element-label"
      title="Open VTK Visualizer"
    >
      <CubeIcon width="30px" height="30px" />
    </label>
    <button
      id="vtk-visualizer-button"
      onclick={handleOpenVisualizer}
      style="display: none"
      aria-label="Open VTK Visualizer"
    ></button>
    <span class="button-text">Visualiz.</span>
  </div>

  <!-- Import group -->
  <SidebarGroupButton title="Import">
    {#snippet icon()}
      <UploadIcon width="30px" height="30px" />
    {/snippet}
    {#snippet items()}
      <SidebarGroupButtonItem
        label="Import Graph"
        onclick={() => importGraphInput?.click()}
      />
      <SidebarGroupButtonItem
        label="Import Nodes"
        onclick={() => importNodesInput?.click()}
      />
      <SidebarGroupButtonItem
        label="Create Sub-Graph"
        onclick={handleCreateNetworkNode}
      />
    {/snippet}
  </SidebarGroupButton>

  <!-- Hidden file inputs -->
  <input
    bind:this={importGraphInput}
    type="file"
    onchange={loadGraphFromFile}
    accept=".json"
    style="display: none"
  />
  <input
    bind:this={importNodesInput}
    type="file"
    onchange={onFileChangeLoadNodes}
    accept=".json"
    style="display: none"
  />

  <CreateNetworkNodeModal modalId={createNetworkNodeModalId} />

  <!-- Settings (standalone) -->
  <div class="button-container">
    <label for="settings-button" class="element-label" title="Settings">
      <SettingsIcon width="30px" height="30px" />
    </label>
    <button
      id="settings-button"
      onclick={() => getModal(settingsModalId).open()}
      style="display: none"
      aria-label="Settings"
    ></button>
    <span class="button-text"> Settings </span>
  </div>
  <Modal id={settingsModalId} size="sm">
    <Settings modalId={settingsModalId} />
  </Modal>
</aside>

<style>
  aside {
    --btn-size: clamp(36px, 5.5vh, 50px);
    height: 100vh;
    background: var(--primary-color);
    display: flex;
    flex-direction: column;
    flex-wrap: wrap;
    justify-content: flex-start;
    align-items: center;
    align-content: center;
  }

  .button-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.3rem 0.3rem;
  }

  .element-label {
    display: flex;
    align-items: center;
    justify-content: center;
    width: var(--btn-size);
    height: var(--btn-size);
    background-color: var(--background-color-secondary);
    border: 1px solid grey;
    border-radius: 10px;
    cursor: pointer;
    margin: 0.5rem 0.2rem;
  }

  .element-label:hover {
    border-color: var(--border-color-hover);
  }

  .button-text {
    font-size: 0.8rem;
    color: var(--ternary-color);
    text-align: center;
    font-weight: bold;
    line-height: 1.2;
    max-width: calc(var(--btn-size) + 15px);
    word-wrap: break-word;
  }
</style>
