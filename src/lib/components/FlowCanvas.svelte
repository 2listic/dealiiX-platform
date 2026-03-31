<script module>
  import UnifiedNode from './nodes/UnifiedNode.svelte'
</script>

<script lang="ts">
  import {
    SvelteFlow,
    Background,
    MiniMap,
    type EdgeTypes,
    type NodeTypes,
    Controls,
    Panel,
    useSvelteFlow,
    type OnConnectEnd,
  } from '@xyflow/svelte'

  import '@xyflow/svelte/dist/base.css'
  import CustomEdge from './edges/CustomEdge.svelte'
  import {
    getNodes,
    getEdges,
    getEdgesSnapshot,
    setNodes,
    setEdges,
    addEdge,
    getAvailableNodes,
    getNextNodeId,
    getStoredNetworkNodes,
  } from '../stores/nodes.svelte'
  import { colorModeState } from '../stores/colorModeStore.svelte'
  import { dndNodeDataState } from '../stores/dndStore.svelte.js'
  import { currentProjectState } from '../stores/currentProjectStore.svelte'
  import {
    clearConnectionCache,
    isValidConnection,
  } from '../utils/connectionsValidation'
  import { onDragOver, onDrop } from '../utils/dragAndDrop.svelte'
  import { NodeType, NodeTypePyBackend } from '../types/nodeTypes'
  import ButtonToggleDarkMode from './layout/ButtonToggleDarkMode.svelte'
  import JobsTable from './layout/JobsTable.svelte'
  import {
    createCanvasNode,
    buildEdgeForNewNode,
    resolveConnectionContext,
    formatSuggestedNodeName,
    type CompatibleNodeOption,
    type ConnectedNodeDraft,
    type ConnectStartParams,
  } from '../utils/flowNodeCreation'
  import { toastState } from '../stores/toastsStore.svelte'
  import { getModal } from './layout/Modal.svelte'
  import CreateConnectedNodeModal from './nodes/CreateConnectedNodeModal.svelte'

  const { screenToFlowPosition, getNode, getIntersectingNodes } =
    useSvelteFlow()
  const createConnectedNodeModalId = 'create-connected-node'

  let canvasElement = $state<HTMLDivElement>()
  let connectStartParams: ConnectStartParams | null = null
  let connectedNodeDraft = $state<ConnectedNodeDraft | null>(null)

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
  const edgeTypes: EdgeTypes = {
    'custom-edge': CustomEdge,
  }

  // Clear the validation cache whenever edges are deleted so stale type-check
  // results don't prevent new valid connections from being made.
  const ondelete = ({ edges: deletedEdges }) => {
    if (deletedEdges && deletedEdges.length > 0) {
      clearConnectionCache()
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

  /**
   * Creates a new canvas node and wires it to the originating handle.
   * Called either automatically (single compatible option) or from the modal.
   * @param option - The chosen compatible template option.
   * @param name - Display name for the new node.
   */
  const createConnectedNode = (option: CompatibleNodeOption, name: string) => {
    if (!connectedNodeDraft) {
      return
    }

    try {
      const newNode = createCanvasNode(
        option.template,
        connectedNodeDraft.position,
        {
          id: getNextNodeId().toString(),
          name,
        }
      )

      // TODO create addNode function as done with addEdge
      setNodes([...getNodes(), newNode])
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

  /**
   * Handles a connection drag release on empty canvas space.
   * Uses `event` for drop coordinates and module-level `connectStartParams` for the
   * originating handle. Resolves compatible templates, then either auto-creates a node
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

    // Guard: target handles only accept one incoming edge (no multiple edges to the same target handle).
    const isTargetHandleAlreadyConnected =
      connectStartParams.handleType === 'target' &&
      getEdgesSnapshot().some(
        (e) =>
          e.target === node.id &&
          e.targetHandle === connectStartParams?.handleId
      )
    if (isTargetHandleAlreadyConnected) {
      connectStartParams = null
      return
    }

    // Resolve compatible templates for the originating handle type and index.
    const templates = [...getStoredNetworkNodes(), ...getAvailableNodes()]
    const context = resolveConnectionContext(
      node,
      connectStartParams.handleType,
      connectStartParams.handleId,
      templates
    )

    if (!context) {
      connectStartParams = null
      return
    }

    const { compatibleOptions, connectionName, connectionType } = context

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
    // Params are now captured in connectedNodeDraft; null the module-level ref so
    // a re-entrant call to handleConnectEnd doesn't act on stale state.
    connectStartParams = null

    if (compatibleOptions.length === 1) {
      // For ELEMENTARY_CONSTRUCTOR source handles use the template default name
      // instead of the connection/argument name (which would be confusing).
      const autoCreateName =
        connectedNodeDraft.connectStartParams.handleType === 'source' &&
        node.data.node_type === NodeType.ELEMENTARY_CONSTRUCTOR
          ? compatibleOptions[0].defaultNodeName
          : formatSuggestedNodeName(connectionName)
      createConnectedNode(
        compatibleOptions[0],
        autoCreateName || connectionName
      )
      return
    }

    // Multiple compatible options: let the user choose via the modal.
    getModal(createConnectedNodeModalId)?.open()
  }
</script>

<div class="flow-canvas" bind:this={canvasElement}>
  <SvelteFlow
    bind:nodes={getNodes, setNodes}
    bind:edges={getEdges, setEdges}
    {nodeTypes}
    {edgeTypes}
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
        {#if currentProjectState.id}
          <span class="project-main">{currentProjectState.name}</span>
          <span class="project-secondary">ID: {currentProjectState.id}</span>
        {:else}
          <span class="project-secondary">Unsaved Project</span>
        {/if}
      </div>
      <JobsTable />
    </Panel>
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
      <ButtonToggleDarkMode />
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

  .custom-panel {
    border: 1px solid #ccc;
    border-radius: 4px;
    padding: 1vh;
    margin-bottom: 1vh;
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
    background-color: var(--primary-color);
  }
</style>
