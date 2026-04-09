<script module>
  import UnifiedNode from './nodes/UnifiedNode.svelte'
</script>

<script lang="ts">
  import {
    SvelteFlow,
    Background,
    MiniMap,
    type NodeTypes,
    Controls,
    Panel,
    useSvelteFlow,
    type OnConnectEnd,
  } from '@xyflow/svelte'

  import '@xyflow/svelte/dist/base.css'
  import {
    getEdgesSnapshot,
    getNodes,
    getEdges,
    setNodes,
    setEdges,
    addEdge,
    getAvailableNodes,
    getStoredNetworkNodes,
    addNode,
  } from '../stores/nodes.svelte'
  import { colorModeState } from '../stores/colorModeStore.svelte'
  import { dndNodeDataState } from '../stores/dndStore.svelte.js'
  import { currentProjectState } from '../stores/currentProjectStore.svelte'
  import { graphStackState } from '../stores/graphStack.svelte'
  import {
    loadParentGraph,
    renameCurrentSubnetwork,
  } from '../stores/graphNavigation.svelte'
  import {
    clearConnectionCache,
    isValidConnection,
    isTargetHandleConnected,
  } from '../utils/connectionsValidation'
  import { onDragOver, onDrop } from '../utils/dragAndDrop.svelte'
  import {
    NodeType,
    NodeTypePyBackend,
    returnNodeName,
  } from '../types/nodeTypes'
  import ButtonToggleDarkMode from './layout/ButtonToggleDarkMode.svelte'
  import JobsTable from './layout/JobsTable.svelte'
  import EditIcon from './icons/EditIcon.svelte'
  import Button from './layout/Button.svelte'
  import CreateNetworkNodeModal from './nodes/CreateNetworkNodeModal.svelte'
  import { toastState } from '../stores/toastsStore.svelte'
  import { getModal } from './layout/Modal.svelte'
  import { collapseSelectionToSubnetwork } from '../utils/networkNodeCanvas'
  import {
    createCanvasNode,
    buildEdgeForNewNode,
    resolveConnectionAndCompatibleNodes,
    formatSuggestedNodeName,
    type CompatibleNodeOption,
    type ConnectedNodeDraft,
    type ConnectStartParams,
  } from '../utils/canvasNodeUtils'
  import CreateConnectedNodeModal from './nodes/CreateConnectedNodeModal.svelte'

  const { screenToFlowPosition, getNode, getIntersectingNodes } =
    useSvelteFlow()

  let isEditingBreadcrumb = $state(false)
  let breadcrumbNameDraft = $state('')
  let canvasElement = $state<HTMLDivElement>()
  let connectStartParams: ConnectStartParams | null = null
  let connectedNodeDraft = $state<ConnectedNodeDraft | null>(null)
  type SelectionSubgraphMode = 'create' | 'merge'
  let selectionSubgraphMode = $state<SelectionSubgraphMode>('create')

  const createNetworkNodeModalId = 'create-network-node'
  const createConnectedNodeModalId = 'create-connected-node'

  const nodeTypes: NodeTypes = {
    [NodeType.ELEMENTARY_CONSTRUCTOR]: UnifiedNode,
    [NodeType.EMPTY_CONSTRUCTOR]: UnifiedNode,
    [NodeType.CONSTRUCTOR]: UnifiedNode,
    [NodeType.ABSTRACT]: UnifiedNode,
    [NodeType.VOID_METHOD]: UnifiedNode,
    [NodeType.VOID_CONST_METHOD]: UnifiedNode,
    [NodeType.VOID_FUNCTION]: UnifiedNode,
    [NodeType.FUNCTION]: UnifiedNode,
    [NodeType.NETWORK]: UnifiedNode,
    [NodeTypePyBackend.PRIMITIVE]: UnifiedNode,
    [NodeTypePyBackend.METHOD]: UnifiedNode,
  }

  let selectedNodes = $derived(getNodes().filter((node) => node.selected))
  let canCreateSubnetworkFromSelection = $derived(selectedNodes.length > 1)
  let canMergeSubgraphsFromSelection = $derived(
    selectedNodes.some((node) => node.data.node_type === NodeType.NETWORK)
  )

  /**
   * Handles node/edge deletion events from @xyflow/svelte.
   * Clears the connection validation cache for any deleted edges so that
   * subsequent connection attempts don't get blocked by stale type-check
   * results referencing handles that no longer exist.
   * @param deletedEdges - The edges that were removed from the canvas.
   */
  const ondelete = ({ edges: deletedEdges }) => {
    if (deletedEdges && deletedEdges.length > 0) {
      clearConnectionCache()
    }
  }

  $effect(() => {
    if (!graphStackState.canGoBack) {
      isEditingBreadcrumb = false
      breadcrumbNameDraft = ''
    }
  })

  const startEditingBreadcrumb = () => {
    breadcrumbNameDraft = graphStackState.currentLabel
    isEditingBreadcrumb = true
  }

  const cancelEditingBreadcrumb = () => {
    isEditingBreadcrumb = false
    breadcrumbNameDraft = graphStackState.currentLabel
  }

  const submitBreadcrumbRename = async () => {
    try {
      await renameCurrentSubnetwork(breadcrumbNameDraft)
      isEditingBreadcrumb = false
      toastState.add({
        message: `Renamed subnetwork to "${graphStackState.currentLabel}"`,
        timeout: 2000,
      })
    } catch (error) {
      toastState.add({
        message:
          error instanceof Error
            ? error.message
            : 'Failed to rename subnetwork',
        type: 'error',
      })
    }
  }

  const openCreateSelectionNetworkModal = (
    mode: SelectionSubgraphMode = 'create'
  ) => {
    selectionSubgraphMode = mode
    getModal(createNetworkNodeModalId)?.open()
  }

  const createSubnetworkFromSelection = async (
    name: string,
    mode: SelectionSubgraphMode = 'create'
  ) => {
    const { newNodes, newEdges } = await collapseSelectionToSubnetwork(
      name,
      mode
    )
    setNodes(newNodes)
    setEdges(newEdges)
  }

  // Records which handle the user started dragging from so it is available
  // when the drag ends on empty canvas space.
  const handleConnectStart = (
    _: MouseEvent | TouchEvent,
    params: {
      nodeId: string | null
      handleId: string | null
      handleType: string | null
    }
  ) => {
    if (
      (params.handleType !== 'source' && params.handleType !== 'target') ||
      !params.nodeId ||
      !params.handleId
    ) {
      connectStartParams = null
      return
    }
    connectStartParams = {
      nodeId: params.nodeId,
      handleId: params.handleId,
      handleType: params.handleType,
    }
  }

  /**
   * Handles a connection drag release on empty canvas space.
   * Uses `event` for drop coordinates and module-level `connectStartParams` for the
   * originating handle. Resolves compatible node options, then either auto-creates a node
   * (single match) or opens the selection modal (multiple matches).
   * @see https://svelteflow.dev/api-reference/types/on-connect-end
   * @param event - The `MouseEvent | TouchEvent` that ended the connection drag.
   */
  const handleConnectEnd: OnConnectEnd = (event) => {
    if (!connectStartParams) return

    const clientPosition = getClientPosition(event)
    if (!clientPosition || !canvasElement) return

    // Guard: drop must land inside the canvas element (not on a UI panel).
    if (!isClientPositionInsideElement(clientPosition, canvasElement)) {
      connectStartParams = null
      return
    }

    const position = screenToFlowPosition(clientPosition)
    // Guard: drop must land on empty space, not on an existing node.
    const overlappingNodes = getIntersectingNodes(
      { x: position.x - 1, y: position.y - 1, width: 2, height: 2 },
      true
    )
    if (overlappingNodes.length > 0) {
      connectStartParams = null
      return
    }

    const node = getNode(connectStartParams.nodeId)
    if (!node) {
      console.warn('onconnectend: could not find node', connectStartParams)
      connectStartParams = null
      return
    }

    // Guard: target handles only accept one incoming edge.
    if (
      connectStartParams.handleType === 'target' &&
      isTargetHandleConnected(
        getEdgesSnapshot(),
        node.id,
        connectStartParams.handleId as string
      )
    ) {
      console.warn(
        `Handle ${connectStartParams.handleId} on node ${node.id} already connected`
      )
      connectStartParams = null
      return
    }

    // Resolve connection type and name plus compatible nodes for the originating handle.
    const availableNodes = [...getStoredNetworkNodes(), ...getAvailableNodes()]
    const resolved = resolveConnectionAndCompatibleNodes(
      connectStartParams,
      node,
      availableNodes
    )
    if (!resolved) {
      console.warn(
        'handleConnectEnd: could not resolve handle metadata',
        connectStartParams
      )
      connectStartParams = null
      return
    }
    const { connectionType, connectionName, compatibleOptions } = resolved

    if (compatibleOptions.length === 0) {
      connectStartParams = null
      toastState.add({
        message: `No compatible nodes found for type "${connectionType}"`,
        type: 'error',
      })
      return
    }

    connectedNodeDraft = {
      options: compatibleOptions,
      sourceType: connectionType,
      position,
      connectStartParams,
    }
    connectStartParams = null

    if (compatibleOptions.length === 1) {
      // For ELEMENTARY_CONSTRUCTOR source handles use the node definition's default name
      // instead of the connection/argument name (which would be confusing).
      const autoCreateName =
        connectedNodeDraft.connectStartParams.handleType === 'source' &&
        node.data.node_type === NodeType.ELEMENTARY_CONSTRUCTOR
          ? returnNodeName(compatibleOptions[0].nodeDefinition)
          : formatSuggestedNodeName(connectionName)
      createConnectedNode(compatibleOptions[0], autoCreateName)
      return
    }

    getModal(createConnectedNodeModalId)?.open()
  }

  /**
   * Creates a new canvas node and wires it to the originating handle.
   * Called either automatically (single compatible option) or from the modal.
   * @param option - The chosen compatible node option.
   * @param name - Display name for the new node.
   */
  const createConnectedNode = (option: CompatibleNodeOption, name: string) => {
    if (!connectedNodeDraft) {
      return
    }

    try {
      const newNode = createCanvasNode(
        option.nodeDefinition,
        connectedNodeDraft.position,
        { name }
      )

      addNode(newNode)
      addEdge(
        buildEdgeForNewNode(
          connectedNodeDraft.connectStartParams,
          newNode.id,
          option.handleId
        )
      )
      clearConnectionCache()

      connectedNodeDraft = null
      getModal(createConnectedNodeModalId)?.close()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'unknown create-node error'
      console.error('Create connected node failed:', error)
      toastState.add({
        message: `Create connected node failed: ${message}`,
        type: 'error',
      })
    }
  }

  const getClientPosition = (event: MouseEvent | TouchEvent) => {
    if ('changedTouches' in event && event.changedTouches.length > 0) {
      const touch = event.changedTouches[0]
      return { x: touch.clientX, y: touch.clientY }
    }

    if ('clientX' in event) {
      return { x: event.clientX, y: event.clientY }
    }

    return null
  }

  const isClientPositionInsideElement = (
    clientPos: { x: number; y: number },
    element: HTMLElement
  ): boolean => {
    const bounds = element.getBoundingClientRect()
    return (
      clientPos.x >= bounds.left &&
      clientPos.x <= bounds.right &&
      clientPos.y >= bounds.top &&
      clientPos.y <= bounds.bottom
    )
  }
</script>

<div class="flow-canvas" bind:this={canvasElement}>
  <SvelteFlow
    bind:nodes={getNodes, setNodes}
    bind:edges={getEdges, setEdges}
    {nodeTypes}
    fitView
    {isValidConnection}
    onconnectstart={handleConnectStart}
    onconnect={() => {
      connectStartParams = null
    }}
    onconnectend={handleConnectEnd}
    ondragover={onDragOver}
    ondrop={(event) =>
      onDrop(
        event,
        screenToFlowPosition,
        $state.snapshot(dndNodeDataState.current)
      )}
    colorMode={colorModeState.value}
    {ondelete}
  >
    <Panel position="top-left">
      <div class="project-info">
        {#if graphStackState.canGoBack}
          <div class="graph-nav">
            <button class="nav-button" onclick={() => loadParentGraph()}>
              Back
            </button>
            <div class="graph-breadcrumbs">
              <span>{graphStackState.breadcrumbs.slice(0, -1).join(' / ')}</span
              >
              <span>/</span>
              {#if isEditingBreadcrumb}
                <input
                  class="breadcrumb-input"
                  bind:value={breadcrumbNameDraft}
                  onkeydown={(event) => {
                    if (event.key === 'Enter') {
                      submitBreadcrumbRename()
                    } else if (event.key === 'Escape') {
                      cancelEditingBreadcrumb()
                    }
                  }}
                />
                <button
                  class="breadcrumb-action"
                  onclick={submitBreadcrumbRename}
                >
                  Save
                </button>
                <button
                  class="breadcrumb-action"
                  onclick={cancelEditingBreadcrumb}
                >
                  Cancel
                </button>
              {:else}
                <span class="current-crumb">{graphStackState.currentLabel}</span
                >
                <button
                  class="breadcrumb-icon-button"
                  title="Rename subnetwork"
                  onclick={startEditingBreadcrumb}
                >
                  <EditIcon width="14px" height="14px" />
                </button>
              {/if}
            </div>
          </div>
        {/if}
        {#if currentProjectState.id}
          <span class="project-main">{currentProjectState.name}</span>
          <span class="project-secondary">ID: {currentProjectState.id}</span>
        {:else}
          <span class="project-secondary">Unsaved Project</span>
        {/if}
        <span class="project-secondary">
          Editing: {graphStackState.currentLabel}
        </span>
      </div>
      <JobsTable />
    </Panel>
    {#if canCreateSubnetworkFromSelection}
      <Panel position="top-center">
        <div class="selection-actions">
          <Button
            variant="action"
            size="small"
            onclick={() => openCreateSelectionNetworkModal('create')}
          >
            Create Subnetwork
          </Button>
          {#if canMergeSubgraphsFromSelection}
            <Button
              variant="default"
              size="small"
              onclick={() => openCreateSelectionNetworkModal('merge')}
            >
              Merge Subgraphs
            </Button>
          {/if}
        </div>
      </Panel>
    {/if}
    <Panel position="bottom-left">
      <div class="export-button-container">
        <!-- <button onclick={executeWithPassword}>Execute with password</button> -->
        <!-- <button onclick={executeWithKey}>Execute with key</button> -->
      </div>
      <div id="custom-panel-logs" class="custom-panel" style="margin-top: 1vh;">
        -
      </div>
    </Panel>
    <Panel position="top-right">
      <div class="top-right-controls">
        <ButtonToggleDarkMode />
      </div>
    </Panel>
    <Controls position="bottom-center" orientation="horizontal" />
    <MiniMap />
    <Background />
  </SvelteFlow>
</div>

<CreateConnectedNodeModal
  modalId={createConnectedNodeModalId}
  options={connectedNodeDraft?.options ?? []}
  sourceType={connectedNodeDraft?.sourceType ?? ''}
  onCreate={createConnectedNode}
  onCancel={() => {
    connectedNodeDraft = null
  }}
/>

<CreateNetworkNodeModal
  modalId={createNetworkNodeModalId}
  title={selectionSubgraphMode === 'merge'
    ? 'Merge Subgraphs'
    : 'Create Subgraph'}
  submitText={selectionSubgraphMode === 'merge' ? 'Merge' : 'Create'}
  onCreate={(name) =>
    createSubnetworkFromSelection(name, selectionSubgraphMode)}
/>

<style>
  .flow-canvas {
    width: 100%;
    height: 100%;
  }

  .project-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem 1rem;
    background-color: var(--primary-color);
    border-radius: 5px;
    margin-bottom: 1vh;
  }

  .project-main {
    font-weight: bold;
    /* font-size: 1.1rem; */
  }

  .graph-nav {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.25rem;
  }

  .nav-button {
    border: 1px solid var(--ternary-color);
    border-radius: 999px;
    padding: 0.2rem 0.75rem;
    background: var(--secondary-color);
    cursor: pointer;
  }

  .graph-breadcrumbs {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.85rem;
    opacity: 0.85;
  }

  .current-crumb {
    font-weight: 600;
  }

  .breadcrumb-input {
    min-width: 14rem;
    padding: 0.2rem 0.5rem;
    border: 1px solid var(--ternary-color);
    border-radius: 999px;
    background: var(--secondary-color);
  }

  .breadcrumb-action,
  .breadcrumb-icon-button {
    border: 1px solid var(--ternary-color);
    border-radius: 999px;
    padding: 0.15rem 0.5rem;
    background: var(--secondary-color);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .project-secondary {
    /* font-size: 0.8rem; */
    opacity: 0.7;
  }

  .export-button-container {
    display: flex;
    flex-wrap: wrap;
    gap: 1vw;
    max-width: 50vw;
  }

  .top-right-controls {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    align-items: flex-end;
  }

  .custom-panel {
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 1vh;
    margin-bottom: 1vh;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    background-color: var(--primary-color);
  }

  .selection-actions {
    padding: 0.5rem 0.75rem;
    background: var(--primary-color);
    border-radius: 999px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
  }
</style>
