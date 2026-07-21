<script lang="ts">
  import {
    getEdges,
    getEdgesSnapshot,
    getNodes,
    getNodesSnapshot,
    setNodes,
  } from '../../stores/nodes.svelte'
  import { mergeRegistry } from '../../stores/registryStore.svelte'
  import { importGraphFromProtocol } from '../../utils/graphParser'
  import {
    mergeParametersFromFile,
    downloadParameters,
  } from '../../utils/parametersFileActions'
  import { parametersState } from '../../stores/parametersStore.svelte'
  import { buildGraphPayload, openNewWindow } from '../../utils/sshMessages'
  import { pipelineState } from '../../stores/pipeline.svelte'
  import {
    runPipelineRemote,
    type PipelineProgress,
  } from '../../orchestration/pipelineOrchestrator'
  import { buildExportMeta } from '../../utils/exportMeta'
  import { jobsState } from '../../stores/jobsStore.svelte'
  import PipelineRunNameModal from '../PipelineRunNameModal.svelte'
  import Modal, { getModal } from './Modal.svelte'
  import LoginForm from '../LoginForm.svelte'
  import SaveProjectForm from '../SaveProjectForm.svelte'
  import { auth } from '../../stores/auth.svelte'
  import Settings from '../SettingsModal.svelte'
  import ProjectsList from '../ProjectsList.svelte'
  import { toastState } from '../../stores/toastsStore.svelte'
  import { graphHistoryState } from '../../stores/graphStack.svelte'
  import UploadIcon from '../icons/UploadIcon.svelte'
  import DownloadIcon from '../icons/DownloadIcon.svelte'
  import SettingsIcon from '../icons/SettingsIcon.svelte'
  import LoginIcon from '../icons/LoginIcon.svelte'
  import CubeIcon from '../icons/CubeIcon.svelte'
  import { settingsState } from '../../stores/settingsStore.svelte'
  import { executionSelectionState } from '../../stores/executionSelection.svelte'
  import { currentProjectState } from '../../stores/currentProjectStore.svelte'
  import { viewModeState } from '../../stores/viewModeStore.svelte'
  import { parseGraphWithQualifiedIds } from '../../utils/graphParser'
  import { updateProject } from '../../requests/projects'
  import ConfirmationModal from './ConfirmationModal.svelte'
  import ExecuteIcon from '../icons/ExecuteIcon.svelte'
  import SidebarGroupButton from './SidebarGroupButton.svelte'
  import SidebarGroupButtonItem from './SidebarGroupButtonItem.svelte'
  import JobConfigModal from '../JobConfigModal.svelte'
  import { graphStackState } from '../../stores/graphStack.svelte'
  import GridIcon from '../icons/GridIcon.svelte'
  import PlusIcon from '../icons/PlusIcon.svelte'
  import { useSvelteFlow } from '@xyflow/svelte'

  const { fitView } = useSvelteFlow()

  const loginModalId = 'login-modal'
  const logoutConfirmModalId = 'logout-confirm-modal'
  const settingsModalId = 'settings-modal'
  const projectsModalId = 'projects-modal'
  const saveProjectModalId = 'save-project-modal'
  const JobConfigModalId = 'job-config-modal'
  const subnetworkWarningModalId = 'subnetwork-warning-modal'
  const runNameModalId = 'pipeline-run-name-modal'
  let isCoralMode = $derived(executionSelectionState.isCoralMode)
  let isExecutableMode = $derived(executionSelectionState.isExecutableMode)
  let hasParams = $derived(parametersState.value != null)
  const paramsSyncHint =
    'No parameters loaded — sync an executable from Settings first'
  let hasRemoteServer = $derived(settingsState.hasRemoteServer)
  let hasVisualizer = $derived(settingsState.hasVisualizer)
  let isSingleMode = $derived(viewModeState.value === 'single')
  let isPipelineMode = $derived(viewModeState.value === 'pipeline')
  let isRemote = $derived(executionSelectionState.location === 'remote')
  let pipelineValidation = $derived(pipelineState.validation)

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
  let coralGraphInput: HTMLInputElement | undefined = $state()
  let pipelineImportInput: HTMLInputElement | undefined = $state()
  let paramsFileInput: HTMLInputElement | undefined = $state()

  const handleLoginLogout = () => {
    if (token) {
      getModal(logoutConfirmModalId)?.open()
    } else {
      getModal(loginModalId)?.open()
    }
  }

  const handleOncofirmLogout = async () => {
    await auth.clearToken()
    toastState.add({ message: 'Logged out', type: 'success' })
  }

  /**
   * Unified Run entry point. In single mode it opens the job-config modal; in
   * pipeline mode it validates and opens the run-name modal.
   */
  const handleExecution = () => {
    if (isPipelineMode) {
      if (!isRemote) {
        toastState.add({
          message: 'Pipelines run in remote mode only — switch location first.',
          type: 'error',
        })
        return
      }
      if (!pipelineValidation.runnable) {
        toastState.add({
          message: `Cannot run: ${pipelineValidation.issues.join('; ')}`,
          type: 'error',
        })
        return
      }
      getModal(runNameModalId)?.open()
      return
    }
    getModal(JobConfigModalId)?.open()
  }

  const handleAddCoralFromFile = async () => {
    const file = coralGraphInput?.files?.[0]
    if (!file) return
    try {
      const graph = JSON.parse(await file.text())
      if (!graph || typeof graph !== 'object' || !('workflow' in graph)) {
        toastState.add({
          message:
            'This file does not look like a CORAL graph (no "workflow").',
          type: 'error',
        })
        return
      }
      const name = file.name.replace(/\.json$/i, '')
      // Capture the coral install paths at stage creation so the stage is a
      // self-contained execution request — the submit primitive no longer reads
      // settingsState.
      pipelineState.addCoralStage({
        name,
        graph,
        coralBinaryPath: settingsState.remote.coralBinaryPath,
        coralPluginPath: settingsState.remote.coralPluginPath,
      })
    } catch (error) {
      toastState.add({
        message:
          error instanceof Error ? error.message : 'Failed to read graph file',
        type: 'error',
      })
    } finally {
      if (coralGraphInput) coralGraphInput.value = ''
    }
  }

  const handleAddCoralFromCanvas = () => {
    const graph = buildGraphPayload(
      getNodesSnapshot(),
      getEdgesSnapshot(),
      false
    )
    pipelineState.addCoralStage({
      name: currentProjectState.name || 'canvas graph',
      graph,
      coralBinaryPath: settingsState.remote.coralBinaryPath,
      coralPluginPath: settingsState.remote.coralPluginPath,
    })
  }

  const handleAddExecutable = () => {
    pipelineState.addExecutableStage({
      name: 'executable',
      executablePath: settingsState.remote.executablePath,
      parametersFileName:
        settingsState.remote.parametersFileName || 'parameters.json',
    })
  }

  /**
   * Downloads the current pipeline as a JSON file: `toPipeline()` wrapped under
   * `pipeline` plus a metadata envelope, so positions and per-stage configs
   * round-trip exactly on re-import.
   */
  const handleExportPipeline = () => {
    const payload = {
      pipeline: pipelineState.toPipeline(),
      ...buildExportMeta(),
    }
    const jsonString = JSON.stringify(payload, null, 2)
    const blob = new Blob([jsonString], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `pipeline-${Date.now()}.json`
    document.body.appendChild(anchor)
    anchor.click()
    document.body.removeChild(anchor)
    URL.revokeObjectURL(url)
  }

  /** Replaces the canvas with a previously exported pipeline file. */
  const handleImportPipeline = async () => {
    const file = pipelineImportInput?.files?.[0]
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      if (
        !Array.isArray(parsed?.pipeline?.nodes) ||
        !Array.isArray(parsed?.pipeline?.edges)
      ) {
        toastState.add({
          message:
            'This file does not look like a pipeline export (no pipeline.nodes/edges array).',
          type: 'error',
        })
        return
      }
      pipelineState.load(parsed)
    } catch (error) {
      toastState.add({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to read pipeline file',
        type: 'error',
      })
    } finally {
      if (pipelineImportInput) pipelineImportInput.value = ''
    }
  }

  /** Surfaces a pipeline progress event as a toast; success/error also refreshes the jobs table. */
  const handlePipelineProgress = (event: PipelineProgress) => {
    if (event.type === 'info' || event.type === 'success') {
      toastState.add({ message: event.message, type: event.type })
    } else {
      toastState.add({ message: event.message, type: 'error' })
    }
    if (event.type !== 'info') jobsState.update()
  }

  /** Runs the pipeline remotely, surfacing progress events as toasts. */
  const handleRunPipeline = (name: string) => {
    const pipeline = pipelineState.toPipeline()
    runPipelineRemote(
      pipeline,
      name || undefined,
      handlePipelineProgress
    ).catch((error) => {
      toastState.add({
        message: error instanceof Error ? error.message : 'Pipeline run failed',
        type: 'error',
      })
    })
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
      const { invalidEdges, registeredNetworkNodes } =
        await importGraphFromProtocol(importedGraph)
      invalidEdges.forEach((invalidEdge) => {
        toastState.add({ message: invalidEdge.error, type: 'error' })
      })
      registeredNetworkNodes.forEach((nodeName) => {
        toastState.add({
          message: `Sub-graph node ${nodeName} was registered`,
          type: 'success',
        })
      })
      currentProjectState.clear()
      console.log('imported graph nodes', getNodes())
      console.log('imported graph edges', getEdges())
      toastState.add({ message: 'New graph was loaded' })
      // Force a fit view to ensure the graph is visible
      fitView({ maxZoom: 1, minZoom: 1 })
    } catch (error) {
      console.error('Failed to load graph:', error)
      toastState.add({
        message:
          error instanceof Error ? error.message : 'Failed to load graph',
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
    if ('workflow' in importedNodes) {
      toastState.add({
        message:
          'This looks like a graph file, not a registry. Use "Open graph" to load it.',
        type: 'error',
      })
      return
    }
    // Merge into the active location's registry (imported keys win) rather than
    // replacing it, so nodes added by an earlier import survive.
    const skippedKeys = await mergeRegistry(
      importedNodes,
      executionSelectionState.location
    )
    skippedKeys.forEach((key) => {
      toastState.add({
        message: `Registry key '${key}' is not a valid node and was skipped`,
        type: 'error',
      })
    })
    toastState.add({ message: 'New nodes were loaded' })
  }

  /** Merges the selected parameters file (JSON or PRM) into the active location's tree. */
  const handleMergeParams = async () => {
    const file = paramsFileInput?.files?.[0]
    if (!file) return
    await mergeParametersFromFile(file)
    if (paramsFileInput) paramsFileInput.value = ''
  }

  const readFileAsText = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsText(file)
    })

  const handleOpenVisualizer = () => {
    const url = settingsState.current.urlVisualizer
    openNewWindow(url)
  }

  const handleLoadProjects = () => {
    getModal(projectsModalId)?.open()
  }

  const handleSaveProject = async () => {
    // Continue only if we are at the root level of the graph
    if (graphStackState.canGoBack) {
      getModal(subnetworkWarningModalId)?.open()
      return
    }
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
          message:
            error instanceof Error ? error.message : 'Failed to update project',
          type: 'error',
        })
      }
      return
    }
    // No existing project - open save modal for new project
    getModal(saveProjectModalId)?.open()
  }

  const handleAutoLayout = async (direction: 'LR' | 'TB') => {
    try {
      // lazy import keeps dagre out of the initial bundle; loaded only on first use
      const { applyAutoLayout } = await import('../../utils/autoLayout')
      const layoutedNodes = applyAutoLayout(
        getNodesSnapshot(),
        getEdgesSnapshot(),
        direction
      )
      graphHistoryState.checkpoint()
      setNodes(layoutedNodes)
      toastState.add({
        message:
          direction === 'LR'
            ? 'Horizontal graph layout updated'
            : 'Vertical graph layout updated',
        timeout: 2200,
      })
    } catch (error) {
      console.error('Failed to auto-layout graph:', error)
      toastState.add({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to auto-layout graph',
        type: 'error',
      })
    }
  }

  const handleGraphDownload = () => {
    // Continue only if we are at the root level of the graph
    if (graphStackState.canGoBack) {
      getModal(subnetworkWarningModalId)?.open()
      return
    }
    try {
      // Parse current graph to Network JSON format
      // TODO: add a modal to ask user if he wants the mpi version
      const graphData = buildGraphPayload(
        getNodesSnapshot(),
        getEdgesSnapshot(),
        false
      )
      const jsonString = JSON.stringify(graphData, null, 2)

      // Create blob with JSON data + filename
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const filename = `${currentProjectState.name || 'graph'}.json`

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
        message:
          error instanceof Error ? error.message : 'Failed to download graph',
        type: 'error',
      })
    }
  }
</script>

<aside>
  <!-- Login (standalone) -->
  {#if isCoralMode && isSingleMode}
    <div class="button-container">
      <label
        for="login-button"
        class="element-label"
        class:disabled={!hasRemoteServer}
        title={loginTitle}
      >
        <LoginIcon width="30px" height="30px" />
      </label>
      <button
        id="login-button"
        onclick={handleLoginLogout}
        disabled={!hasRemoteServer}
        style="display: none"
        aria-label="Login"
      ></button>
      <span class="button-text" data-testid="login-status">
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
  {/if}

  <ConfirmationModal
    modalId={subnetworkWarningModalId}
    title="Cannot save from a subnetwork"
    message="Navigate back to the root graph before saving or downloading. Conflicts may need to be reviewed."
    confirmText="OK"
    cancelText="Close"
    onConfirm={() => {}}
  />

  <!-- Project group -->
  {#if isCoralMode && isSingleMode}
    <SidebarGroupButton title="Project" disabled={!hasRemoteServer || !token}>
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
      {/snippet}
    </SidebarGroupButton>

    <Modal id={saveProjectModalId} size="sm">
      <SaveProjectForm modalId={saveProjectModalId} />
    </Modal>
    <Modal id={projectsModalId}>
      <ProjectsList modalId={projectsModalId} />
    </Modal>
  {/if}

  <!-- Run (unified: single job or pipeline) -->
  <div class="button-container">
    <label
      for="execute-graph-button"
      class="element-label"
      title={isPipelineMode ? 'Run pipeline' : 'Run new job'}
    >
      <ExecuteIcon width="30px" height="30px" />
    </label>
    <button
      id="execute-graph-button"
      onclick={handleExecution}
      style="display: none"
      aria-label={isPipelineMode ? 'Run pipeline' : 'Run new job'}
    ></button>
    <span class="button-text">Run</span>
  </div>

  <JobConfigModal modalId={JobConfigModalId} />
  <PipelineRunNameModal
    modalId={runNameModalId}
    onConfirm={handleRunPipeline}
  />

  <!-- VTK Visualizer (standalone) -->
  <div class="button-container">
    <label
      for="vtk-visualizer-button"
      class="element-label"
      class:disabled={!hasVisualizer}
      title="Open VTK Visualizer"
    >
      <CubeIcon width="30px" height="30px" />
    </label>
    <button
      id="vtk-visualizer-button"
      onclick={handleOpenVisualizer}
      disabled={!hasVisualizer}
      style="display: none"
      aria-label="Open VTK Visualizer"
    ></button>
    <span class="button-text">Visualiz.</span>
  </div>

  <!-- Layout group (auto-layout + undo/redo) -->
  {#if isCoralMode && isSingleMode}
    <SidebarGroupButton title="Layout">
      {#snippet icon()}
        <GridIcon width="28px" height="28px" />
      {/snippet}
      {#snippet items()}
        <SidebarGroupButtonItem
          label="Horizontal"
          onclick={() => handleAutoLayout('LR')}
        />
        <SidebarGroupButtonItem
          label="Vertical"
          onclick={() => handleAutoLayout('TB')}
        />
        <SidebarGroupButtonItem
          label="Undo"
          disabled={!graphHistoryState.canUndo}
          onclick={() => graphHistoryState.undo()}
        />
        <SidebarGroupButtonItem
          label="Redo"
          disabled={!graphHistoryState.canRedo}
          onclick={() => graphHistoryState.redo()}
        />
      {/snippet}
    </SidebarGroupButton>
  {/if}

  <!-- Import group -->
  {#if isCoralMode && isSingleMode}
    <SidebarGroupButton title="Import / Export">
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
          label="Download Graph"
          onclick={handleGraphDownload}
        />
      {/snippet}
    </SidebarGroupButton>
  {/if}

  <!-- Hidden file inputs -->
  <input
    bind:this={importGraphInput}
    data-testid="import-graph-input"
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

  <!-- Parameters actions (executable single mode only) -->
  {#if isExecutableMode && isSingleMode}
    <div class="button-container">
      <label
        for="add-params-button"
        class="element-label"
        class:disabled={!hasParams}
        title={hasParams ? 'Add fields from a parameters file' : paramsSyncHint}
      >
        <PlusIcon width="26px" height="26px" />
      </label>
      <button
        id="add-params-button"
        onclick={() => paramsFileInput?.click()}
        disabled={!hasParams}
        style="display: none"
        aria-label="Add parameter fields from file"
      ></button>
      <span class="button-text">Add params</span>
    </div>

    <div class="button-container">
      <label
        for="download-params-button"
        class="element-label"
        class:disabled={!hasParams}
        title={hasParams
          ? 'Download parameters as a JSON or PRM file'
          : paramsSyncHint}
      >
        <DownloadIcon width="30px" height="30px" />
      </label>
      <button
        id="download-params-button"
        onclick={downloadParameters}
        disabled={!hasParams}
        style="display: none"
        aria-label="Download parameters"
      ></button>
      <span class="button-text">Export</span>
    </div>

    <input
      bind:this={paramsFileInput}
      type="file"
      accept=".json,.prm"
      onchange={handleMergeParams}
      style="display: none"
    />
  {/if}

  <!-- Pipeline composition (pipeline mode only) -->
  {#if isPipelineMode}
    <SidebarGroupButton title="Add stage">
      {#snippet icon()}
        <PlusIcon width="30px" height="30px" />
      {/snippet}
      {#snippet items()}
        <SidebarGroupButtonItem
          label="Coral (file)"
          onclick={() => coralGraphInput?.click()}
        />
        <SidebarGroupButtonItem
          label="Coral (canvas)"
          onclick={handleAddCoralFromCanvas}
        />
        <SidebarGroupButtonItem
          label="Executable"
          onclick={handleAddExecutable}
        />
      {/snippet}
    </SidebarGroupButton>

    <SidebarGroupButton title="Import / Export">
      {#snippet icon()}
        <UploadIcon width="30px" height="30px" />
      {/snippet}
      {#snippet items()}
        <SidebarGroupButtonItem
          label="Import pipeline"
          onclick={() => pipelineImportInput?.click()}
        />
        <SidebarGroupButtonItem
          label="Download pipeline"
          onclick={handleExportPipeline}
        />
      {/snippet}
    </SidebarGroupButton>

    <input
      bind:this={coralGraphInput}
      type="file"
      accept=".json"
      style="display: none"
      onchange={handleAddCoralFromFile}
    />
    <input
      bind:this={pipelineImportInput}
      type="file"
      accept=".json"
      style="display: none"
      onchange={handleImportPipeline}
    />
  {/if}

  <!-- Settings (standalone) -->
  <div class="button-container">
    <label for="settings-button" class="element-label" title="Settings">
      <SettingsIcon width="30px" height="30px" />
    </label>
    <button
      id="settings-button"
      onclick={() => getModal(settingsModalId)?.open()}
      style="display: none"
      aria-label="Settings"
    ></button>
    <span class="button-text"> Settings </span>
  </div>
  <Settings modalId={settingsModalId} />
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
    padding-inline: 0.5rem;
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
    /* stroke="currentColor" icons (PlusIcon/UploadIcon) inherit this */
    color: var(--ternary-color);
  }

  .element-label:hover:not(.disabled) {
    border-color: var(--border-color-hover);
  }

  .element-label.disabled {
    opacity: 0.4;
    cursor: not-allowed;
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
