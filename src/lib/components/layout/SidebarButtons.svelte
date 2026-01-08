<script lang="ts">
  import {
    getEdges,
    getNodes,
    setRegistry,
    loadGraph,
  } from '../../stores/nodes.svelte'
  import { exportAndEvalGraph, openNewWindow } from '../../utils/sshMessages'
  import Modal, { getModal } from './Modal.svelte'
  import LoginForm from '../LoginForm.svelte'
  import SaveProjectForm from '../SaveProjectForm.svelte'
  import { auth } from '../../stores/auth.svelte'
  import Settings from '../Settings.svelte'
  import ProjectsList from '../ProjectsList.svelte'
  import { toastState } from '../../stores/toastsStore.svelte'
  import UploadIcon from '../icons/UploadIcon.svelte'
  import ImportIcon from '../icons/ImportIcon.svelte'
  import SettingsIcon from '../icons/SettingsIcon.svelte'
  import LoginIcon from '../icons/LoginIcon.svelte'
  import CubeIcon from '../icons/CubeIcon.svelte'
  import {
    settingsState,
    URL_VISUALIZER,
  } from '../../stores/settingsStore.svelte'
  import { currentProjectState } from '../../stores/currentProjectStore.svelte'
  import { parseGraph } from '../../utils/graphParser'
  import { updateProject } from '../../requests/projects'
  import ConfirmationModal from './ConfirmationModal.svelte'

  const loginModalId = 'login-modal'
  const logoutConfirmModalId = 'logout-confirm-modal'
  const settingsModalId = 'settings-modal'
  const projectsModalId = 'projects-modal'
  const saveProjectModalId = 'save-project-modal'
  const token = $derived(auth.token)
  const loginText = $derived.by(() => {
    return token ? 'Logout' : 'Login'
  })
  let importGraphFiles: FileList | null = $state()
  let importNodesFiles: FileList | null = $state()

  const handleLoginLogout = () => {
    if (token) {
      getModal(logoutConfirmModalId).open()
    } else {
      getModal(loginModalId).open()
    }
  }

  const handleOncofirmLogout = () => {
    auth.clearToken()
    toastState.add({ message: 'Logged out', type: 'success' })
  }

  const handleExport = async () => {
    try {
      await exportAndEvalGraph(getNodes(), getEdges())
    } catch (error) {
      console.error('Upload failed:', error)
    }
  }

  const loadGraphFromFile = async () => {
    if (importGraphFiles == null || importGraphFiles.length == 0) {
      return
    }
    const importedGraphAsText = await readFileAsText(importGraphFiles[0])
    const importedGraph = JSON.parse(importedGraphAsText)

    const result = loadGraph(importedGraph)
    if (!result.success) {
      toastState.add({ message: result.error, type: 'error' })
      return
    }

    console.log('imported graph nodes', getNodes())
    console.log('imported graph edges', getEdges())
    toastState.add({ message: 'New graph was loaded' })
  }

  const onFileChangeLoadNodes = async () => {
    if (importNodesFiles == null || importNodesFiles.length == 0) {
      return
    }
    const importedNodesAsText = await readFileAsText(importNodesFiles[0])
    const importedNodes = JSON.parse(importedNodesAsText)
    setRegistry(importedNodes)
    toastState.add({ message: 'New nodes were loaded' })
  }

  const readFileAsText = (file) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsText(file)
    })

  // TODO: remove this check. This is just for debugging purposes
  // $effect(() => {
  //   console.log('auth.token', auth.token)
  // })

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
        const parsedGraph = parseGraph(getNodes(), getEdges())
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
</script>

<aside>
  <div class="button-container">
    <label for="login-button" class="element-label" title={loginText}>
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

  <div class="button-container">
    <label
      for="save-project-button"
      class="element-label"
      title="Save project to Remote"
    >
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
    </label>
    <button
      id="save-project-button"
      onclick={handleSaveProject}
      style="display: none"
      aria-label="Save project"
    ></button>
    <span class="button-text">Save</span>
  </div>
  <Modal id={saveProjectModalId} size="sm">
    <SaveProjectForm modalId={saveProjectModalId} />
  </Modal>

  <div class="button-container">
    <label
      for="load-projects-button"
      class="element-label"
      title="Load a project from Remote"
    >
      <svg
        fill="var(--ternary-color)"
        width="30px"
        height="30px"
        viewBox="0 0 32 32"
        version="1.1"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M23.845 8.125c-1.395-3.701-4.392-6.045-8.92-6.045-5.762 0-9.793 4.279-10.14 9.861-2.779 0.889-4.784 3.723-4.784 6.933 0 3.93 3.089 7.249 6.744 7.249h0.889c0.552 0 1-0.448 1-1s-0.448-1-1-1h-0.889c-2.572 0-4.776-2.404-4.776-5.249 0-2.515 1.763-4.783 3.974-5.163l0.907-0.156-0.081-0.917-0.008-0.011c0-4.871 3.206-8.545 8.162-8.545 3.972 0 6.204 1.957 7.236 5.295l0.213 0.688 0.721 0.015c3.715 0.078 6.971 3.092 6.971 6.837 0 3.408-2.259 7.206-5.679 7.206h-0.285c-0.552 0-1 0.448-1 1s0.448 1 1 1v-0.003c5-0.132 7.883-4.909 7.883-9.203-0.001-4.617-3.619-8.304-8.141-8.791zM20.198 24.233c-0.279-0.292-0.731-0.292-1.010-0l-2.2 2.427v-10.067c0-0.552-0.448-1-1-1s-1 0.448-1 1v10.076l-2.128-2.373c-0.28-0.292-0.732-0.355-1.011-0.063l-0.252 0.138c-0.28 0.293-0.28 0.765 0 1.057l3.61 3.992c0.005 0.005 0.006 0.012 0.011 0.017l0.253 0.265c0.14 0.146 0.324 0.219 0.509 0.218 0.183 0.001 0.368-0.072 0.507-0.218l0.253-0.265c0.005-0.005 0.008-0.011 0.012-0.017l3.701-4.055c0.279-0.292 0.279-0.639 0-0.932z"
        ></path>
      </svg>
    </label>
    <button
      id="load-projects-button"
      onclick={handleLoadProjects}
      style="display: none"
      aria-label="Load projects"
    ></button>
    <span class="button-text">Projects</span>
  </div>
  <Modal id={projectsModalId}>
    <ProjectsList modalId={projectsModalId} />
  </Modal>

  <div class="button-container">
    <label
      for="export-graph-button"
      class="element-label"
      title="Export JSON graph"
    >
      <UploadIcon width="30px" height="30px" />
    </label>
    <button
      id="export-graph-button"
      onclick={handleExport}
      style="display: none"
      aria-label="Export graph"
    ></button>
    <span class="button-text">Eval. Graph</span>
  </div>
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
    <span class="button-text">VTK Visualiz.</span>
  </div>
  <div class="button-container">
    <label
      for="import-graph-input"
      class="element-label"
      title="Import grpah from JSON file"
    >
      <ImportIcon width="30px" height="30px" />
    </label>
    <input
      id="import-graph-input"
      type="file"
      onchange={loadGraphFromFile}
      accept=".json"
      bind:files={importGraphFiles}
      style="display: none"
    />
    <span class="button-text">Import Graph</span>
  </div>
  <div class="button-container">
    <label
      for="import-nodes-input"
      class="element-label"
      title="Import nodes from JSON file"
    >
      <ImportIcon width="30px" height="30px" />
    </label>
    <input
      id="import-nodes-input"
      type="file"
      onchange={onFileChangeLoadNodes}
      accept=".json"
      bind:files={importNodesFiles}
      style="display: none"
    />
    <span class="button-text">Load Nodes</span>
  </div>
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
    height: 100vh;
    background: var(--primary-color);
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: center;
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
    width: 50px;
    height: 50px;
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
  }
</style>
